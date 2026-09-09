const { getAdapter } = require("./adapters");
const { classifyError, sleep, MAX_INLINE_WAIT_MS } = require("./limits");

/**
 * A task's whole life is one flat, chronological transcript: each
 * agent's output, each question it asked, each note you sent back.
 * The pipeline appends to it, and the Council view renders it as a
 * single chat with one coloured dot per agent — same data, two uses.
 */
function addMessage(task, { from, text, kind }) {
  task.messages.push({ from, text, kind, at: new Date().toISOString() });
  return task;
}

function lastOutput(task) {
  for (let i = task.messages.length - 1; i >= 0; i--) {
    if (task.messages[i].kind === "output") return task.messages[i].text;
  }
  return null;
}

/**
 * Everything the current stage's agent needs to see: the original
 * brief, plus anything you've said since (answers to its questions,
 * or revision feedback). Prior stage output is passed separately so
 * adapters can frame it as "build on this" rather than as instruction.
 */
function buildPrompt(task) {
  const parts = [task.description];

  const sinceLastOutput = [];
  for (let i = task.messages.length - 1; i >= 0; i--) {
    const msg = task.messages[i];
    if (msg.kind === "output") break;
    if (msg.from === "you") sinceLastOutput.unshift(msg.text);
  }

  if (sinceLastOutput.length) {
    parts.push("", "--- Notes from the reviewer, address these ---", ...sinceLastOutput);
  }
  return parts.join("\n");
}

/**
 * Runs the task forward from whatever stage it's on, through the rest
 * of its platforms, stopping early when a stage needs a human (a
 * question, a rate limit, an auth problem, a hard failure).
 */
async function runPipeline(task, { save } = {}) {
  const persist = save || (() => {});

  task.status = "running";
  task.updatedAt = new Date().toISOString();
  persist(task);

  while (task.stageIndex < task.platforms.length) {
    const platform = task.platforms[task.stageIndex];
    const prompt = buildPrompt(task);
    const priorOutput = task.stageIndex > 0 ? lastOutput(task) : null;

    let result;
    try {
      const adapter = getAdapter(platform);
      result = await adapter.submit(prompt, { priorOutput });
    } catch (err) {
      const classified = classifyError(err);

      if (classified.kind === "transient") {
        await sleep(classified.waitMs);
        try {
          const adapter = getAdapter(platform);
          result = await adapter.submit(prompt, { priorOutput });
        } catch (retryErr) {
          return failStage(task, platform, retryErr, persist);
        }
      } else if (classified.kind === "rate_limit") {
        if (classified.waitMs <= MAX_INLINE_WAIT_MS) {
          await sleep(classified.waitMs);
          continue;
        }
        task.status = "waiting_limit";
        task.resumeAt = new Date(Date.now() + classified.waitMs).toISOString();
        addMessage(task, {
          from: platform,
          kind: "error",
          text: `Hit this account's usage limit. Parked — will pick this back up automatically after ${new Date(task.resumeAt).toLocaleString()}.`,
        });
        task.updatedAt = new Date().toISOString();
        persist(task);
        return task;
      } else {
        return failStage(task, platform, err, persist);
      }
    }

    if (result.needsInput) {
      addMessage(task, { from: platform, kind: "question", text: result.output });
      task.status = "needs_input";
      task.updatedAt = new Date().toISOString();
      persist(task);
      return task;
    }

    addMessage(task, { from: platform, kind: "output", text: result.output });
    task.stageIndex += 1;
    task.updatedAt = new Date().toISOString();
    persist(task);
  }

  task.status = "awaiting_review";
  task.updatedAt = new Date().toISOString();
  persist(task);
  return task;
}

function failStage(task, platform, err, persist) {
  addMessage(task, { from: platform, kind: "error", text: String(err.message || err) });
  task.status = "failed";
  task.updatedAt = new Date().toISOString();
  persist(task);
  return task;
}

module.exports = { runPipeline, addMessage, buildPrompt, lastOutput };

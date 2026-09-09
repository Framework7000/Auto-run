const { getAdapter } = require("./adapters");
const { saveTask } = require("./db");

/**
 * Runs (or re-runs) a task against its assigned agent and appends the
 * result as a new "attempt". On a re-run after rejection, the previous
 * feedback is folded into the prompt so the agent sees what to fix.
 */
async function runTask(task) {
  task.status = "running";
  task.updatedAt = new Date().toISOString();
  saveTask(task);

  const adapter = getAdapter(task.agentId);
  const prompt = buildPrompt(task);

  try {
    const { output } = await adapter.submit(prompt);
    task.attempts.push({
      at: new Date().toISOString(),
      prompt,
      output,
      error: null,
    });
    task.status = "awaiting_review";
  } catch (err) {
    task.attempts.push({
      at: new Date().toISOString(),
      prompt,
      output: null,
      error: err.message,
    });
    task.status = "failed";
  }

  task.updatedAt = new Date().toISOString();
  saveTask(task);
  return task;
}

function buildPrompt(task) {
  const lastAttempt = task.attempts[task.attempts.length - 1];
  if (!lastAttempt || !lastAttempt.feedback) {
    return task.description;
  }
  return [
    task.description,
    "",
    "--- Revision requested ---",
    "Your previous answer was sent back with this feedback. Please address it:",
    lastAttempt.feedback,
  ].join("\n");
}

module.exports = { runTask, buildPrompt };

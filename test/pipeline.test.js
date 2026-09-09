const assert = require("assert");
const path = require("path");

// Swap in fake adapters before pipeline.js resolves the real registry,
// so the pipeline logic can be exercised without credentials or a browser.
const adaptersPath = require.resolve("../server/adapters");
const fakeAdapters = {};
require.cache[adaptersPath] = {
  id: adaptersPath,
  filename: adaptersPath,
  loaded: true,
  exports: {
    getAdapter: (agentId) => {
      if (!fakeAdapters[agentId]) throw new Error(`no fake adapter for ${agentId}`);
      return fakeAdapters[agentId];
    },
  },
};

const { runPipeline, buildPrompt } = require("../server/pipeline");
const { classifyError } = require("../server/limits");

function makeTask(platforms, description = "Build the Class 8 algebra chapter") {
  return {
    id: "t1",
    title: "test",
    description,
    platforms,
    stageIndex: 0,
    status: "queued",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

let passed = 0;
async function check(name, fn) {
  await fn();
  console.log(`  ok  ${name}`);
  passed++;
}

(async () => {
  console.log("\npipeline");

  await check("runs a single-agent task to awaiting_review", async () => {
    fakeAdapters.claude = { submit: async () => ({ output: "the chapter", needsInput: false }) };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(task.status, "awaiting_review");
    assert.strictEqual(task.messages.length, 1);
    assert.strictEqual(task.messages[0].from, "claude");
    assert.strictEqual(task.messages[0].kind, "output");
  });

  await check("chains two agents and passes the first one's output forward", async () => {
    let seenPrior = null;
    fakeAdapters.claude = { submit: async () => ({ output: "CONTENT FROM CLAUDE" }) };
    fakeAdapters.chatgpt = {
      submit: async (_prompt, { priorOutput }) => {
        seenPrior = priorOutput;
        return { output: "DESIGNED SLIDES" };
      },
    };

    const task = await runPipeline(makeTask(["claude", "chatgpt"]));
    assert.strictEqual(seenPrior, "CONTENT FROM CLAUDE", "second stage must receive stage one's output");
    assert.strictEqual(task.status, "awaiting_review");
    assert.strictEqual(task.stageIndex, 2);
    assert.deepStrictEqual(task.messages.map((m) => m.from), ["claude", "chatgpt"]);
  });

  await check("stops and asks when an agent needs more information", async () => {
    fakeAdapters.claude = { submit: async () => ({ output: "1. Which grade?", needsInput: true }) };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(task.status, "needs_input");
    assert.strictEqual(task.messages[0].kind, "question");
    assert.strictEqual(task.stageIndex, 0, "stage must not advance on an unanswered question");
  });

  await check("resumes the same stage once the question is answered", async () => {
    let calls = 0;
    fakeAdapters.claude = {
      submit: async () => {
        calls++;
        return calls === 1 ? { output: "Which grade?", needsInput: true } : { output: "the chapter" };
      },
    };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(task.status, "needs_input");

    task.messages.push({ from: "you", kind: "answer", text: "Class 8, CBSE", at: new Date().toISOString() });
    const resumed = await runPipeline(task);
    assert.strictEqual(resumed.status, "awaiting_review");
    assert.strictEqual(calls, 2);
  });

  await check("feeds your answer into the next prompt", async () => {
    const task = makeTask(["claude"]);
    task.messages.push({ from: "claude", kind: "question", text: "Which grade?", at: "" });
    task.messages.push({ from: "you", kind: "answer", text: "Class 8, CBSE", at: "" });
    const prompt = buildPrompt(task);
    assert.ok(prompt.includes("Class 8, CBSE"), "answer must reach the agent");
    assert.ok(prompt.includes("Build the Class 8 algebra chapter"), "original brief must survive");
  });

  await check("parks the task instead of failing when an account hits its limit", async () => {
    const limitErr = new Error("You've reached your limit of messages");
    fakeAdapters.chatgpt = { submit: async () => { throw limitErr; } };
    const task = await runPipeline(makeTask(["chatgpt"]));
    assert.strictEqual(task.status, "waiting_limit");
    assert.ok(task.resumeAt, "must record when to try again");
    assert.ok(new Date(task.resumeAt) > new Date(), "resume time must be in the future");
  });

  await check("retries a transient failure once before giving up", async () => {
    let calls = 0;
    fakeAdapters.claude = {
      submit: async () => {
        calls++;
        if (calls === 1) throw Object.assign(new Error("socket hang up"), { status: 503 });
        return { output: "recovered" };
      },
    };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(calls, 2);
    assert.strictEqual(task.status, "awaiting_review");
  });

  await check("records a hard failure without retrying forever", async () => {
    fakeAdapters.claude = { submit: async () => { throw new Error("selectors are outdated"); } };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(task.status, "failed");
    assert.strictEqual(task.messages[0].kind, "error");
  });

  await check("re-running after feedback redoes the rejected stage", async () => {
    const prompts = [];
    fakeAdapters.claude = {
      submit: async (prompt) => {
        prompts.push(prompt);
        return { output: `draft ${prompts.length}` };
      },
    };
    const task = await runPipeline(makeTask(["claude"]));
    assert.strictEqual(task.stageIndex, 1);

    task.messages.push({ from: "you", kind: "feedback", text: "Too long, cut it in half", at: "" });
    task.stageIndex = Math.max(0, task.stageIndex - 1);
    const redone = await runPipeline(task);

    assert.strictEqual(prompts.length, 2);
    assert.ok(prompts[1].includes("Too long, cut it in half"), "feedback must reach the agent");
    assert.strictEqual(redone.status, "awaiting_review");
  });

  console.log("\nerror classification");

  await check("classifies a 429 with retry-after as a rate limit", async () => {
    const err = Object.assign(new Error("rate limited"), { status: 429, headers: { "retry-after": "120" } });
    const result = classifyError(err);
    assert.strictEqual(result.kind, "rate_limit");
    assert.strictEqual(result.waitMs, 120000);
  });

  await check("classifies a missing login as auth, not something to retry", async () => {
    assert.strictEqual(classifyError(new Error("Not logged in to ChatGPT")).kind, "auth");
    assert.strictEqual(classifyError(Object.assign(new Error("nope"), { status: 401 })).kind, "auth");
  });

  await check("classifies a 5xx as transient", async () => {
    assert.strictEqual(classifyError(Object.assign(new Error("bad gateway"), { status: 502 })).kind, "transient");
  });

  console.log(`\n${passed} passed\n`);
})().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});

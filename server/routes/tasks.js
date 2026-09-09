const express = require("express");
const { nanoid } = require("nanoid");
const { listTasks, getTask, saveTask, deleteTask } = require("../db");
const { resolvePipeline, getAgent } = require("../router");
const { runPipeline, addMessage } = require("../pipeline");

const router = express.Router();

function newTask({ ref, title, description, platforms = [], sheetRow, spreadsheetId, source = "manual" }) {
  const { platforms: resolved, unknown } = resolvePipeline(platforms);
  return {
    id: nanoid(10),
    ref: ref || "",
    title: title || description.slice(0, 60),
    description,
    platforms: resolved,
    unknownPlatforms: unknown,
    stageIndex: 0,
    status: resolved.length ? "queued" : "blocked",
    messages: [],
    sheetRow: sheetRow || null,
    spreadsheetId: spreadsheetId || null,
    source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

router.get("/", (req, res) => {
  res.json(listTasks().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
});

router.get("/export/:format", (req, res) => {
  const tasks = listTasks().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (req.params.format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=auto-run-report.json");
    return res.json(tasks);
  }

  if (req.params.format === "md") {
    const lines = ["# Auto-Run Report", ""];
    for (const t of tasks) {
      lines.push(`## ${t.ref ? `${t.ref} — ` : ""}${t.title}`, "");
      lines.push(`- Pipeline: ${t.platforms.join(" → ") || "unrouted"}`);
      lines.push(`- Status: ${t.status}`, "");
      lines.push("**Task:**", "", t.description, "");
      for (const msg of t.messages) {
        const who = msg.from === "you" ? "You" : (getAgent(msg.from)?.name || msg.from);
        lines.push(`**${who}** (${msg.kind}, ${new Date(msg.at).toLocaleString()}):`, "", msg.text, "");
      }
      lines.push("---", "");
    }
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", "attachment; filename=auto-run-report.md");
    return res.send(lines.join("\n"));
  }

  res.status(400).json({ error: "format must be json or md" });
});

router.get("/:id", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.post("/", (req, res) => {
  const { ref, title, description, platforms } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  const task = newTask({ ref, title, description, platforms: platforms || [] });
  saveTask(task);
  res.status(201).json(task);
});

router.post("/:id/run", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!task.platforms.length) {
    return res.status(400).json({ error: "Task has no recognized platform to run on" });
  }
  try {
    res.json(await runPipeline(task, { save: saveTask }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/approve", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  task.status = "approved";
  task.updatedAt = new Date().toISOString();
  saveTask(task);
  res.json(task);
});

/** Sends the last stage back to its agent with your note attached. */
router.post("/:id/reject", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const { feedback } = req.body;
  if (!feedback || !feedback.trim()) {
    return res.status(400).json({ error: "feedback is required when rejecting" });
  }

  addMessage(task, { from: "you", kind: "feedback", text: feedback });
  task.stageIndex = Math.max(0, task.stageIndex - 1);
  saveTask(task);

  try {
    res.json(await runPipeline(task, { save: saveTask }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Answers an agent's clarifying question and resumes the same stage. */
router.post("/:id/answer", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const { answer } = req.body;
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "answer is required" });
  }

  addMessage(task, { from: "you", kind: "answer", text: answer });
  saveTask(task);

  try {
    res.json(await runPipeline(task, { save: saveTask }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  deleteTask(req.params.id);
  res.status(204).end();
});

module.exports = { router, newTask };

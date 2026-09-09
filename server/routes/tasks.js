const express = require("express");
const { nanoid } = require("nanoid");
const { listTasks, getTask, saveTask, deleteTask } = require("../db");
const { pickAgent, getAgent } = require("../router");
const { runTask } = require("../taskRunner");

const router = express.Router();

function newTask({ title, description, tags = [], agentId }) {
  const chosenAgent = agentId ? getAgent(agentId) : pickAgent(tags);
  if (!chosenAgent) throw new Error("No agent available to handle this task");
  return {
    id: nanoid(10),
    title: title || description.slice(0, 60),
    description,
    tags,
    agentId: chosenAgent.id,
    status: "queued",
    attempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

router.get("/", (req, res) => {
  const tasks = listTasks().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(tasks);
});

router.get("/export/:format", (req, res) => {
  const tasks = listTasks().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const format = req.params.format;

  if (format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=auto-run-report.json");
    return res.json(tasks);
  }

  if (format === "md") {
    const lines = ["# Auto-Run Report", ""];
    for (const t of tasks) {
      lines.push(`## ${t.title}`, "");
      lines.push(`- Agent: ${t.agentId}`, `- Status: ${t.status}`, `- Tags: ${(t.tags || []).join(", ") || "none"}`, "");
      lines.push("**Task:**", "", t.description, "");
      const last = t.attempts[t.attempts.length - 1];
      if (last) {
        lines.push("**Latest output:**", "", last.output || `_error: ${last.error}_`, "");
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
  const { title, description, tags, agentId } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  try {
    const task = newTask({ title, description, tags, agentId });
    saveTask(task);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/:id/run", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  try {
    const updated = await runTask(task);
    res.json(updated);
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

router.post("/:id/reject", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const { feedback, rerun } = req.body;
  if (!feedback || !feedback.trim()) {
    return res.status(400).json({ error: "feedback is required when rejecting" });
  }

  const lastAttempt = task.attempts[task.attempts.length - 1];
  if (lastAttempt) lastAttempt.feedback = feedback;
  task.status = "queued";
  task.updatedAt = new Date().toISOString();
  saveTask(task);

  if (rerun === false) {
    return res.json(task);
  }

  try {
    const updated = await runTask(task);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  deleteTask(req.params.id);
  res.status(204).end();
});

module.exports = { router, newTask };

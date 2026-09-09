const express = require("express");
const { readTasks, writeStatus, hasCredentials } = require("../sources/googleSheets");
const { listTasks, saveTask, getTask } = require("../db");
const { newTask } = require("./tasks");

const router = express.Router();

const DONE_STATUSES = ["done", "verify", "complete", "completed"];

router.get("/status", (req, res) => {
  res.json({
    credentialsConfigured: hasCredentials(),
    spreadsheetId: process.env.SHEET_ID || null,
  });
});

/**
 * Pulls the sheet in and creates a task for every row that isn't
 * already finished and isn't already tracked here. Existing tasks are
 * left alone so a sync never clobbers work in flight.
 */
router.post("/sync", async (req, res) => {
  const spreadsheetId = req.body.spreadsheetId || process.env.SHEET_ID;
  if (!spreadsheetId) {
    return res.status(400).json({ error: "spreadsheetId is required (or set SHEET_ID in the environment)" });
  }

  try {
    const { tasks: rows, columns } = await readTasks(spreadsheetId);
    const existing = listTasks();
    const created = [];
    const skipped = [];

    for (const row of rows) {
      if (DONE_STATUSES.includes(row.status.toLowerCase())) {
        skipped.push({ ref: row.ref, reason: `already ${row.status}` });
        continue;
      }
      const alreadyTracked = existing.some(
        (t) => t.spreadsheetId === spreadsheetId && t.sheetRow === row.sheetRow
      );
      if (alreadyTracked) {
        skipped.push({ ref: row.ref, reason: "already imported" });
        continue;
      }

      const task = newTask({
        ref: row.ref,
        title: row.task,
        description: row.task,
        platforms: row.platforms,
        sheetRow: row.sheetRow,
        spreadsheetId,
        source: "sheet",
      });
      saveTask(task);
      created.push(task);
    }

    res.json({ created: created.length, skipped, statusColumn: columns.status, tasks: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Writes a task's outcome back into the Status cell it came from. */
router.post("/push-status/:id", async (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (!task.spreadsheetId || !task.sheetRow) {
    return res.status(400).json({ error: "This task didn't come from a sheet row" });
  }

  const status = req.body.status || (task.status === "approved" ? "Done" : "verify");

  try {
    const { columns } = await readTasks(task.spreadsheetId);
    if (columns.status === undefined) {
      return res.status(400).json({ error: "No Status column found in that sheet" });
    }
    const cell = await writeStatus(task.spreadsheetId, task.sheetRow, columns.status, status);
    task.sheetStatusPushedAt = new Date().toISOString();
    saveTask(task);
    res.json({ cell, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };

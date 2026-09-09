const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const { saveTask } = require("../db");
const { newTask } = require("./tasks");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

function pickColumn(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase() === name);
    if (key && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

/**
 * Accepts a spreadsheet (xlsx/xls/csv) where each row is one task.
 * Recognized columns (case-insensitive, others are ignored):
 *   title, description/task, tags (comma-separated), agent
 * "description" (or "task") is required; everything else is optional
 * and falls back to auto-routing by tags.
 */
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required (field name: file)" });

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch (err) {
    return res.status(400).json({ error: `Could not parse spreadsheet: ${err.message}` });
  }

  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  const created = [];
  const skipped = [];

  rows.forEach((row, i) => {
    const description = pickColumn(row, ["description", "task", "task description"]);
    if (!description) {
      skipped.push({ row: i + 2, reason: "missing description/task column" });
      return;
    }
    const title = pickColumn(row, ["title", "name"]);
    const tagsRaw = pickColumn(row, ["tags", "tag", "category"]);
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const agentId = pickColumn(row, ["agent", "assignee"]) || undefined;

    try {
      const task = newTask({ title, description, tags, agentId: agentId || undefined });
      saveTask(task);
      created.push(task);
    } catch (err) {
      skipped.push({ row: i + 2, reason: err.message });
    }
  });

  res.status(201).json({ created: created.length, skipped, tasks: created });
});

module.exports = { router };

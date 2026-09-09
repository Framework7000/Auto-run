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
 * Accepts a spreadsheet (xlsx/xls/csv) where each row is one task —
 * the offline equivalent of the live Google Sheets sync.
 * Recognized columns (case-insensitive, others are ignored):
 *   s/n, title, description/task, platform (comma-separated for a chain)
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
    const ref = pickColumn(row, ["s/n", "sn", "id", "ref"]);
    const platformRaw = pickColumn(row, ["platform", "tool", "agent", "ai"]);
    const platforms = platformRaw
      ? platformRaw.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    try {
      const task = newTask({ ref, title, description, platforms });
      saveTask(task);
      created.push(task);
    } catch (err) {
      skipped.push({ row: i + 2, reason: err.message });
    }
  });

  res.status(201).json({ created: created.length, skipped, tasks: created });
});

module.exports = { router };

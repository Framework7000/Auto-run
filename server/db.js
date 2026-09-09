const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ tasks: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function listTasks() {
  return readDb().tasks;
}

function getTask(id) {
  return readDb().tasks.find((t) => t.id === id) || null;
}

function saveTask(task) {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === task.id);
  if (idx === -1) db.tasks.push(task);
  else db.tasks[idx] = task;
  writeDb(db);
  return task;
}

function deleteTask(id) {
  const db = readDb();
  db.tasks = db.tasks.filter((t) => t.id !== id);
  writeDb(db);
}

module.exports = { listTasks, getTask, saveTask, deleteTask };

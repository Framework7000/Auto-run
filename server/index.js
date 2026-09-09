const path = require("path");
const express = require("express");

const { router: tasksRouter } = require("./routes/tasks");
const { router: agentsRouter } = require("./routes/agents");
const { router: uploadRouter } = require("./routes/upload");
const { router: sheetRouter } = require("./routes/sheet");

const app = express();
const PORT = process.env.PORT || 4173;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/tasks", tasksRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/sheet", sheetRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Auto-Run dashboard running at http://localhost:${PORT}`);
});

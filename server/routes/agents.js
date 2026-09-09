const express = require("express");
const { listAgents } = require("../router");
const { getAdapter } = require("../adapters");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(listAgents());
});

router.get("/:id/status", async (req, res) => {
  try {
    const adapter = getAdapter(req.params.id);
    const loggedIn = await adapter.checkLoggedIn();
    res.json({ id: req.params.id, loggedIn });
  } catch (err) {
    res.status(500).json({ id: req.params.id, loggedIn: false, error: err.message });
  }
});

module.exports = { router };

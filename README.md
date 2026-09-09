# Auto-Run

A personal task orchestrator. Give it a task once (typed, or a whole spreadsheet
of them), it hands each one to whichever of your AI tools fits, drives that
tool through your own logged-in browser session, and brings the output back
to a dashboard where you approve it or send it back with feedback — which
re-runs the same task with your notes attached, until you're happy with it.

## ⚠️ Read this before pointing it at real accounts

This tool automates your tools by **driving a real browser you're already
logged into** — it does not use official APIs, and it does not store or
handle your passwords (you log in by hand, once; the browser session is
what's saved).

That approach means:

- **It likely violates the Terms of Service** of services like ChatGPT,
  Claude.ai, or Canva for automated/bot use. Enforcement varies, but the
  realistic risk is a flagged or locked account — including a work account,
  if that's what you point it at. Consider using a personal/non-critical
  account while testing.
- **It's fragile.** These sites change their UI regularly, and the CSS
  selectors this tool relies on (in `server/adapters/*.js`) will eventually
  go stale and need a small update. That's expected maintenance, not a bug.
- Prefer this over official APIs only when you specifically don't want to
  manage API keys/billing. If that changes, an API-based adapter is far more
  stable — happy to add one alongside this.

## What's in v0.1

- Web dashboard (`localhost:4173`) — create a task, watch its status, read
  the agent's output, Approve or Reject-with-feedback.
- Spreadsheet upload (`.xlsx`/`.csv`) — one row per task.
- Auto-routing — a task's `tags` are matched against each agent's declared
  strengths (see `server/config/agents.config.json`) to pick an agent, or you
  can assign one explicitly.
- Reject → feedback loop — rejecting a task appends your note to the prompt
  and re-runs it against the same agent; every attempt is kept in the task's
  history.
- Export — download the full report as Markdown or JSON at any time.
- Two working browser adapters: **Claude (claude.ai)** and **ChatGPT
  (chatgpt.com)**. Canva is stubbed out (see `docs/adding-an-agent.md`) since
  it's a design canvas, not a chat box, and needs different automation.

## Setup

```bash
npm install
npx playwright install chromium   # downloads the browser Auto-Run drives
```

### 1. Log in to each agent, once

This opens a real, visible browser window. Log in exactly as you normally
would (including any 2FA). The session is saved to
`data/browser-profiles/<agentId>/` and reused headlessly after that.

```bash
npm run login claude
npm run login chatgpt
```

Re-run the same command any time a session expires and task runs start
failing with "Not logged in".

### 2. Start the dashboard

```bash
npm start
```

Open http://localhost:4173.

## Using it

- **New task**: type a description, optionally tag it (`writing`,
  `analysis`, …) or pick an agent explicitly, click *Create task*.
- **Spreadsheet**: upload a file with a `description` (or `task`) column,
  plus optional `title`, `tags`, `agent` columns — each row becomes a task.
- Click a task to open it, then **Run** to send it to its agent.
- When the report comes back: **Approve** to close it out, or **Reject &
  send feedback** to type what should change — it re-runs immediately with
  your feedback folded in.
- **Export report** (top right) downloads everything as Markdown or JSON.

## Project layout

```
server/
  adapters/        browser-automation logic per agent (this is what breaks
                    when a site's UI changes — selectors are isolated at the
                    top of each file)
  routes/          REST API (tasks, agents, spreadsheet upload)
  config/          agents.config.json — add/edit agents and their routing tags
  router.js        picks an agent for a task based on tags
  taskRunner.js     runs a task, builds the feedback-aware prompt on re-run
  db.js            tiny JSON-file datastore (data/db.json)
public/            the dashboard (plain HTML/CSS/JS, no build step)
scripts/login.js    one-time manual login helper
docs/adding-an-agent.md   how to wire up another tool (Canva, Gemini, etc.)
```

## Known limitations

- `xlsx` (spreadsheet parsing) has known high-severity issues in the version
  published to npm; the maintainer ships fixes only via their own CDN. Risk
  is low here since you're only ever uploading your own files, but if you
  want the patched build: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`.
- One task runs at a time (no parallel queue yet) — clicking Run again while
  one is in flight will just queue behind it visually, not literally.
- No auth on the dashboard itself — it's meant to run on `localhost` for you
  alone. Don't expose port 4173 to the network without adding one.

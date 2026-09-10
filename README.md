# Auto-Run

Your task tracker already knows what needs doing and which tool should do
it. Auto-Run reads it, puts each task in front of the right agent, and
brings everything back as one thread you approve or send back.

```
Google Sheet (TaskTracker)
      |  pending rows, Platform column decides the route
      v
  Pipeline  --  Claude -> ChatGPT -> ...   (order in the cell is the order of work)
      |
      v
  Council thread  --  every agent's turn, one chat, one dot per agent
      |
      |  you approve, or send it back with a note
      v
  Status written back to the same sheet
```

## The Council

A task's whole life is one chronological thread: Claude's draft, the
question it asked, your answer, ChatGPT's design pass, your "make it
shorter", the revision. Each turn is dotted with the colour of whoever
produced it. It's the same data the pipeline runs on — not a separate
system, just the honest view of one.

## What's actually wired

| Sheet Platform | Runs on | State |
| --- | --- | --- |
| `Claude` | Anthropic API (`claude-opus-5`) | **Working** — unattended, no login to maintain |
| `Claude browser` | your logged-in claude.ai session | **Working** — uses a Max subscription instead of API billing |
| `ChatGPT` | your logged-in chatgpt.com session | **Working** — multi-account |
| `Canva` | — | Not wired ([why](./docs/adding-an-agent.md)) |
| `Antigravity` | — | Not wired ([why, and what to do instead](./docs/video-setup.md)) |

Multi-platform cells chain: `Claude, ChatGPT` means Claude writes the
content and ChatGPT works on what Claude produced.

## Things it handles because real work needs them

- **It asks instead of guessing.** When a brief is too thin to do good work
  ("Smart Lab" — which grade? which subject?), the agent comes back with
  specific questions rather than inventing an answer you'd have to throw
  away. You answer in the thread and it picks up where it left off.
- **It survives hitting your limits.** When an account runs out of quota,
  the task is parked with a resume time rather than failed — the thing you
  described as "if the limit reaches, it resets, then it does the work".
- **It sends work back.** Reject with a note and the same agent redoes that
  stage with your note attached. No round limit.
- **It doesn't route blindly.** An unrecognized platform name shows as
  `blocked` so you can see it, instead of being quietly sent to the wrong
  tool.

## Setup

See **[docs/setup.md](./docs/setup.md)**. Short version:

```bash
npm install
npx playwright install chromium
npm test                    # 24 tests, no credentials needed
export ANTHROPIC_API_KEY=sk-ant-...
npm run login chatgpt gradenext-go
npm start                   # http://localhost:4173
```

## Running it for real (always-on)

`npm start` runs in your terminal and stops when you close it — fine for
trying things out, not for a sheet that needs polling around the clock.
**[docs/deploy.md](./docs/deploy.md)** covers running it as a background
service on your own machine (via pm2), so it survives crashes and reboots
without you relaunching it. Your account logins stay on hardware you
control either way — nothing here needs a third-party server.

## ⚠️ Read this before pointing the browser agents at real accounts

The ChatGPT and Claude-browser agents work by **driving a real browser
you're already logged into**. You log in by hand once; the tool never sees
a password.

That approach has costs you should accept knowingly:

- **It likely violates those services' Terms of Service** for automated
  use. The realistic risk is a flagged or locked account — including a work
  account. Test with a non-critical account first.
- **It's fragile.** These sites change their UI, and the selectors at the
  top of each adapter in `server/adapters/` will eventually need a small
  update. Expected maintenance, not a bug.
- **The Claude API path has neither problem.** It's the supported way to do
  this, which is why the `claude` agent defaults to it.

Sharing another person's account (the sheet mentions a colleague's login)
is technically just another browser profile — but it's a conversation to
have with them first, not something to wire up quietly.

## Project layout

```
server/
  sources/googleSheets.js   read pending rows, write Status back
  pipeline.js               runs a task through its agents in order
  limits.js                 classifies failures; parks on rate limits
  router.js                 sheet Platform names -> agent ids
  adapters/                 one per tool; browser selectors isolated at the top
  routes/                   REST API
  config/agents.config.json agents, colours, accounts — edit this
public/                     dashboard + Council view (no build step)
test/                       24 tests, run with `npm test`
docs/                       setup, sheets, video, adding an agent
```

## Known limitations

- The Claude API path is written against the current API but **hasn't been
  executed against a live key** — it needs your key to prove out.
- Tasks run one at a time; there's no parallel queue yet.
- Parked (rate-limited) tasks record a resume time but need a re-run click;
  there's no background scheduler picking them up automatically yet.
- No auth on the dashboard — it's meant for `localhost`. Don't expose the
  port without adding some.
- `xlsx` (offline spreadsheet upload) has known advisories in the npm
  build; the live Google Sheets path doesn't use it. For the patched
  build: `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`.

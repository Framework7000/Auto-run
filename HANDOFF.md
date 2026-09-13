# Handoff — read this first

If you're a Claude Code session picking this project up fresh: read this whole
file before doing anything else. It's written so you need zero back-and-forth
with the user to know where things stand. If you're Aryan: this is what to
point a new session at so you don't have to re-explain anything.

**To resume in a new session:** `cd ~/Auto-run` (or wherever it's cloned),
open Claude Code, say "Read HANDOFF.md and continue from there."

Last updated: commit `408b90a` + this update, branch `claude/determined-gauss-a2vbsp`.

---

## Correction since last update: Canva access is real (not just a stub)

`docs/adding-an-agent.md` and `canvaAdapter.js` say Canva needs custom
per-workflow browser automation because it has no chat-shaped API. That's
still true for driving canva.com as a website — but it turns out a **Canva
MCP connector** exists and was live in the Claude Code Remote session this
was built in: `list-comments`, `read-design` (metadata, page content,
thumbnails, an editing transaction), `edit-design`, `resolve-shortlink`,
`generate-design`, `export-design`, and more — real API access, not
Playwright. Verified live: resolved a `canva.link` shortlink, read a real
12-page brochure's metadata and 6 real comment threads, read a t-shirt
design's full content and rendered its thumbnail.

**This does not carry over automatically to a local Claude Code CLI
session** — MCP connectors are configured per-client. A fresh local
session needs its own Canva MCP server set up (or the same claude.ai
connector auth, if the local CLI supports it) to get this same access;
don't assume it's there without checking. If this repo ever wants
programmatic Canva integration (as an alternative to the stubbed browser
adapter), this connector is the real path — worth designing
`canvaAdapter.js` around the MCP tool shapes instead of Playwright.

One real gap found: `list-comments` returns comment text but not which
page/position each comment is pinned to — fine for "here's what needs
fixing," not enough to auto-locate it on a 12-page document without
additional page-by-page comparison.

---

## What this is

Aryan runs content production for an ed-tech company (GradeNext). Work
arrives via a WhatsApp group; he logs it in a Google Sheet ("TaskTracker" —
columns S/n, Task, Platform, Status) that already says which AI tool should
handle each row (Claude, ChatGPT, Canva, Antigravity, or a chain like
"Claude, ChatGPT"). Auto-Run reads that sheet, runs each task through the
right tool(s) in order, keeps every agent's turn in one thread (the
"Council"), and writes the result's status back to the same sheet.

Real example rows from his actual sheet (seen live, mid-session):
```
T1  Smart Lab                    Claude          Pending
T3  Cognetry maths revieve       Claude          Pending
T4  3-8 slides                   Claude, ChatGPT Pending
T15 Video GN                     Antigravity     Pending
```

## Architecture

```
server/
  sources/googleSheets.js   reads pending rows, writes Status back (Sheets API,
                             service-account auth — see docs/google-sheets-setup.md)
  pipeline.js                runs a task through its agents in order, chains
                              output forward, handles the "ask instead of
                              guess" flow and rate-limit parking
  limits.js                  classifies failures (rate_limit / auth / transient
                              / fatal)
  router.js                  maps sheet Platform text -> agent ids (aliases,
                              case-insensitive)
  adapters/
    claudeApiAdapter.js       Claude leg — real Anthropic API call
                              (claude-opus-5, adaptive thinking). WORKS,
                              never tested with a live key in the sandbox
                              this was built in — first-run risk is low
                              (standard SDK usage) but unverified end-to-end.
    claudeAdapter.js          alternate Claude path via browser (claude.ai
                              login) instead of API billing — for using a
                              Max subscription instead of API credits
    chatgptAdapter.js         ChatGPT leg — browser automation (Playwright)
    baseAdapter.js            shared Playwright logic for both browser
                              adapters — profile-per-account, rate-limit
                              detection
    canvaAdapter.js           stub — Canva is a design canvas, not a chat,
                              needs its own per-workflow build (see
                              docs/adding-an-agent.md)
    videoAdapter.js           stub — Antigravity is a desktop app, can't be
                              browser-driven; the plan is to call a video API
                              directly instead (see docs/video-setup.md)
  config/agents.config.json  agent list, colors, per-agent accounts
  routes/                    REST API (tasks, sheet sync, upload)
public/                       the dashboard + Council thread UI (vanilla JS)
test/                         24 tests, `npm test` — no credentials needed,
                               all passing as of the last commit
docs/                         setup.md, google-sheets-setup.md, deploy.md
                               (pm2, own machine), cloud-deploy.md (Fly.io),
                               video-setup.md, adding-an-agent.md
Dockerfile / fly.toml         Fly.io deploy, build-tested locally in the
                               sandbox this was built in (image builds, server
                               boots, health check responds) — never actually
                               deployed to a real Fly account
ecosystem.config.js           pm2 config for running on Aryan's own machine
```

Also built, separately: **Council Desk**, a live Artifact (hosted on
claude.ai, not this repo) that demonstrates the Claude leg with zero setup —
no login, no key, runs on the viewer's own Claude account via the `sample`
capability. Seeded with one example task, real persistence via the `db`
capability.
**Link: https://claude.ai/code/artifact/b0abcda4-7571-4e34-94b1-63789aed4b92**
This is a scoped demo (Claude only — ChatGPT/Canva/Antigravity show
honestly as "not live here" since a hosted page has no way to reach them),
not a replacement for the real repo.

## What's verified vs. not

**Verified (tested live, in the sandbox this was built in):**
- Sheet parser against Aryan's *actual* sheet structure (12 tests) — header
  detection, platform routing, chaining, stopping before the summary table
- Pipeline logic (12 tests) — chaining, question/answer resume, rate-limit
  parking, feedback loop, all with fake adapters (no real credentials)
- Docker image: builds, boots, health check responds, credential-decode
  entrypoint works
- Live read of Aryan's real Google Sheet via a connected Google Drive tool
  in that sandbox (not via this repo's own Sheets integration — that
  integration is written but untested with real service-account creds)
- Chromium launches and Playwright's automation plumbing works (got as far
  as `page.goto` before that sandbox's network blocked the actual site)

**Not yet verified (needs Aryan's own machine/accounts):**
- `server/sources/googleSheets.js` against a real service-account key
- `claudeApiAdapter.js` against a real `ANTHROPIC_API_KEY`
- ChatGPT browser login end to end (see Current Blocker below)
- Fly.io deploy against a real Fly account
- pm2 always-on setup on Aryan's actual Mac

## Current blocker (as of last commit)

**ChatGPT login via Playwright fails at Google's OAuth step:**
`accounts.google.com` shows "Couldn't sign in — This browser or app may not
be secure" — Google detects the automated browser and refuses "Continue
with Google" specifically. Confirmed live via a screenshot from Aryan's own
Mac.

**Fix applied, pushed, not yet retried:** `server/adapters/baseAdapter.js`
now launches with `channel: "chrome"` (real installed Chrome, not
Playwright's bundled test Chromium) — commit `972c49e`. This is the
standard documented fix, not a stealth/evasion hack. Not guaranteed to
work — Google can still flag automation on any browser.

**Next step, exactly:** on Aryan's Mac, in the already-cloned repo at
`~/Auto-run` (confirmed via his terminal — zsh, Apple Silicon Mac, Node
already installed, `npm install` and `npx playwright install chromium`
already run successfully):
```
git pull
npm run login chatgpt personal-go
```
`personal-go` is the account id chosen for his "Aryan Singh · Go" ChatGPT
plan (seen logged in, in his regular browser, mid-session) — it's an
arbitrary label, not validated against `agents.config.json`, any string
works and creates its own profile folder.

**If `channel:"chrome"` still gets blocked:** two fallbacks, not yet tried:
1. On the ChatGPT/OpenAI login screen, use "Log in with email" (password)
   instead of "Continue with Google" — sidesteps Google's check entirely,
   if that account has a password set (some Google-only accounts don't).
2. Skip browser automation for ChatGPT entirely; build an OpenAI-API-based
   adapter instead (mirrors what `claudeApiAdapter.js` already does for
   Claude) — needs an OpenAI API key from Aryan (separate billing from his
   ChatGPT subscription, same caveat as the Anthropic key). Not yet built.

## Things already explained to Aryan — don't re-litigate, just carry forward

- **Browser-automation ToS/account-risk caveat**: automating logins to
  ChatGPT/Claude.ai/Canva likely breaks those services' ToS; realistic risk
  is a locked/flagged account. He's aware and chose to proceed anyway.
- **Antigravity can't be browser-driven** — it's a desktop app. Plan is a
  direct video-API call instead (`docs/video-setup.md`), not yet built —
  needs Aryan to pick a provider (cost implications).
- **Canva isn't a chat** — needs its own scripted workflow per use case,
  not a generic adapter. Not started.
- **This assistant has no access to Aryan's physical machine, ever** — this
  came up explicitly; he asked directly and was told plainly. Any session
  (cloud or local) still cannot type his passwords for him — that's a
  permanent human-in-the-loop step regardless of where Claude runs.
- **A fresh local Claude Code session on his Mac** *can* run terminal
  commands directly (no copy-paste needed) — that's the whole point of him
  moving to a local session — but still can't complete the login step
  itself.

## Everything sheet/link related

- Repo: `Framework7000/Auto-run`, branch `claude/determined-gauss-a2vbsp`
  (all work so far is on this branch, not yet merged to main; no PR opened —
  only create one if Aryan explicitly asks)
- Google Sheet ID (from his real TaskTracker, seen in the address bar):
  `1XmTxcshVporlikIHHBD2A0rlLoes-Aej9shc210v744`
- Council Desk artifact:
  `https://claude.ai/code/artifact/b0abcda4-7571-4e34-94b1-63789aed4b92`

## Immediate priority order for a fresh session

1. Get ChatGPT login working (see Current Blocker above) — this is what
   Aryan was mid-task on when handed off.
2. Once logged in, actually run a task end to end through the dashboard
   (`npm start`, http://localhost:4173) to prove the ChatGPT leg works,
   not just the login.
3. Get a real `ANTHROPIC_API_KEY` from Aryan and verify `claudeApiAdapter.js`
   against it (currently unverified).
4. Get real Google service-account credentials set up
   (`docs/google-sheets-setup.md`) and verify `googleSheets.js` against the
   real sheet — sync a real pending row, write a real status back.
5. Only after 1-4 are solid: revisit Fly.io deploy (if he still wants
   cloud hosting) or pm2 always-on (if own-machine).

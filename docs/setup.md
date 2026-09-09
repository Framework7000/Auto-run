# Setup

Four things to connect, in order of how much they buy you.

## 1. Install

```bash
npm install
npx playwright install chromium   # only needed for the browser agents
npm test                          # sanity check — should print 24 passed
```

## 2. The Claude worker (biggest win, least fragile)

The Claude-tagged rows run through the Anthropic API, not a browser. This
is the one leg that runs genuinely unattended — no login to keep alive, no
selectors to break, no rate-limit wall at 3am.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com/. Note this is **separate
billing** from a Claude Max subscription — the subscription doesn't include
API credits.

**If you'd rather use your existing Max subscription** instead of paying
for API usage, use the `claude-browser` agent instead: put `Claude browser`
in the sheet's Platform column (or edit `agents.config.json` to point the
`claude` id at `claudeAdapter`). It drives claude.ai through your logged-in
session — cheaper, but subject to the fragility and ToS caveats in the
README.

## 3. The browser agents (ChatGPT, and Claude-via-browser)

Log in once per account. A real browser window opens; you log in by hand
exactly as usual. Nothing but the browser ever sees your password.

```bash
npm run login chatgpt gradenext-go
npm run login chatgpt personal-plus
npm run login claude-browser gradenext
```

Each account gets its own saved profile under
`data/browser-profiles/<agent>/<account>/`, so two ChatGPT accounts don't
collide. Re-run the command whenever a session expires.

Accounts are declared in `server/config/agents.config.json` — edit that
list to match the accounts you actually use.

## 4. The sheet

See [google-sheets-setup.md](./google-sheets-setup.md).

## Run it

```bash
npm start
```

Then open http://localhost:4173.

## What still isn't wired

- **Canva** — a design canvas, not a chat box; needs a per-workflow adapter
  (see [adding-an-agent.md](./adding-an-agent.md)).
- **Video / Antigravity** — see [video-setup.md](./video-setup.md).

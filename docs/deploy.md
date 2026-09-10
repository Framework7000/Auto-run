# Running Auto-Run on your own machine, permanently

This gets Auto-Run running on a machine you control (your laptop, a home
PC, a spare box — anything that can stay powered on and connected), so
your ChatGPT/Claude login sessions never leave hardware you hold, and it
survives crashes and reboots without you re-launching it by hand.

Works the same way on Windows, macOS, and Linux — pm2 (the process
manager below) is cross-platform.

## 1. Prerequisites

- **Node.js 20 or newer.** Check with `node --version`. Get it from
  https://nodejs.org if you don't have it.
- **The machine needs to stay on and connected** whenever you want tasks to
  run — a laptop that sleeps when the lid closes won't run tasks overnight.
  (Windows/macOS power settings: disable sleep, or at least "sleep when
  plugged in only.")

## 2. Get the code

```bash
git clone https://github.com/Framework7000/Auto-run.git
cd Auto-run
npm install
npx playwright install chromium
npm test          # should print 24 passed — confirms the install is sound
```

## 3. Connect your credentials

Two things to set up before it can do real work — full detail in
[setup.md](./setup.md) and [google-sheets-setup.md](./google-sheets-setup.md):

```bash
# Claude — the leg that runs unattended
export ANTHROPIC_API_KEY=sk-ant-...

# Google Sheet — where tasks come from and status goes back to
# (put the downloaded service-account key at data/google-service-account.json,
#  share your sheet with its client_email — see google-sheets-setup.md)
export SHEET_ID=1XmTxcshVporlikIHHBD2A0rlLoes-Aej9shc210v744
```

Since these are `export`s, they only last the current terminal session.
To make them permanent, add both lines to your shell profile
(`~/.bashrc`, `~/.zshrc`) or, if you're using pm2 (below), put them in a
`.env`-style block at the bottom of `ecosystem.config.js`'s `env` object
instead — either works, just pick one so you don't set it twice.

Then log in to each browser account once (a real window opens — log in by
hand, exactly as usual):

```bash
npm run login chatgpt gradenext-go
npm run login chatgpt personal-plus
npm run login claude-browser gradenext
```

## 4. Install pm2 and start Auto-Run under it

pm2 is what keeps the server running: it restarts Auto-Run if it crashes,
and relaunches it automatically when the machine reboots.

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
```

Check it's actually up:

```bash
pm2 status          # should show "auto-run" as online
pm2 logs auto-run    # live log tail — ctrl+C to stop watching, it keeps running
```

Open **http://localhost:4173** — that's the dashboard, now running as a
background service.

## 5. Make it survive a reboot

```bash
pm2 startup
```

This prints a command specific to your OS — copy and run exactly what it
prints (it needs `sudo` on Linux/macOS to register the boot script). Then:

```bash
pm2 save
```

From now on, Auto-Run comes back up automatically whenever the machine
restarts.

## Day-to-day

```bash
pm2 status              # is it running?
pm2 logs auto-run       # watch what it's doing
pm2 restart auto-run    # after you edit agents.config.json, pull an update, etc.
pm2 stop auto-run       # stop it
```

To update to a newer version of the code:

```bash
git pull
npm install
pm2 restart auto-run
```

## A note on "always on"

The browser-agent logins (ChatGPT, Claude-browser) are tied to *this
machine's* saved session under `data/browser-profiles/`. If you move to a
different machine later, those accounts need `npm run login` again there —
sessions don't transfer. The Claude API leg has no such requirement; it
works from anywhere the API key is set.

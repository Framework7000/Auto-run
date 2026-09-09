# Connecting your Google Sheet

Auto-Run reads pending rows out of your TaskTracker sheet and writes the
Status column back when a task is done. This is a one-time setup.

A **service account** is used rather than a browser login flow, because
this needs to work unattended — a service account never expires, never
asks for a consent screen, and never needs someone to be at the keyboard.

## 1. Make a service account

1. Go to https://console.cloud.google.com/ and pick (or create) a project.
2. Enable the **Google Sheets API** for that project:
   APIs & Services → Library → search "Google Sheets API" → Enable.
3. APIs & Services → Credentials → **Create credentials** → **Service account**.
   Give it any name (e.g. `auto-run`), then Create and Continue → Done.
4. Click the new service account → **Keys** tab → Add key → Create new key
   → **JSON** → Create. A `.json` file downloads.

## 2. Drop the key in

Save that downloaded file as:

```
data/google-service-account.json
```

It's gitignored — it should never be committed.

## 3. Share the sheet with it

Open the JSON file and find the `client_email` field. It looks like:

```
auto-run@your-project-123456.iam.gserviceaccount.com
```

Then open your TaskTracker sheet in the browser, hit **Share**, paste that
email, and give it **Editor** access (Editor is required — Viewer would let
it read tasks but not write Status back).

This is the step people forget. The service account can only see sheets
that have been explicitly shared with it.

## 4. Point Auto-Run at the sheet

Either paste the sheet URL into the dashboard's Sheet box, or set it once
in the environment:

```bash
export SHEET_ID=1XmTxcshVporlikIHHBD2A0rlLoes-Aej9shc210v744
```

(That's the id from your sheet's URL — the part between `/d/` and `/edit`.)

## What Auto-Run expects in the sheet

It looks for a header row containing a **Task** column and a **Platform**
column; a **Status** column and an **S/n** column are used if present.
The header doesn't have to be row 1 — blank leading rows are fine, and it
stops reading at the first empty task row, so summary tables further down
are left alone.

The Platform cell can name more than one tool, comma-separated, and the
**order matters**: `Claude, ChatGPT` means Claude produces the content and
ChatGPT then works on what Claude produced.

Recognized platform names (case-insensitive): `Claude`, `ChatGPT`, `Canva`,
`Antigravity`, plus a few spelling variants. Anything unrecognized is
reported rather than guessed at — the task shows as `blocked` so you can
see it, instead of being quietly sent to the wrong tool.

# Deploying to Fly.io (hosted from GitHub, not your machine)

You chose this over the own-machine option, so it's worth restating the
tradeoff plainly: **your ChatGPT and Claude-browser login sessions will
live on Fly's servers**, not hardware you hold. That's the real
consequence of "host it from git" — a third party now custodies those
cookies. The Claude API leg (`ANTHROPIC_API_KEY`) doesn't have this
problem; it's just a key.

This has been built and smoke-tested locally (image builds, server boots,
health check responds, credential injection works) — what's below is the
verified path, not a guess. I can't run the `fly` commands themselves;
they need your Fly account.

## Why Fly, specifically

Most git-connected PaaS (Render's/Railway's simplest tiers, Vercel,
Heroku) run **ephemeral, stateless containers** — every deploy wipes the
filesystem. This app needs the opposite: `data/browser-profiles/` (login
sessions) and `data/db.json` (task state) must survive redeploys, or every
push logs you out of ChatGPT again. Fly.io supports real persistent
volumes with a straightforward CLI, which is what `fly.toml` here is
built around. (Render and Railway both also support volumes on paid tiers
if you'd rather use one of those — the same volume-mounting logic applies,
just through their dashboard instead of `fly.toml`.)

## 1. Install the CLI and log in

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

## 2. Launch the app (first time only)

From the repo root:

```bash
fly launch --no-deploy
```

Say **no** to "Would you like to set up a Postgres database" and any other
add-ons — none are needed. It'll detect `fly.toml` and `Dockerfile` and
ask to confirm the app name and region.

## 3. Create the persistent volume

Must match the `source` name in `fly.toml` (`auto_run_data`) and be in the
**same region** you launched in:

```bash
fly volumes create auto_run_data --size 1 --region iad
```

(1GB is plenty — browser profiles and the task db are small.)

## 4. Set your secrets

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set SHEET_ID=1XmTxcshVporlikIHHBD2A0rlLoes-Aej9shc210v744
fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=$(base64 -w0 < path/to/your-service-account.json)
```

(`base64 -w0` on Linux; on macOS use `base64 -i path/to/your-service-account.json`
without `-w0`, or `| tr -d '\n'`.) The entrypoint script decodes this back
into `data/google-service-account.json` on container start — see
`docker-entrypoint.sh`.

## 5. Deploy

```bash
fly deploy
```

Watch it build and ship. Once it's up:

```bash
fly status
fly open      # opens the dashboard in your browser
```

## 6. The part that's actually hard: logging in on a headless server

`npm run login <agent>` opens a **visible browser window** for you to log
in by hand — Fly's machines have no display. You can't do this step
directly on Fly. Two ways around it:

### Option A (recommended) — log in locally, upload the session

1. On your own computer, clone the repo and run the login flow normally
   (see [setup.md](./setup.md)):
   ```bash
   npm install && npx playwright install chromium
   npm run login chatgpt gradenext-go
   npm run login chatgpt personal-plus
   npm run login claude-browser gradenext
   ```
   This creates `data/browser-profiles/<agent>/<account>/` locally.
2. Upload those folders onto the Fly volume:
   ```bash
   fly ssh sftp shell
   # inside the sftp shell:
   put -r data/browser-profiles /app/data/browser-profiles
   ```
   (Run this from your repo root so the relative path resolves.)
3. Restart the app so it picks up the uploaded sessions:
   ```bash
   fly apps restart auto-run
   ```

Repeat step 1-2 whenever a session expires — there's no way around
occasionally needing a real display to re-authenticate.

### Option B — a remote virtual display on the Fly machine itself

Possible (`xvfb` + a VNC bridge in the container so you can see and click
a "headless" browser remotely), but it's a meaningfully bigger build —
a second container process, a way to reach it securely, and cleanup after
each login. Worth it only if re-uploading profiles from your own machine
(Option A) becomes a real recurring hassle. Say the word if you want this
built instead.

## Ongoing deploys

Once set up, shipping a change is:

```bash
git push                # to GitHub, as usual
fly deploy               # builds from the current directory and ships
```

There's no auto-deploy-on-push wired up yet — `fly deploy` is a manual
step each time. If you want true "push to GitHub, it deploys itself,"
that's a Fly GitHub Actions workflow (`fly.io/docs/launch/continuous-deployment-with-github-actions/`) —
say so and I'll add the `.github/workflows/fly-deploy.yml` for it.

## Cost

Fly's free allowance doesn't stretch to a 1GB-memory always-on machine
(Chromium needs the headroom — see `fly.toml`'s `[[vm]]` block). Expect a
small monthly charge (single-digit dollars) once you're past free credits.
Check current pricing at fly.io/docs/about/pricing before deploying.

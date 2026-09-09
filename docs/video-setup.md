# The video rows (a.k.a. the Antigravity problem)

Your sheet routes video work (`T15 Video GN`) to **Antigravity**. Auto-Run
can't drive Antigravity, and it's worth being precise about why, because it
isn't a limitation that more engineering effort fixes cheaply.

## Why Antigravity can't be driven the way ChatGPT is

Every other agent here is a **website**. Auto-Run drives websites with
Playwright: it opens a real browser, types into the page, reads the reply.
That whole mechanism only exists for things running in a browser tab.

Antigravity is a **desktop application**. There's no page to attach to.
Automating it would mean OS-level UI automation — driving mouse and
keyboard against a native window, with no stable selectors, breaking on
every window-size or version change. That is a substantially harder and
far more brittle category of automation than what the rest of this project
does.

## The recommendation instead

Antigravity is a middleman here: you drive Antigravity, and Antigravity
calls a video-generation service. Auto-Run can call that service directly
and skip the middleman — same finished video, no desktop app to puppet.

## Wiring it up

`server/adapters/videoAdapter.js` is the slot. It's deliberately left
unimplemented rather than guessed, because which service to call is a
decision with real per-render cost, and every provider has a different
request shape.

To implement it:

1. Pick a video API (Google Veo / Flow, or another provider you already pay
   for).
2. Implement `submit(promptText)` in `videoAdapter.js`: send the prompt,
   poll until the render finishes, and return
   `{ output: "<url or file path of the finished video>" }`.
3. Remove `"disabled": true` from the `antigravity` entry in
   `server/config/agents.config.json`.

Once that returns a URL, video rows flow through the same pipeline as
everything else: run → land in the Council thread → you approve or send
back with feedback → Status writes back to the sheet.

## The one case where it's still manual

If a video job genuinely needs Antigravity's own agentic behaviour — it
building a project folder, writing files, iterating on a local scene — then
that's Antigravity doing work no video API replicates, and that row stays
a human-in-the-loop job. Auto-Run can still track it and hold the output;
it just won't press the buttons.

# Adding another agent

Two shapes of agent fit this system differently.

## Chat-style tools (easy — copy the existing pattern)

If the tool is basically "type a message, get a text reply" (ChatGPT, Claude,
Gemini, Perplexity, ...), copy `server/adapters/claudeAdapter.js` as a
starting point:

1. Create `server/adapters/<name>Adapter.js` extending `BaseAdapter`.
2. Open the site yourself, find (via your browser's inspector):
   - the message input element
   - the send button
   - something reliable that appears while it's generating and disappears
     when it's done (a "stop" button is usually the most stable signal)
   - the container each reply renders in
3. Fill in the `SELECTORS` object at the top of the file with those.
4. Implement `checkLoggedIn()` and `submit(promptText)` following the
   existing pattern (`submit` returns `{ output: string }`).
5. Register the class in `server/adapters/index.js`'s `ADAPTER_CLASSES` map.
6. Add an entry to `server/config/agents.config.json`:
   ```json
   {
     "id": "gemini",
     "name": "Gemini",
     "adapter": "geminiAdapter",
     "url": "https://gemini.google.com/app",
     "tags": ["writing", "research"],
     "color": "#4285f4"
   }
   ```
7. `npm run login gemini`, then it shows up in the dashboard automatically.

Selectors *will* need occasional updates when a site redesigns — that's
normal maintenance, not a design flaw. Keeping them isolated in `SELECTORS`
at the top of each file is what makes that a two-line fix instead of a hunt.

## Canvas / editor-style tools (harder — needs custom logic)

Canva, Figma, and similar tools don't have a single "prompt in, reply out"
shape — a task might mean "open this template," "swap this text layer," "add
this image," "export as PNG." There's no generic `submit()` that makes sense.

To wire one of these up:

1. Decide what a "task" means for this tool in your workflow (e.g. "generate
   a social post from a template with this headline and image").
2. Write `submit(promptText)` as a short scripted sequence of Playwright
   actions for that specific workflow, not a generic prompt-response loop —
   you'll likely want to parse `promptText` for the pieces you need (e.g.
   `headline: ...`, `image: ...`) rather than pasting it into one box.
3. Decide what "the output" is for this tool — probably a link to the
   created design, or an exported file path — and return that as `output`.

This is real per-workflow engineering, which is why Canva ships as a stub
(`server/adapters/canvaAdapter.js`) rather than a guess. Happy to help build
a specific one once you know which Canva workflow you actually want
automated.

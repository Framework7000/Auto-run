#!/usr/bin/env node
/**
 * One-time (or occasional, once a session expires) manual login for a
 * browser agent. Opens a real, visible browser window pointed at the
 * agent's site; you log in by hand exactly like any other day. The
 * session is saved to data/browser-profiles/<agentId> and reused
 * headlessly by every future task run — this script never sees or
 * stores your password itself, the browser profile does.
 *
 * Usage: npm run login <agentId>   e.g. npm run login claude
 */
const readline = require("readline");
const { listAgents, getAgent } = require("../server/router");
const { getAdapter } = require("../server/adapters");

async function main() {
  const agentId = process.argv[2];
  if (!agentId) {
    console.log("Usage: npm run login <agentId>");
    console.log("Available agents:");
    for (const a of listAgents()) {
      console.log(`  - ${a.id}${a.disabled ? " (not automated yet)" : ""}`);
    }
    process.exit(1);
  }

  const config = getAgent(agentId);
  if (!config) {
    console.error(`Unknown agent "${agentId}".`);
    process.exit(1);
  }
  if (config.disabled) {
    console.error(`Agent "${agentId}" isn't automated yet: ${config.note || ""}`);
    process.exit(1);
  }

  const adapter = getAdapter(agentId);
  const page = await adapter.openContext({ headless: false });
  await page.goto(config.url, { waitUntil: "domcontentloaded" });

  console.log(`\nA browser window opened to ${config.url}`);
  console.log("Log in there exactly as you normally would.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("\nOnce you're logged in, press Enter here... ", resolve));
  rl.close();

  const loggedIn = await adapter.checkLoggedIn();
  console.log(loggedIn ? `\n✔ Session saved for "${agentId}".` : `\n⚠ Doesn't look logged in yet — you can rerun this command.`);

  await adapter.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

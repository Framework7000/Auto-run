const path = require("path");
const { chromium } = require("playwright");
const { BROWSER_LIMIT_PHRASES } = require("../limits");

const PROFILES_DIR = path.join(__dirname, "..", "..", "data", "browser-profiles");

/**
 * Base class for "browser agents": tools with no official API that we
 * drive through a real, persistently-logged-in browser profile.
 *
 * Each agent gets its own profile directory, so logging in once (via
 * `npm run login <agentId>`) keeps that session for every future run —
 * this file never sees or stores a password.
 */
class BaseAdapter {
  constructor(agentConfig, accountId = "default") {
    this.config = agentConfig;
    this.accountId = accountId;
    this.profileDir = path.join(PROFILES_DIR, agentConfig.id, accountId);
  }

  /**
   * Launches (or reuses) a persistent browser context for this agent.
   * headless:false is required for the one-time manual login; normal
   * task runs default to headless using the saved session.
   *
   * channel:"chrome" runs the real, locally-installed Chrome instead of
   * Playwright's bundled test Chromium. Google's sign-in flow actively
   * blocks that bundled build ("This browser or app may not be secure")
   * — it does not reliably accept real Chrome either, but this is the
   * standard, documented fix (not a stealth trick), and is worth trying
   * first. Requires Chrome to already be installed on this machine.
   */
  async openContext({ headless = true } = {}) {
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless,
      channel: "chrome",
      viewport: { width: 1280, height: 900 },
    });
    this.page = this.context.pages()[0] || (await this.context.newPage());
    return this.page;
  }

  /**
   * Chat UIs answer "you're out of quota" with a banner, not an error.
   * Surfacing it as a thrown error with the site's own wording lets
   * limits.js classify it as a rate limit and park the task, instead
   * of the run failing with a confusing "couldn't find the composer".
   */
  async assertNotRateLimited(page) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const lower = bodyText.toLowerCase();
    const hit = BROWSER_LIMIT_PHRASES.find((phrase) => lower.includes(phrase));
    if (hit) {
      throw new Error(`${this.config.name} reports a usage limit ("${hit}").`);
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }

  // Subclasses must implement:
  //   async submit(promptText, { priorOutput }) -> { output, needsInput? }
  //   async checkLoggedIn() -> returns boolean
  async submit(_promptText) {
    throw new Error(`${this.config.id} adapter does not implement submit()`);
  }

  async checkLoggedIn() {
    throw new Error(`${this.config.id} adapter does not implement checkLoggedIn()`);
  }
}

module.exports = { BaseAdapter, PROFILES_DIR };

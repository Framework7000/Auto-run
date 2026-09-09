const path = require("path");
const { chromium } = require("playwright");

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
  constructor(agentConfig) {
    this.config = agentConfig;
    this.profileDir = path.join(PROFILES_DIR, agentConfig.id);
  }

  /**
   * Launches (or reuses) a persistent browser context for this agent.
   * headless:false is required for the one-time manual login; normal
   * task runs default to headless using the saved session.
   */
  async openContext({ headless = true } = {}) {
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless,
      viewport: { width: 1280, height: 900 },
    });
    this.page = this.context.pages()[0] || (await this.context.newPage());
    return this.page;
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }

  // Subclasses must implement:
  //   async submit(promptText) -> returns { output: string }
  //   async checkLoggedIn() -> returns boolean
  async submit(_promptText) {
    throw new Error(`${this.config.id} adapter does not implement submit()`);
  }

  async checkLoggedIn() {
    throw new Error(`${this.config.id} adapter does not implement checkLoggedIn()`);
  }
}

module.exports = { BaseAdapter, PROFILES_DIR };

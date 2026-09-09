const { BaseAdapter } = require("./baseAdapter");

/**
 * Selectors live here, isolated, because this is the part that WILL
 * break whenever chatgpt.com ships a redesign. If task runs start
 * failing, this is the first place to look — open the site, inspect
 * the input box / send button / response bubble, and update below.
 */
const SELECTORS = {
  composer: "#prompt-textarea",
  sendButton: 'button[data-testid="send-button"]',
  stopButton: 'button[data-testid="stop-button"]',
  lastResponse: '[data-message-author-role="assistant"]:last-of-type',
  loggedOutMarker: 'text=/log in|sign up/i',
};

const RESPONSE_TIMEOUT_MS = 120_000;

class ChatgptAdapter extends BaseAdapter {
  async checkLoggedIn() {
    const page = this.page || (await this.openContext());
    await page.goto(this.config.url, { waitUntil: "domcontentloaded" });
    const loggedOut = await page.locator(SELECTORS.loggedOutMarker).first().isVisible().catch(() => false);
    return !loggedOut;
  }

  async submit(promptText) {
    const page = this.page || (await this.openContext());
    await page.goto(this.config.url, { waitUntil: "domcontentloaded" });

    if (!(await this.checkLoggedIn())) {
      throw new Error(
        `Not logged in to ChatGPT. Run "npm run login chatgpt" first, log in by hand, then retry.`
      );
    }

    const composer = page.locator(SELECTORS.composer).first();
    await composer.waitFor({ state: "visible", timeout: 20_000 });
    await composer.click();
    await composer.fill(promptText);

    const sendButton = page.locator(SELECTORS.sendButton).first();
    await sendButton.click();

    await page
      .locator(SELECTORS.stopButton)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    await page
      .locator(SELECTORS.stopButton)
      .first()
      .waitFor({ state: "hidden", timeout: RESPONSE_TIMEOUT_MS })
      .catch(() => {});

    const responses = page.locator(SELECTORS.lastResponse);
    const count = await responses.count();
    if (count === 0) {
      throw new Error("Could not find ChatGPT's response on the page (selectors may be outdated).");
    }
    const output = await responses.nth(count - 1).innerText();
    return { output: output.trim() };
  }
}

module.exports = ChatgptAdapter;

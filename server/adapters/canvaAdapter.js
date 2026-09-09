const { BaseAdapter } = require("./baseAdapter");

/**
 * Canva is a design canvas, not a chat box — there's no single
 * "composer + response" pair to automate the way Claude/ChatGPT have.
 * Driving it well means scripting specific actions (open a template,
 * swap text/images, export) rather than "submit a prompt, read a
 * reply". Left unimplemented on purpose; see docs/adding-an-agent.md.
 */
class CanvaAdapter extends BaseAdapter {
  async checkLoggedIn() {
    throw new Error("Canva adapter not implemented yet — see docs/adding-an-agent.md");
  }

  async submit(_promptText) {
    throw new Error("Canva adapter not implemented yet — see docs/adding-an-agent.md");
  }
}

module.exports = CanvaAdapter;

/**
 * The "Antigravity" rows in the sheet are video jobs. Antigravity
 * itself is a desktop app, so there is no page to drive — the working
 * substitute is to call a video-generation API directly and hand back
 * the resulting URL, which gets the same row to Done without puppeting
 * a desktop app.
 *
 * Left deliberately unimplemented rather than guessed: which service
 * to call is the user's decision (it costs money per render), and each
 * one has a different request shape. docs/video-setup.md covers what
 * to fill in here.
 */
class VideoAdapter {
  constructor(agentConfig, accountId = "default") {
    this.config = agentConfig;
    this.accountId = accountId;
  }

  async checkLoggedIn() {
    return false;
  }

  async submit(_promptText) {
    throw new Error(
      "Video generation is not wired up yet. Pick a video API and implement submit() in " +
        "server/adapters/videoAdapter.js — see docs/video-setup.md. " +
        "Note: the Antigravity desktop app itself cannot be driven this way."
    );
  }

  async close() {}
}

module.exports = VideoAdapter;

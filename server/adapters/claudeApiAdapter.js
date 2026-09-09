const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const HOUSE_STYLE_PATH = path.join(__dirname, "..", "..", "data", "house-style.md");
const MODEL = "claude-opus-5";
const NEEDS_INPUT_MARKER = "NEEDS_INPUT:";

const BASE_SYSTEM = `You are the production worker for GradeNext's task pipeline. You are handed one real work item at a time — curriculum design, chapter content, lesson material, review of existing material — and you produce the finished deliverable, not a description of what you would produce.

Rules:
1. Produce the actual work. If the task is "write the Class 8 algebra chapter", output the chapter, not an outline of one (unless an outline is what was asked for).
2. If the brief is genuinely too thin to produce good work — you don't know the grade level, subject, length, or format, and guessing would waste the reviewer's time — then instead of guessing, reply with ONLY a line starting "${NEEDS_INPUT_MARKER}" followed by your specific questions, numbered. Ask only what actually blocks you. Do not ask questions you could reasonably answer yourself.
3. Never do both. Either you have enough to work with and you produce the deliverable, or you ask.
4. Format deliverables as clean Markdown so they can be exported or handed to a design step afterwards.`;

function loadHouseStyle() {
  if (!fs.existsSync(HOUSE_STYLE_PATH)) return null;
  const text = fs.readFileSync(HOUSE_STYLE_PATH, "utf-8").trim();
  return text || null;
}

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Builds the system prompt with the stable parts first, so the cached
 * prefix stays byte-identical across tasks. The per-task brief goes in
 * the user message, never in here.
 */
function buildSystem() {
  const houseStyle = loadHouseStyle();
  const blocks = [{ type: "text", text: BASE_SYSTEM }];
  if (houseStyle) {
    blocks.push({ type: "text", text: `GradeNext house style — follow this:\n\n${houseStyle}` });
  }
  blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  return blocks;
}

class ClaudeApiAdapter {
  constructor(agentConfig) {
    this.config = agentConfig;
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!hasCredentials()) {
        throw new Error(
          "No Anthropic credentials found. Set ANTHROPIC_API_KEY (or run `ant auth login`) " +
            "so the Claude worker can run unattended. See docs/setup.md"
        );
      }
      this.client = new Anthropic();
    }
    return this.client;
  }

  async checkLoggedIn() {
    return hasCredentials();
  }

  /**
   * Runs one task. `priorOutput` carries the previous stage's result
   * when this is a later step in a chained row (e.g. "Claude, ChatGPT").
   */
  async submit(promptText, { priorOutput } = {}) {
    const client = this.getClient();

    const userContent = priorOutput
      ? `${promptText}\n\n--- Output from the previous step, build on it ---\n${priorOutput}`
      : promptText;

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: buildSystem(),
      messages: [{ role: "user", content: userContent }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      const detail = message.stop_details ? ` (${message.stop_details.category})` : "";
      throw new Error(`Claude declined this request${detail}. Rephrase the task and retry.`);
    }

    const output = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!output) {
      throw new Error("Claude returned no text output.");
    }

    if (output.startsWith(NEEDS_INPUT_MARKER)) {
      return {
        output: output.slice(NEEDS_INPUT_MARKER.length).trim(),
        needsInput: true,
        usage: message.usage,
      };
    }

    return { output, needsInput: false, usage: message.usage };
  }

  async close() {}
}

module.exports = ClaudeApiAdapter;
module.exports.hasCredentials = hasCredentials;
module.exports.NEEDS_INPUT_MARKER = NEEDS_INPUT_MARKER;

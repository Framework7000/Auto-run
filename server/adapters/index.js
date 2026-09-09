const ClaudeAdapter = require("./claudeAdapter");
const ChatgptAdapter = require("./chatgptAdapter");
const CanvaAdapter = require("./canvaAdapter");
const { getAgent } = require("../router");

const ADAPTER_CLASSES = {
  claudeAdapter: ClaudeAdapter,
  chatgptAdapter: ChatgptAdapter,
  canvaAdapter: CanvaAdapter,
};

const instances = new Map();

/**
 * Returns a singleton adapter instance per agent so its browser
 * context (and therefore its logged-in session) is reused across
 * task runs instead of relaunching a browser every time.
 */
function getAdapter(agentId) {
  if (instances.has(agentId)) return instances.get(agentId);

  const agentConfig = getAgent(agentId);
  if (!agentConfig) throw new Error(`Unknown agent: ${agentId}`);

  const AdapterClass = ADAPTER_CLASSES[agentConfig.adapter];
  if (!AdapterClass) throw new Error(`No adapter class registered for: ${agentConfig.adapter}`);

  const instance = new AdapterClass(agentConfig);
  instances.set(agentId, instance);
  return instance;
}

module.exports = { getAdapter, ADAPTER_CLASSES };

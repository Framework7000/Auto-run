const ClaudeAdapter = require("./claudeAdapter");
const ClaudeApiAdapter = require("./claudeApiAdapter");
const ChatgptAdapter = require("./chatgptAdapter");
const CanvaAdapter = require("./canvaAdapter");
const VideoAdapter = require("./videoAdapter");
const { getAgent } = require("../router");

const ADAPTER_CLASSES = {
  claudeAdapter: ClaudeAdapter,
  claudeApiAdapter: ClaudeApiAdapter,
  chatgptAdapter: ChatgptAdapter,
  canvaAdapter: CanvaAdapter,
  videoAdapter: VideoAdapter,
};

const instances = new Map();

/**
 * One adapter instance per (agent, account) pair, cached — so a
 * browser agent keeps its logged-in context alive across tasks
 * instead of relaunching a browser for every run, and two accounts on
 * the same tool stay in separate profiles.
 */
function getAdapter(agentId, accountId) {
  const agentConfig = getAgent(agentId);
  if (!agentConfig) throw new Error(`Unknown agent: ${agentId}`);

  const account = accountId || (agentConfig.accounts && agentConfig.accounts[0]?.id) || "default";
  const key = `${agentId}::${account}`;
  if (instances.has(key)) return instances.get(key);

  const AdapterClass = ADAPTER_CLASSES[agentConfig.adapter];
  if (!AdapterClass) throw new Error(`No adapter class registered for: ${agentConfig.adapter}`);

  const instance = new AdapterClass(agentConfig, account);
  instances.set(key, instance);
  return instance;
}

async function closeAll() {
  for (const instance of instances.values()) {
    if (typeof instance.close === "function") await instance.close().catch(() => {});
  }
  instances.clear();
}

module.exports = { getAdapter, closeAll, ADAPTER_CLASSES };

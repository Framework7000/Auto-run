const agentsConfig = require("./config/agents.config.json");

function listAgents() {
  return agentsConfig.agents;
}

function getAgent(agentId) {
  return agentsConfig.agents.find((a) => a.id === agentId) || null;
}

/**
 * Maps whatever the sheet's Platform column actually says onto an
 * agent id. People type "ChatGPT", "chat gpt", "Antigravity" — match
 * on declared aliases rather than demanding exact ids in the sheet.
 * Returns null for anything unrecognized so the caller can surface it
 * instead of silently routing the task to the wrong tool.
 */
function resolvePlatform(platformText) {
  const normalized = String(platformText || "").trim().toLowerCase();
  if (!normalized) return null;

  for (const agent of agentsConfig.agents) {
    if (agent.id === normalized) return agent.id;
    if ((agent.aliases || []).includes(normalized)) return agent.id;
  }
  return null;
}

/**
 * Turns a sheet row's platform list into an ordered pipeline of agent
 * ids. "Claude, ChatGPT" means Claude produces the content and
 * ChatGPT works on what Claude produced — order is meaningful.
 */
function resolvePipeline(platforms = []) {
  const resolved = [];
  const unknown = [];
  for (const platform of platforms) {
    const agentId = resolvePlatform(platform);
    if (agentId) resolved.push(agentId);
    else unknown.push(platform);
  }
  return { platforms: resolved, unknown };
}

module.exports = { listAgents, getAgent, resolvePlatform, resolvePipeline };

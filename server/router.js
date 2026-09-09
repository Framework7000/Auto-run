const agentsConfig = require("./config/agents.config.json");

function listAgents() {
  return agentsConfig.agents;
}

function getAgent(agentId) {
  return agentsConfig.agents.find((a) => a.id === agentId) || null;
}

/**
 * Picks the best agent for a task by matching its tags against each
 * agent's declared strengths. Falls back to the configured default.
 */
function pickAgent(tags = []) {
  const candidates = agentsConfig.agents.filter((a) => !a.disabled);
  if (tags.length === 0) {
    return candidates.find((a) => a.id === agentsConfig.defaultAgentId) || candidates[0];
  }

  let best = null;
  let bestScore = -1;
  for (const agent of candidates) {
    const score = tags.filter((t) => agent.tags.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }
  if (bestScore <= 0) {
    return candidates.find((a) => a.id === agentsConfig.defaultAgentId) || candidates[0];
  }
  return best;
}

module.exports = { listAgents, getAgent, pickAgent };

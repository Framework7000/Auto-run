/**
 * Every tool in this pipeline runs out of quota sooner or later — the
 * API returns 429, the chat UIs put up a "you've hit your limit, come
 * back at 4pm" wall. A run that dies on that is a run you have to
 * babysit, so we classify the failure and park the task until the
 * limit is likely to have reset instead of burning the attempt.
 */

const BROWSER_LIMIT_PHRASES = [
  "you've reached your limit",
  "you have reached your limit",
  "message limit reached",
  "rate limit",
  "usage limit",
  "try again later",
  "come back later",
  "limit will reset",
  "out of free messages",
];

const DEFAULT_LIMIT_WAIT_MS = 60 * 60 * 1000; // 1 hour
const MAX_INLINE_WAIT_MS = 60 * 1000; // wait inline at most a minute; longer waits park the task

function parseRetryAfter(err) {
  const header =
    err?.headers?.["retry-after"] ||
    err?.headers?.get?.("retry-after") ||
    err?.response?.headers?.["retry-after"];
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

/**
 * Buckets an error into how the pipeline should react.
 *   rate_limit -> park (or short-wait) and resume automatically
 *   auth       -> stop and tell the human; retrying will not help
 *   transient  -> worth an immediate retry
 *   fatal      -> record and stop
 */
function classifyError(err) {
  const message = String(err?.message || err || "");
  const lower = message.toLowerCase();
  const status = err?.status ?? err?.statusCode;

  if (status === 429) {
    return { kind: "rate_limit", waitMs: parseRetryAfter(err) ?? DEFAULT_LIMIT_WAIT_MS, message };
  }
  if (status === 401 || status === 403 || lower.includes("not logged in") || lower.includes("no anthropic credentials")) {
    return { kind: "auth", waitMs: 0, message };
  }
  if (BROWSER_LIMIT_PHRASES.some((phrase) => lower.includes(phrase))) {
    return { kind: "rate_limit", waitMs: DEFAULT_LIMIT_WAIT_MS, message };
  }
  if (status >= 500 || lower.includes("timeout") || lower.includes("econnreset") || lower.includes("socket hang up")) {
    return { kind: "transient", waitMs: 5000, message };
  }
  return { kind: "fatal", waitMs: 0, message };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { classifyError, sleep, MAX_INLINE_WAIT_MS, DEFAULT_LIMIT_WAIT_MS, BROWSER_LIMIT_PHRASES };

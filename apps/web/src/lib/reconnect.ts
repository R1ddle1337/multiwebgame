export interface ReconnectBackoffConfig {
  baseMs?: number;
  maxMs?: number;
  jitterRatio?: number;
}

const DEFAULT_BASE_MS = 800;
const DEFAULT_MAX_MS = 15_000;
const DEFAULT_JITTER_RATIO = 0.25;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function nextReconnectDelay(
  attempt: number,
  config: ReconnectBackoffConfig = {},
  random: () => number = Math.random
): number {
  const baseMs = config.baseMs ?? DEFAULT_BASE_MS;
  const maxMs = config.maxMs ?? DEFAULT_MAX_MS;
  const jitterRatio = clamp(config.jitterRatio ?? DEFAULT_JITTER_RATIO, 0, 0.9);

  const exponent = Math.max(0, Math.min(attempt, 8));
  const rawDelay = Math.min(maxMs, baseMs * 2 ** exponent);
  const jitterWindow = rawDelay * jitterRatio;
  const jitter = (random() * 2 - 1) * jitterWindow;

  return Math.max(250, Math.round(rawDelay + jitter));
}

export function isHeartbeatStale(lastPongAt: number, now: number, timeoutMs: number): boolean {
  return now - lastPongAt > timeoutMs;
}

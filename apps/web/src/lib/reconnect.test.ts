import { describe, expect, it } from 'vitest';

import { isHeartbeatStale, nextReconnectDelay } from './reconnect';

describe('nextReconnectDelay', () => {
  it('grows exponentially and respects max delay', () => {
    expect(nextReconnectDelay(0, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0 }, () => 0.5)).toBe(1000);
    expect(nextReconnectDelay(1, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0 }, () => 0.5)).toBe(2000);
    expect(nextReconnectDelay(2, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0 }, () => 0.5)).toBe(4000);
    expect(nextReconnectDelay(9, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0 }, () => 0.5)).toBe(20000);
  });

  it('adds bounded jitter around baseline', () => {
    const low = nextReconnectDelay(2, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0.25 }, () => 0);
    const high = nextReconnectDelay(2, { baseMs: 1000, maxMs: 20_000, jitterRatio: 0.25 }, () => 1);

    expect(low).toBe(3000);
    expect(high).toBe(5000);
  });
});

describe('isHeartbeatStale', () => {
  it('detects stale heartbeat based on timeout threshold', () => {
    expect(isHeartbeatStale(1_000, 5_500, 4_000)).toBe(true);
    expect(isHeartbeatStale(1_000, 5_000, 4_000)).toBe(false);
  });
});

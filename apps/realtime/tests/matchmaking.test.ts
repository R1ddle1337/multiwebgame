import { describe, expect, it } from 'vitest';

import { MatchmakingQueue } from '../src/matchmaking.js';

describe('MatchmakingQueue', () => {
  it('pairs only connected users by game type', () => {
    const queue = new MatchmakingQueue();
    queue.join('u1', 'gomoku', 0);
    queue.join('u2', 'xiangqi', 1);
    queue.join('u3', 'gomoku', 2);

    const pair = queue.popPair('gomoku');
    expect(pair?.map((entry) => entry.userId)).toEqual(['u1', 'u3']);
    expect(queue.getQueueSize()).toBe(1);
  });

  it('times out queued users', () => {
    const queue = new MatchmakingQueue({ timeoutMs: 10_000 });
    queue.join('u1', 'go', 0);

    const events = queue.sweep(10_001);
    expect(events).toEqual([
      {
        type: 'timed_out',
        userId: 'u1',
        gameType: 'go'
      }
    ]);
    expect(queue.getQueueSize()).toBe(0);
  });

  it('keeps disconnected entries during grace period and drops afterward', () => {
    const queue = new MatchmakingQueue({ timeoutMs: 90_000, reconnectGraceMs: 15_000 });
    queue.join('u1', 'gomoku', 0);
    queue.markDisconnected('u1', 5_000);

    expect(queue.sweep(19_999)).toEqual([]);
    const events = queue.sweep(20_001);

    expect(events).toEqual([
      {
        type: 'dropped_disconnect',
        userId: 'u1',
        gameType: 'gomoku'
      }
    ]);
  });

  it('cancels an entry explicitly', () => {
    const queue = new MatchmakingQueue();
    queue.join('u1', 'xiangqi', 0);
    const removed = queue.leave('u1');

    expect(removed?.userId).toBe('u1');
    expect(queue.getQueueSize()).toBe(0);
  });

  it('restores queue connection state when reconnected', () => {
    const queue = new MatchmakingQueue({ reconnectGraceMs: 20_000 });
    queue.join('u1', 'go', 0);
    queue.markDisconnected('u1', 1_000);
    queue.markReconnected('u1');

    const events = queue.sweep(25_000);
    expect(events).toEqual([]);

    const pair = queue.popPair('go');
    expect(pair).toBeNull();
    queue.join('u2', 'go', 26_000);

    const finalPair = queue.popPair('go');
    expect(finalPair?.map((entry) => entry.userId)).toEqual(['u1', 'u2']);
  });
});

import { describe, expect, it } from 'vitest';

import { aggregateReconnectState } from '../src/reconnect-state.js';

describe('aggregateReconnectState', () => {
  it('aggregates reconnect keys, lobby subscription and room ids across sockets', () => {
    const snapshot = aggregateReconnectState([
      {
        reconnectKey: 'k1',
        lobbySubscribed: false,
        roomIds: ['r1', 'r2']
      },
      {
        reconnectKey: 'k2',
        lobbySubscribed: true,
        roomIds: ['r2', 'r3']
      }
    ]);

    expect(new Set(snapshot.reconnectKeys)).toEqual(new Set(['k1', 'k2']));
    expect(snapshot.lobbySubscribed).toBe(true);
    expect(new Set(snapshot.roomIds)).toEqual(new Set(['r1', 'r2', 'r3']));
  });
});

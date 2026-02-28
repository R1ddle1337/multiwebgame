import { beforeEach, describe, expect, it, vi } from 'vitest';

const { poolQueryMock, queryMock, withTransactionMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const poolQueryMock = vi.fn();
  const withTransactionMock = vi.fn(async (fn: (client: { query: typeof queryMock }) => Promise<unknown>) =>
    fn({ query: queryMock })
  );

  return { poolQueryMock, queryMock, withTransactionMock };
});

vi.mock('../src/db.js', () => ({
  pool: { query: poolQueryMock },
  withTransaction: withTransactionMock
}));

import { createPostgresStore } from '../src/store/postgres-store.js';

function normalizeSql(sql: unknown): string {
  if (typeof sql !== 'string') {
    return String(sql);
  }

  return sql.replace(/\s+/g, ' ').trim();
}

describe('postgres store regressions', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    queryMock.mockReset();
    withTransactionMock.mockClear();
  });

  it('casts abandoned match reason to text during empty-room lifecycle reconciliation', async () => {
    queryMock.mockImplementation(async (sql: unknown) => {
      const normalized = normalizeSql(sql);

      if (normalized.includes('SELECT id FROM rooms WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'room-1' }], rowCount: 1 };
      }

      if (normalized.includes('UPDATE room_players') && normalized.includes('RETURNING id')) {
        return { rows: [{ id: 'room-player-1' }], rowCount: 1 };
      }

      if (normalized.includes('SELECT id, host_user_id, game_type FROM rooms WHERE id = $1 FOR UPDATE')) {
        return {
          rows: [{ id: 'room-1', host_user_id: 'host-1', game_type: 'gomoku' }],
          rowCount: 1
        };
      }

      if (normalized.includes('SELECT user_id, role, seat, joined_at FROM room_players')) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.includes('UPDATE matches SET')) {
        return { rows: [], rowCount: 1 };
      }

      if (normalized.includes("UPDATE rooms SET status = 'closed' WHERE id = $1")) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${normalized}`);
    });

    const store = createPostgresStore();
    const room = await store.leaveRoom('room-1', 'host-1');

    expect(room).toBeNull();

    const abandonCall = queryMock.mock.calls.find(([sql]) =>
      normalizeSql(sql).includes('UPDATE matches SET')
    );
    if (!abandonCall) {
      throw new Error('Expected abandon query to execute');
    }

    const [sql, params] = abandonCall;
    expect(normalizeSql(sql)).toContain("jsonb_build_object('abandonedReason', $2::text)");
    expect(params).toEqual(['room-1', 'room_empty']);
  });
});

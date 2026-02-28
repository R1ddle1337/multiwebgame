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
  pool: {
    query: poolQueryMock,
    end: vi.fn()
  },
  withTransaction: withTransactionMock
}));

import { closeIdleRooms } from '../src/repository.js';

function normalizeSql(sql: unknown): string {
  if (typeof sql !== 'string') {
    return String(sql);
  }

  return sql.replace(/\s+/g, ' ').trim();
}

describe('idle room close queries', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    queryMock.mockReset();
    withTransactionMock.mockClear();
  });

  it('closes only open rooms that are idle and have no active match', async () => {
    queryMock.mockImplementation(async (sql: unknown) => {
      const normalized = normalizeSql(sql);

      if (normalized.startsWith("UPDATE rooms r SET status = 'closed'")) {
        return { rows: [{ id: 'room-1' }], rowCount: 1 };
      }

      if (normalized.startsWith('UPDATE invite_links')) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${normalized}`);
    });

    const closedRoomIds = await closeIdleRooms(30);
    expect(closedRoomIds).toEqual(['room-1']);

    const closeCall = queryMock.mock.calls.find(([sql]) =>
      normalizeSql(sql).startsWith("UPDATE rooms r SET status = 'closed'")
    );
    if (!closeCall) {
      throw new Error('Expected room-close query to execute');
    }

    const [closeSql, closeParams] = closeCall;
    const normalizedCloseSql = normalizeSql(closeSql);
    expect(normalizedCloseSql).toContain("WHERE r.status = 'open'");
    expect(normalizedCloseSql).toContain("r.last_active_at < NOW() - ($1::int * INTERVAL '1 minute')");
    expect(normalizedCloseSql).toContain("WHERE m.room_id = r.id AND m.status = 'active'");
    expect(closeParams).toEqual([30]);

    const invalidateCall = queryMock.mock.calls.find(([sql]) =>
      normalizeSql(sql).startsWith('UPDATE invite_links')
    );
    expect(invalidateCall).toBeTruthy();
    expect(invalidateCall?.[1]).toEqual([['room-1']]);
  });

  it('skips invite invalidation when no room is closed', async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });

    const closedRoomIds = await closeIdleRooms(30);
    expect(closedRoomIds).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

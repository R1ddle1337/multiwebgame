export type MatchmakingGameType =
  | 'gomoku'
  | 'santorini'
  | 'onitama'
  | 'battleship'
  | 'yahtzee'
  | 'domination'
  | 'love_letter'
  | 'codenames_duet'
  | 'xiangqi'
  | 'go'
  | 'connect4'
  | 'reversi'
  | 'dots'
  | 'backgammon'
  | 'cards'
  | 'quoridor'
  | 'hex'
  | 'liars_dice'
  | 'texas_holdem';

export interface QueueEntry {
  userId: string;
  gameType: MatchmakingGameType;
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface MatchmakingTimeoutEvent {
  type: 'timed_out';
  userId: string;
  gameType: MatchmakingGameType;
}

export interface MatchmakingDisconnectedDropEvent {
  type: 'dropped_disconnect';
  userId: string;
  gameType: MatchmakingGameType;
}

export type MatchmakingEvent = MatchmakingTimeoutEvent | MatchmakingDisconnectedDropEvent;

export interface MatchmakingQueueOptions {
  timeoutMs?: number;
  reconnectGraceMs?: number;
}

export class MatchmakingQueue {
  private readonly timeoutMs: number;

  private readonly reconnectGraceMs: number;

  private readonly order: string[] = [];

  private readonly byUserId = new Map<string, QueueEntry>();

  constructor(options: MatchmakingQueueOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.reconnectGraceMs = options.reconnectGraceMs ?? 60_000;
  }

  join(userId: string, gameType: MatchmakingGameType, now = Date.now()): QueueEntry {
    const existing = this.byUserId.get(userId);
    if (existing) {
      const updated: QueueEntry = {
        ...existing,
        gameType,
        joinedAt: now,
        connected: true,
        disconnectedAt: null
      };
      this.byUserId.set(userId, updated);
      this.removeFromOrder(userId);
      this.order.push(userId);
      return updated;
    }

    const entry: QueueEntry = {
      userId,
      gameType,
      joinedAt: now,
      connected: true,
      disconnectedAt: null
    };

    this.byUserId.set(userId, entry);
    this.order.push(userId);
    return entry;
  }

  leave(userId: string): QueueEntry | null {
    const entry = this.byUserId.get(userId) ?? null;
    if (!entry) {
      return null;
    }

    this.byUserId.delete(userId);
    this.removeFromOrder(userId);
    return entry;
  }

  markDisconnected(userId: string, now = Date.now()): QueueEntry | null {
    const entry = this.byUserId.get(userId) ?? null;
    if (!entry) {
      return null;
    }

    const updated: QueueEntry = {
      ...entry,
      connected: false,
      disconnectedAt: now
    };

    this.byUserId.set(userId, updated);
    return updated;
  }

  markReconnected(userId: string): QueueEntry | null {
    const entry = this.byUserId.get(userId) ?? null;
    if (!entry) {
      return null;
    }

    const updated: QueueEntry = {
      ...entry,
      connected: true,
      disconnectedAt: null
    };

    this.byUserId.set(userId, updated);
    return updated;
  }

  getQueueSize(gameType?: MatchmakingGameType): number {
    if (!gameType) {
      return this.byUserId.size;
    }

    let count = 0;
    for (const entry of this.byUserId.values()) {
      if (entry.gameType === gameType) {
        count += 1;
      }
    }

    return count;
  }

  getEntry(userId: string): QueueEntry | null {
    return this.byUserId.get(userId) ?? null;
  }

  popPair(gameType: MatchmakingGameType): [QueueEntry, QueueEntry] | null {
    const users: QueueEntry[] = [];

    for (const userId of this.order) {
      const entry = this.byUserId.get(userId);
      if (!entry) {
        continue;
      }

      if (!entry.connected || entry.gameType !== gameType) {
        continue;
      }

      users.push(entry);
      if (users.length === 2) {
        break;
      }
    }

    if (users.length < 2) {
      return null;
    }

    for (const entry of users) {
      this.byUserId.delete(entry.userId);
      this.removeFromOrder(entry.userId);
    }

    return [users[0], users[1]];
  }

  sweep(now = Date.now()): MatchmakingEvent[] {
    const events: MatchmakingEvent[] = [];

    for (const userId of [...this.order]) {
      const entry = this.byUserId.get(userId);
      if (!entry) {
        this.removeFromOrder(userId);
        continue;
      }

      const queuedFor = now - entry.joinedAt;
      if (queuedFor >= this.timeoutMs) {
        this.byUserId.delete(userId);
        this.removeFromOrder(userId);
        events.push({
          type: 'timed_out',
          userId: entry.userId,
          gameType: entry.gameType
        });
        continue;
      }

      if (!entry.connected && entry.disconnectedAt && now - entry.disconnectedAt >= this.reconnectGraceMs) {
        this.byUserId.delete(userId);
        this.removeFromOrder(userId);
        events.push({
          type: 'dropped_disconnect',
          userId: entry.userId,
          gameType: entry.gameType
        });
      }
    }

    return events;
  }

  private removeFromOrder(userId: string): void {
    let index = this.order.indexOf(userId);
    while (index !== -1) {
      this.order.splice(index, 1);
      index = this.order.indexOf(userId);
    }
  }
}

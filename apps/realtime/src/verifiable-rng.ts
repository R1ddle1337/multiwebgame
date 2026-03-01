import { createHash, randomBytes } from 'crypto';

function asHex(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '');
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function createServerSeedHex(): string {
  return randomBytes(32).toString('hex');
}

export function createSeedCommit(seedHex: string): string {
  return sha256Hex(Buffer.from(asHex(seedHex), 'hex'));
}

export function createPlayerNonceCommit(nonce: string): string {
  return sha256Hex(nonce);
}

export function verifyPlayerNonceCommit(commit: string, nonce: string): boolean {
  return asHex(commit) === createPlayerNonceCommit(nonce);
}

export function deriveRngSeed(params: {
  serverSeedHex: string;
  nonces?: string[];
  nonceP1?: string;
  nonceP2?: string;
  matchId: string;
}): string {
  const serverSeed = Buffer.from(asHex(params.serverSeedHex), 'hex');
  const nonces =
    params.nonces && params.nonces.length > 0
      ? [...params.nonces]
      : [params.nonceP1 ?? '', params.nonceP2 ?? ''];
  const payload = Buffer.concat([
    serverSeed,
    ...nonces.map((nonce) => Buffer.from(nonce, 'utf8')),
    Buffer.from(params.matchId, 'utf8')
  ]);
  return sha256Hex(payload);
}

export type VerifiableRngPhase = 'awaiting_commits' | 'awaiting_reveals' | 'ready';

export interface VerifiableRngSession {
  matchId: string;
  serverSeedHex: string;
  serverSeedCommit: string;
  playerOrder: string[];
  playerCommits: Record<string, string | null>;
  playerNonces: Record<string, string | null>;
  rngSeed: string | null;
  phase: VerifiableRngPhase;
  revealDeadlineAt: number | null;
  revealTimeoutMs: number;
}

export type VerifiableRngActionError =
  | 'phase_mismatch'
  | 'not_a_match_player'
  | 'invalid_commit'
  | 'commit_already_submitted'
  | 'commit_not_submitted'
  | 'reveal_already_submitted'
  | 'commit_mismatch';

export interface VerifiableRngActionResult {
  accepted: boolean;
  session: VerifiableRngSession;
  reason?: VerifiableRngActionError;
}

export interface VerifiableRngPayload {
  serverSeed: string;
  serverSeedCommit: string;
  commits: Record<string, string | null>;
  nonces: Record<string, string | null>;
  rngSeed: string | null;
}

function normalizeCommitHex(commit: string): string {
  const normalized = asHex(commit);
  return normalized.length === 64 ? normalized : '';
}

function cloneSession(session: VerifiableRngSession): VerifiableRngSession {
  return {
    ...session,
    playerOrder: [...session.playerOrder],
    playerCommits: { ...session.playerCommits },
    playerNonces: { ...session.playerNonces }
  };
}

function isMatchPlayer(session: VerifiableRngSession, userId: string): boolean {
  return session.playerOrder.includes(userId);
}

export function createVerifiableRngSession(params: {
  matchId: string;
  playerOneUserId?: string;
  playerTwoUserId?: string;
  playerUserIds?: string[];
  revealTimeoutMs?: number;
  serverSeedHex?: string;
}): VerifiableRngSession {
  const revealTimeoutMs =
    Number.isInteger(params.revealTimeoutMs) && (params.revealTimeoutMs ?? 0) > 0
      ? (params.revealTimeoutMs as number)
      : 30_000;

  const serverSeedHex = asHex(params.serverSeedHex ?? createServerSeedHex());
  const serverSeedCommit = createSeedCommit(serverSeedHex);
  const uniquePlayerIds = new Set<string>();
  const playerOrder = (
    params.playerUserIds && params.playerUserIds.length > 0
      ? params.playerUserIds
      : [params.playerOneUserId ?? '', params.playerTwoUserId ?? '']
  )
    .filter((userId) => typeof userId === 'string' && userId.trim().length > 0)
    .filter((userId) => {
      if (uniquePlayerIds.has(userId)) {
        return false;
      }
      uniquePlayerIds.add(userId);
      return true;
    });

  if (playerOrder.length < 2) {
    throw new Error('invalid_rng_player_count');
  }

  const playerCommits: Record<string, string | null> = {};
  const playerNonces: Record<string, string | null> = {};
  for (const userId of playerOrder) {
    playerCommits[userId] = null;
    playerNonces[userId] = null;
  }

  return {
    matchId: params.matchId,
    serverSeedHex,
    serverSeedCommit,
    playerOrder,
    playerCommits,
    playerNonces,
    rngSeed: null,
    phase: 'awaiting_commits',
    revealDeadlineAt: null,
    revealTimeoutMs
  };
}

export function applyPlayerCommit(
  session: VerifiableRngSession,
  userId: string,
  commit: string,
  now = Date.now()
): VerifiableRngActionResult {
  const next = cloneSession(session);

  if (next.phase !== 'awaiting_commits') {
    return { accepted: false, session: next, reason: 'phase_mismatch' };
  }

  if (!isMatchPlayer(next, userId)) {
    return { accepted: false, session: next, reason: 'not_a_match_player' };
  }

  const normalizedCommit = normalizeCommitHex(commit);
  if (!normalizedCommit) {
    return { accepted: false, session: next, reason: 'invalid_commit' };
  }

  if (next.playerCommits[userId]) {
    return { accepted: false, session: next, reason: 'commit_already_submitted' };
  }

  next.playerCommits[userId] = normalizedCommit;

  const allCommitted = next.playerOrder.every((userId) => typeof next.playerCommits[userId] === 'string');
  if (allCommitted) {
    next.phase = 'awaiting_reveals';
    next.revealDeadlineAt = now + next.revealTimeoutMs;
  }

  return {
    accepted: true,
    session: next
  };
}

export function applyPlayerReveal(
  session: VerifiableRngSession,
  userId: string,
  nonce: string
): VerifiableRngActionResult {
  const next = cloneSession(session);

  if (next.phase !== 'awaiting_reveals') {
    return { accepted: false, session: next, reason: 'phase_mismatch' };
  }

  if (!isMatchPlayer(next, userId)) {
    return { accepted: false, session: next, reason: 'not_a_match_player' };
  }

  const expectedCommit = next.playerCommits[userId];
  if (!expectedCommit) {
    return { accepted: false, session: next, reason: 'commit_not_submitted' };
  }

  if (next.playerNonces[userId] !== null) {
    return { accepted: false, session: next, reason: 'reveal_already_submitted' };
  }

  if (!verifyPlayerNonceCommit(expectedCommit, nonce)) {
    return { accepted: false, session: next, reason: 'commit_mismatch' };
  }

  next.playerNonces[userId] = nonce;

  const allRevealed = next.playerOrder.every((userId) => next.playerNonces[userId] !== null);
  if (allRevealed) {
    next.rngSeed = deriveRngSeed({
      serverSeedHex: next.serverSeedHex,
      nonces: next.playerOrder.map((userId) => next.playerNonces[userId] ?? ''),
      matchId: next.matchId
    });
    next.phase = 'ready';
    next.revealDeadlineAt = null;
  }

  return {
    accepted: true,
    session: next
  };
}

export function isRevealTimedOut(session: VerifiableRngSession, now = Date.now()): boolean {
  return (
    session.phase === 'awaiting_reveals' &&
    session.revealDeadlineAt !== null &&
    session.revealDeadlineAt <= now
  );
}

export function buildRngPayload(session: VerifiableRngSession): VerifiableRngPayload {
  return {
    serverSeed: session.serverSeedHex,
    serverSeedCommit: session.serverSeedCommit,
    commits: { ...session.playerCommits },
    nonces: { ...session.playerNonces },
    rngSeed: session.rngSeed
  };
}

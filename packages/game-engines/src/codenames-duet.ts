import type {
  CodenamesDuetCellRole,
  CodenamesDuetClue,
  CodenamesDuetMove,
  CodenamesDuetMoveInput,
  CodenamesDuetPlayer,
  CodenamesDuetState
} from '@multiwebgame/shared-types';

const BOARD_SIZE = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

const WORD_POOL = [
  'anchor',
  'apple',
  'arrow',
  'atlas',
  'badge',
  'bank',
  'beach',
  'bear',
  'bell',
  'bridge',
  'cabin',
  'camera',
  'camp',
  'candle',
  'castle',
  'cell',
  'circle',
  'cloud',
  'copper',
  'court',
  'crane',
  'crown',
  'desert',
  'diamond',
  'draft',
  'drill',
  'eagle',
  'engine',
  'field',
  'flame',
  'forest',
  'fork',
  'garden',
  'ghost',
  'globe',
  'gold',
  'grace',
  'harbor',
  'hawk',
  'helmet',
  'hotel',
  'ice',
  'island',
  'ivory',
  'jacket',
  'jungle',
  'kernel',
  'key',
  'kit',
  'ladder',
  'laser',
  'leaf',
  'lemon',
  'light',
  'line',
  'map',
  'market',
  'mask',
  'mint',
  'mirror',
  'needle',
  'net',
  'night',
  'oasis',
  'ocean',
  'olive',
  'orbit',
  'palm',
  'paper',
  'pearl',
  'pilot',
  'planet',
  'plate',
  'pond',
  'port',
  'prism',
  'pump',
  'queen',
  'radar',
  'rail',
  'ring',
  'river',
  'rocket',
  'rose',
  'salt',
  'scale',
  'shadow',
  'shield',
  'signal',
  'silver',
  'smoke',
  'snack',
  'solar',
  'spring',
  'star',
  'stone',
  'storm',
  'sugar',
  'table',
  'temple',
  'thread',
  'tower',
  'track',
  'trail',
  'valley',
  'violet',
  'voice',
  'wave',
  'wheel',
  'wind',
  'wing',
  'yard',
  'zebra'
] as const;

function otherPlayer(player: CodenamesDuetPlayer): CodenamesDuetPlayer {
  return player === 'black' ? 'white' : 'black';
}

function isRole(value: unknown): value is CodenamesDuetCellRole {
  return value === 'agent' || value === 'neutral' || value === 'assassin';
}

function validateRoles(roles: CodenamesDuetCellRole[]): boolean {
  if (roles.length !== CELL_COUNT) {
    return false;
  }

  let agents = 0;
  let assassins = 0;
  for (const role of roles) {
    if (!isRole(role)) {
      return false;
    }
    if (role === 'agent') {
      agents += 1;
    } else if (role === 'assassin') {
      assassins += 1;
    }
  }

  return agents === 9 && assassins === 1;
}

function cloneClue(clue: CodenamesDuetClue | null): CodenamesDuetClue | null {
  if (!clue) {
    return null;
  }

  return {
    word: clue.word,
    count: clue.count,
    by: clue.by,
    remainingGuesses: clue.remainingGuesses
  };
}

function keyForPlayer(
  state: CodenamesDuetRuntimeState,
  player: CodenamesDuetPlayer
): CodenamesDuetCellRole[] {
  return player === 'black' ? state.keyBlack : state.keyWhite;
}

function isTargetCell(state: CodenamesDuetRuntimeState, index: number): boolean {
  return state.keyBlack[index] === 'agent' || state.keyWhite[index] === 'agent';
}

function isAssassinCell(state: CodenamesDuetRuntimeState, index: number): boolean {
  return state.keyBlack[index] === 'assassin' || state.keyWhite[index] === 'assassin';
}

function allTargetsFound(state: CodenamesDuetRuntimeState): boolean {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (isTargetCell(state, index) && !state.revealed[index]) {
      return false;
    }
  }

  return true;
}

function computeTargetCounts(state: CodenamesDuetRuntimeState): { total: number; found: number } {
  let total = 0;
  let found = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!isTargetCell(state, index)) {
      continue;
    }

    total += 1;
    if (state.revealed[index]) {
      found += 1;
    }
  }

  return { total, found };
}

function revealedRoleAt(state: CodenamesDuetRuntimeState, index: number): CodenamesDuetCellRole | null {
  if (!state.revealed[index]) {
    return null;
  }

  if (isAssassinCell(state, index)) {
    return 'assassin';
  }

  if (isTargetCell(state, index)) {
    return 'agent';
  }

  return 'neutral';
}

function endGuessTurn(state: CodenamesDuetRuntimeState): CodenamesDuetRuntimeState {
  const turnsRemaining = state.turnsRemaining - 1;
  if (turnsRemaining <= 0) {
    return {
      ...state,
      turnsRemaining: 0,
      phase: 'clue',
      activeClue: null,
      status: 'completed',
      outcome: 'out_of_turns'
    };
  }

  return {
    ...state,
    turnsRemaining,
    currentCluer: otherPlayer(state.currentCluer),
    phase: 'clue',
    activeClue: null
  };
}

export interface CodenamesDuetRuntimeState {
  boardSize: number;
  words: string[];
  keyBlack: CodenamesDuetCellRole[];
  keyWhite: CodenamesDuetCellRole[];
  revealed: boolean[];
  turnsRemaining: number;
  currentCluer: CodenamesDuetPlayer;
  phase: 'clue' | 'guess';
  activeClue: CodenamesDuetClue | null;
  status: 'playing' | 'completed';
  outcome: 'success' | 'assassin' | 'out_of_turns' | null;
  moveCount: number;
}

export interface CreateCodenamesDuetStateOptions {
  words: string[];
  keyBlack: CodenamesDuetCellRole[];
  keyWhite: CodenamesDuetCellRole[];
  turns?: number;
  startingCluer?: CodenamesDuetPlayer;
}

export interface ApplyCodenamesDuetMoveResult {
  accepted: boolean;
  nextState: CodenamesDuetRuntimeState;
  reason?: string;
}

export function createCodenamesDuetWordPool(): string[] {
  return WORD_POOL.map((word) => word);
}

export function createCodenamesDuetRolePool(): CodenamesDuetCellRole[] {
  return [
    'agent',
    'agent',
    'agent',
    'agent',
    'agent',
    'agent',
    'agent',
    'agent',
    'agent',
    'assassin',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral',
    'neutral'
  ];
}

export function createCodenamesDuetState(
  options: CreateCodenamesDuetStateOptions
): CodenamesDuetRuntimeState {
  if (!Array.isArray(options.words) || options.words.length !== CELL_COUNT) {
    throw new Error('invalid_words');
  }

  const wordSet = new Set(options.words.map((word) => word.trim().toLowerCase()));
  if (wordSet.size !== CELL_COUNT) {
    throw new Error('duplicate_words');
  }

  if (!Array.isArray(options.keyBlack) || !validateRoles(options.keyBlack)) {
    throw new Error('invalid_black_key');
  }

  if (!Array.isArray(options.keyWhite) || !validateRoles(options.keyWhite)) {
    throw new Error('invalid_white_key');
  }

  const turns = options.turns ?? 9;
  if (!Number.isInteger(turns) || turns <= 0) {
    throw new Error('invalid_turn_count');
  }

  return {
    boardSize: BOARD_SIZE,
    words: options.words.map((word) => word.trim()),
    keyBlack: options.keyBlack.map((role) => role),
    keyWhite: options.keyWhite.map((role) => role),
    revealed: Array.from({ length: CELL_COUNT }, () => false),
    turnsRemaining: turns,
    currentCluer: options.startingCluer ?? 'black',
    phase: 'clue',
    activeClue: null,
    status: 'playing',
    outcome: null,
    moveCount: 0
  };
}

export function normalizeCodenamesDuetMove(
  move: CodenamesDuetMoveInput,
  player: CodenamesDuetPlayer
): CodenamesDuetMove {
  if (move.type === 'clue') {
    return {
      type: 'clue',
      word: move.word,
      count: move.count,
      player
    };
  }

  if (move.type === 'guess') {
    return {
      type: 'guess',
      index: move.index,
      player
    };
  }

  return {
    type: 'end_guesses',
    player
  };
}

export function toCodenamesDuetPublicState(
  state: CodenamesDuetRuntimeState,
  viewer: CodenamesDuetPlayer | null,
  revealAllKeys: boolean
): CodenamesDuetState {
  const key = revealAllKeys ? null : viewer ? keyForPlayer(state, viewer).map((role) => role) : null;
  const revealedRoles = Array.from({ length: CELL_COUNT }, (_, index) => revealedRoleAt(state, index));

  return {
    boardSize: state.boardSize,
    words: state.words.map((word) => word),
    revealed: state.revealed.map((cell) => cell),
    revealedRoles,
    turnsRemaining: state.turnsRemaining,
    currentCluer: state.currentCluer,
    currentGuesser: otherPlayer(state.currentCluer),
    phase: state.phase,
    activeClue: cloneClue(state.activeClue),
    status: state.status,
    outcome: state.outcome,
    moveCount: state.moveCount,
    key,
    keyBlack: revealAllKeys ? state.keyBlack.map((role) => role) : null,
    keyWhite: revealAllKeys ? state.keyWhite.map((role) => role) : null,
    targetCounts: computeTargetCounts(state)
  };
}

export function applyCodenamesDuetMove(
  state: CodenamesDuetRuntimeState,
  move: CodenamesDuetMove
): ApplyCodenamesDuetMoveResult {
  if (state.status !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'match_is_not_active'
    };
  }

  if (move.type === 'clue') {
    if (state.phase !== 'clue') {
      return {
        accepted: false,
        nextState: state,
        reason: 'not_clue_phase'
      };
    }

    if (move.player !== state.currentCluer) {
      return {
        accepted: false,
        nextState: state,
        reason: 'out_of_turn'
      };
    }

    const word = move.word.trim();
    if (!word) {
      return {
        accepted: false,
        nextState: state,
        reason: 'invalid_clue_word'
      };
    }

    if (!Number.isInteger(move.count) || move.count <= 0 || move.count > 9) {
      return {
        accepted: false,
        nextState: state,
        reason: 'invalid_clue_count'
      };
    }

    return {
      accepted: true,
      nextState: {
        ...state,
        phase: 'guess',
        activeClue: {
          word,
          count: move.count,
          by: move.player,
          remainingGuesses: move.count + 1
        },
        moveCount: state.moveCount + 1
      }
    };
  }

  const guesser = otherPlayer(state.currentCluer);
  if (move.player !== guesser) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_turn'
    };
  }

  if (state.phase !== 'guess' || !state.activeClue) {
    return {
      accepted: false,
      nextState: state,
      reason: 'not_guess_phase'
    };
  }

  if (move.type === 'end_guesses') {
    const ended = endGuessTurn({
      ...state,
      moveCount: state.moveCount + 1
    });

    return {
      accepted: true,
      nextState: ended
    };
  }

  if (!Number.isInteger(move.index) || move.index < 0 || move.index >= CELL_COUNT) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_bounds'
    };
  }

  if (state.revealed[move.index]) {
    return {
      accepted: false,
      nextState: state,
      reason: 'already_revealed'
    };
  }

  const revealed = state.revealed.map((cell) => cell);
  revealed[move.index] = true;

  const clueKey = keyForPlayer(state, state.currentCluer);
  const clueRole = clueKey[move.index];

  let next: CodenamesDuetRuntimeState = {
    ...state,
    revealed,
    moveCount: state.moveCount + 1
  };

  if (isAssassinCell(next, move.index)) {
    next = {
      ...next,
      status: 'completed',
      outcome: 'assassin',
      phase: 'clue',
      activeClue: null
    };
    return {
      accepted: true,
      nextState: next
    };
  }

  if (allTargetsFound(next)) {
    next = {
      ...next,
      status: 'completed',
      outcome: 'success',
      phase: 'clue',
      activeClue: null
    };
    return {
      accepted: true,
      nextState: next
    };
  }

  if (clueRole !== 'agent') {
    return {
      accepted: true,
      nextState: endGuessTurn(next)
    };
  }

  const remaining = state.activeClue.remainingGuesses - 1;
  if (remaining <= 0) {
    return {
      accepted: true,
      nextState: endGuessTurn(next)
    };
  }

  return {
    accepted: true,
    nextState: {
      ...next,
      activeClue: {
        ...state.activeClue,
        remainingGuesses: remaining
      }
    }
  };
}

import type { BackgammonColor, BackgammonMove, BackgammonState } from '@multiwebgame/shared-types';

const POINT_COUNT = 24;
const CHECKERS_PER_PLAYER = 15;

function opponent(player: BackgammonColor): BackgammonColor {
  return player === 'white' ? 'black' : 'white';
}

function direction(player: BackgammonColor): number {
  return player === 'white' ? -1 : 1;
}

function isPlayerChecker(value: number, player: BackgammonColor): boolean {
  return player === 'white' ? value > 0 : value < 0;
}

function checkerCountAtPoint(value: number, player: BackgammonColor): number {
  if (!isPlayerChecker(value, player)) {
    return 0;
  }

  return Math.abs(value);
}

function inHomeBoard(player: BackgammonColor, point: number): boolean {
  return player === 'white' ? point >= 0 && point <= 5 : point >= 18 && point <= 23;
}

function allCheckersInHome(state: BackgammonState, player: BackgammonColor): boolean {
  if (state.bar[player] > 0) {
    return false;
  }

  for (let point = 0; point < POINT_COUNT; point += 1) {
    if (!isPlayerChecker(state.points[point], player)) {
      continue;
    }

    if (!inHomeBoard(player, point)) {
      return false;
    }
  }

  return true;
}

function hasCheckerFartherFromOff(state: BackgammonState, player: BackgammonColor, from: number): boolean {
  if (player === 'white') {
    for (let point = 5; point > from; point -= 1) {
      if (checkerCountAtPoint(state.points[point], player) > 0) {
        return true;
      }
    }
    return false;
  }

  for (let point = 18; point < from; point += 1) {
    if (checkerCountAtPoint(state.points[point], player) > 0) {
      return true;
    }
  }

  return false;
}

function entryPointFromBar(player: BackgammonColor, die: number): number {
  return player === 'white' ? 24 - die : die - 1;
}

function destinationFromSource(player: BackgammonColor, from: number, die: number): number | 'off' {
  const next = from + direction(player) * die;
  if (next < 0 || next >= POINT_COUNT) {
    return 'off';
  }

  return next;
}

function pointIsBlocked(points: number[], point: number, player: BackgammonColor): boolean {
  const value = points[point];
  if (value === 0 || isPlayerChecker(value, player)) {
    return false;
  }

  return Math.abs(value) >= 2;
}

function canBearOff(state: BackgammonState, player: BackgammonColor, from: number, die: number): boolean {
  if (!allCheckersInHome(state, player) || !inHomeBoard(player, from)) {
    return false;
  }

  if (player === 'white') {
    const exactPoint = die - 1;
    if (from === exactPoint) {
      return true;
    }

    if (from < exactPoint) {
      return !hasCheckerFartherFromOff(state, player, from);
    }

    return false;
  }

  const exactPoint = 24 - die;
  if (from === exactPoint) {
    return true;
  }

  if (from > exactPoint) {
    return !hasCheckerFartherFromOff(state, player, from);
  }

  return false;
}

function legalForDie(
  state: BackgammonState,
  player: BackgammonColor,
  from: number | 'bar',
  die: number
): { to: number | 'off'; legal: boolean } {
  if (from === 'bar') {
    const entry = entryPointFromBar(player, die);
    return {
      to: entry,
      legal: !pointIsBlocked(state.points, entry, player)
    };
  }

  const destination = destinationFromSource(player, from, die);
  if (destination === 'off') {
    return {
      to: 'off',
      legal: canBearOff(state, player, from, die)
    };
  }

  return {
    to: destination,
    legal: !pointIsBlocked(state.points, destination, player)
  };
}

function removeDie(remaining: number[], die: number): number[] {
  const index = remaining.indexOf(die);
  if (index < 0) {
    return remaining;
  }

  return [...remaining.slice(0, index), ...remaining.slice(index + 1)];
}

function applyPointDelta(points: number[], point: number, player: BackgammonColor, delta: number): void {
  if (player === 'white') {
    points[point] += delta;
    return;
  }

  points[point] -= delta;
}

export function hasAnyLegalBackgammonMove(
  state: BackgammonState,
  player: BackgammonColor = state.nextPlayer
): boolean {
  if (state.status !== 'playing' || state.remainingDice.length === 0) {
    return false;
  }

  const dice = Array.from(new Set(state.remainingDice));

  if (state.bar[player] > 0) {
    return dice.some((die) => legalForDie(state, player, 'bar', die).legal);
  }

  for (let point = 0; point < POINT_COUNT; point += 1) {
    if (checkerCountAtPoint(state.points[point], player) === 0) {
      continue;
    }

    for (const die of dice) {
      if (legalForDie(state, player, point, die).legal) {
        return true;
      }
    }
  }

  return false;
}

export function createBackgammonState(): BackgammonState {
  const points = Array.from({ length: POINT_COUNT }, () => 0);

  points[23] = 2;
  points[12] = 5;
  points[7] = 3;
  points[5] = 5;

  points[0] = -2;
  points[11] = -5;
  points[16] = -3;
  points[18] = -5;

  return {
    points,
    bar: {
      white: 0,
      black: 0
    },
    borneOff: {
      white: 0,
      black: 0
    },
    nextPlayer: 'white',
    status: 'playing',
    winner: null,
    moveCount: 0,
    turnCount: 0,
    rollCount: 0,
    dice: null,
    remainingDice: []
  };
}

export function assignBackgammonTurnDice(state: BackgammonState, dice: [number, number]): BackgammonState {
  if (state.status !== 'playing') {
    return state;
  }

  const [first, second] = dice;
  const normalized: [number, number] = [Math.trunc(first), Math.trunc(second)];
  const remainingDice =
    normalized[0] === normalized[1]
      ? [normalized[0], normalized[0], normalized[0], normalized[0]]
      : [normalized[0], normalized[1]];

  return {
    ...state,
    dice: normalized,
    remainingDice,
    rollCount: state.rollCount + 1,
    turnCount: state.turnCount + 1
  };
}

export function applyBackgammonMove(
  state: BackgammonState,
  move: BackgammonMove
): {
  nextState: BackgammonState;
  accepted: boolean;
  turnEnded: boolean;
  usedDie: number | null;
  reason?: string;
} {
  if (state.status !== 'playing') {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'match_is_not_active'
    };
  }

  if (move.player !== state.nextPlayer) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'out_of_turn'
    };
  }

  if (!Number.isInteger(move.die) || move.die < 1 || move.die > 6) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'invalid_die'
    };
  }

  if (!state.remainingDice.includes(move.die)) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'die_not_available'
    };
  }

  if (move.from !== 'bar' && (!Number.isInteger(move.from) || move.from < 0 || move.from >= POINT_COUNT)) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'invalid_from'
    };
  }

  if (move.to !== 'off' && (!Number.isInteger(move.to) || move.to < 0 || move.to >= POINT_COUNT)) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'invalid_to'
    };
  }

  if (state.bar[move.player] > 0 && move.from !== 'bar') {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'must_enter_from_bar'
    };
  }

  if (move.from === 'bar') {
    if (state.bar[move.player] <= 0) {
      return {
        nextState: state,
        accepted: false,
        turnEnded: false,
        usedDie: null,
        reason: 'no_checker_on_bar'
      };
    }
  } else if (checkerCountAtPoint(state.points[move.from], move.player) <= 0) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'no_checker_at_source'
    };
  }

  const legalAttempt = legalForDie(state, move.player, move.from, move.die);
  if (!legalAttempt.legal || legalAttempt.to !== move.to) {
    return {
      nextState: state,
      accepted: false,
      turnEnded: false,
      usedDie: null,
      reason: 'illegal_move'
    };
  }

  const points = [...state.points];
  const bar = { ...state.bar };
  const borneOff = { ...state.borneOff };

  if (move.from === 'bar') {
    bar[move.player] -= 1;
  } else {
    applyPointDelta(points, move.from, move.player, -1);
  }

  if (move.to === 'off') {
    borneOff[move.player] += 1;
  } else {
    const target = points[move.to];
    const targetOwner = target > 0 ? 'white' : target < 0 ? 'black' : null;
    if (targetOwner && targetOwner !== move.player && Math.abs(target) === 1) {
      points[move.to] = 0;
      bar[targetOwner] += 1;
    }

    applyPointDelta(points, move.to, move.player, 1);
  }

  let nextState: BackgammonState = {
    ...state,
    points,
    bar,
    borneOff,
    moveCount: state.moveCount + 1,
    remainingDice: removeDie(state.remainingDice, move.die)
  };

  if (nextState.borneOff[move.player] >= CHECKERS_PER_PLAYER) {
    nextState = {
      ...nextState,
      status: 'completed',
      winner: move.player,
      dice: null,
      remainingDice: []
    };

    return {
      nextState,
      accepted: true,
      turnEnded: true,
      usedDie: move.die
    };
  }

  const stillHasMoves = hasAnyLegalBackgammonMove(nextState, move.player);
  const turnEnded = nextState.remainingDice.length === 0 || !stillHasMoves;

  if (turnEnded) {
    nextState = {
      ...nextState,
      nextPlayer: opponent(move.player),
      dice: null,
      remainingDice: []
    };
  }

  return {
    nextState,
    accepted: true,
    turnEnded,
    usedDie: move.die
  };
}

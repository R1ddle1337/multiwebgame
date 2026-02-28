import type { DotsMove, DotsPlayer, DotsState } from '@multiwebgame/shared-types';

export interface DotsStateOptions {
  dotsX?: number;
  dotsY?: number;
}

function normalizeOptions(options?: DotsStateOptions): Required<DotsStateOptions> {
  const dotsX =
    Number.isInteger(options?.dotsX) && (options?.dotsX ?? 0) >= 2 ? (options?.dotsX as number) : 5;
  const dotsY =
    Number.isInteger(options?.dotsY) && (options?.dotsY ?? 0) >= 2 ? (options?.dotsY as number) : 5;

  return { dotsX, dotsY };
}

function otherPlayer(player: DotsPlayer): DotsPlayer {
  return player === 'black' ? 'white' : 'black';
}

function isInBounds(state: DotsState, move: DotsMove): boolean {
  if (move.orientation === 'h') {
    return move.x >= 0 && move.x < state.dotsX - 1 && move.y >= 0 && move.y < state.dotsY;
  }

  return move.x >= 0 && move.x < state.dotsX && move.y >= 0 && move.y < state.dotsY - 1;
}

function isBoxCompleted(state: DotsState, boxX: number, boxY: number): boolean {
  const top = state.horizontal[boxY][boxX];
  const bottom = state.horizontal[boxY + 1][boxX];
  const left = state.vertical[boxY][boxX];
  const right = state.vertical[boxY][boxX + 1];
  return top && bottom && left && right;
}

function cloneState(state: DotsState): DotsState {
  return {
    ...state,
    horizontal: state.horizontal.map((row) => [...row]),
    vertical: state.vertical.map((row) => [...row]),
    boxes: state.boxes.map((row) => [...row]),
    scores: {
      ...state.scores
    }
  };
}

export function createDotsState(options?: DotsStateOptions): DotsState {
  const normalized = normalizeOptions(options);

  return {
    dotsX: normalized.dotsX,
    dotsY: normalized.dotsY,
    horizontal: Array.from({ length: normalized.dotsY }, () =>
      Array.from({ length: normalized.dotsX - 1 }, () => false)
    ),
    vertical: Array.from({ length: normalized.dotsY - 1 }, () =>
      Array.from({ length: normalized.dotsX }, () => false)
    ),
    boxes: Array.from({ length: normalized.dotsY - 1 }, () =>
      Array.from({ length: normalized.dotsX - 1 }, () => null as DotsPlayer | null)
    ),
    nextPlayer: 'black',
    winner: null,
    status: 'playing',
    moveCount: 0,
    scores: {
      black: 0,
      white: 0
    }
  };
}

export function applyDotsMove(
  state: DotsState,
  move: DotsMove
): { nextState: DotsState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (!isInBounds(state, move)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  const occupied =
    move.orientation === 'h' ? state.horizontal[move.y][move.x] : state.vertical[move.y][move.x];
  if (occupied) {
    return { nextState: state, accepted: false, reason: 'line_already_drawn' };
  }

  const next = cloneState(state);
  if (move.orientation === 'h') {
    next.horizontal[move.y][move.x] = true;
  } else {
    next.vertical[move.y][move.x] = true;
  }

  const candidateBoxes: Array<[number, number]> = [];
  if (move.orientation === 'h') {
    if (move.y > 0) {
      candidateBoxes.push([move.x, move.y - 1]);
    }
    if (move.y < state.dotsY - 1) {
      candidateBoxes.push([move.x, move.y]);
    }
  } else {
    if (move.x > 0) {
      candidateBoxes.push([move.x - 1, move.y]);
    }
    if (move.x < state.dotsX - 1) {
      candidateBoxes.push([move.x, move.y]);
    }
  }

  let completedBoxes = 0;
  for (const [boxX, boxY] of candidateBoxes) {
    if (next.boxes[boxY][boxX] !== null) {
      continue;
    }

    if (isBoxCompleted(next, boxX, boxY)) {
      next.boxes[boxY][boxX] = move.player;
      completedBoxes += 1;
    }
  }

  if (completedBoxes > 0) {
    next.scores[move.player] += completedBoxes;
  }

  next.moveCount += 1;

  const totalBoxes = (next.dotsX - 1) * (next.dotsY - 1);
  const claimedBoxes = next.scores.black + next.scores.white;

  if (claimedBoxes >= totalBoxes) {
    next.winner =
      next.scores.black > next.scores.white
        ? 'black'
        : next.scores.white > next.scores.black
          ? 'white'
          : null;
    next.status = next.winner ? 'completed' : 'draw';
    next.nextPlayer = otherPlayer(move.player);

    return {
      accepted: true,
      nextState: next
    };
  }

  next.nextPlayer = completedBoxes > 0 ? move.player : otherPlayer(move.player);

  return {
    accepted: true,
    nextState: next
  };
}

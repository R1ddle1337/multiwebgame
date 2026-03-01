import type {
  QuoridorMove,
  QuoridorPlayer,
  QuoridorState,
  QuoridorWallOrientation
} from '@multiwebgame/shared-types';

interface Point {
  x: number;
  y: number;
}

export interface QuoridorStateOptions {
  boardSize?: number;
  wallsPerPlayer?: number;
}

function otherPlayer(player: QuoridorPlayer): QuoridorPlayer {
  return player === 'black' ? 'white' : 'black';
}

function normalizeOptions(options?: QuoridorStateOptions): Required<QuoridorStateOptions> {
  return {
    boardSize: options?.boardSize ?? 9,
    wallsPerPlayer: options?.wallsPerPlayer ?? 10
  };
}

function cloneWallGrid(grid: boolean[][]): boolean[][] {
  return grid.map((row) => [...row]);
}

function inBounds(state: QuoridorState, point: Point): boolean {
  return point.x >= 0 && point.x < state.boardSize && point.y >= 0 && point.y < state.boardSize;
}

function wallAt(grid: boolean[][], x: number, y: number): boolean {
  if (y < 0 || y >= grid.length) {
    return false;
  }

  if (x < 0 || x >= grid[y].length) {
    return false;
  }

  return grid[y][x];
}

function hasWallBetween(state: QuoridorState, from: Point, to: Point): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return true;
  }

  if (dx !== 0) {
    const leftX = Math.min(from.x, to.x);
    return wallAt(state.walls.vertical, leftX, from.y) || wallAt(state.walls.vertical, leftX, from.y - 1);
  }

  const topY = Math.min(from.y, to.y);
  return wallAt(state.walls.horizontal, from.x, topY) || wallAt(state.walls.horizontal, from.x - 1, topY);
}

function legalPawnTargets(state: QuoridorState, player: QuoridorPlayer): Point[] {
  const from = state.pawns[player];
  const opponent = state.pawns[otherPlayer(player)];
  const result: Point[] = [];
  const seen = new Set<string>();

  const pushPoint = (point: Point): void => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(point);
  };

  const directions: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (const [dx, dy] of directions) {
    const adjacent = {
      x: from.x + dx,
      y: from.y + dy
    };

    if (!inBounds(state, adjacent) || hasWallBetween(state, from, adjacent)) {
      continue;
    }

    if (adjacent.x !== opponent.x || adjacent.y !== opponent.y) {
      pushPoint(adjacent);
      continue;
    }

    const jump = {
      x: opponent.x + dx,
      y: opponent.y + dy
    };

    if (inBounds(state, jump) && !hasWallBetween(state, opponent, jump)) {
      pushPoint(jump);
      continue;
    }

    const sideSteps =
      dx !== 0
        ? [
            { x: opponent.x, y: opponent.y - 1 },
            { x: opponent.x, y: opponent.y + 1 }
          ]
        : [
            { x: opponent.x - 1, y: opponent.y },
            { x: opponent.x + 1, y: opponent.y }
          ];

    for (const side of sideSteps) {
      if (!inBounds(state, side) || hasWallBetween(state, opponent, side)) {
        continue;
      }

      pushPoint(side);
    }
  }

  return result;
}

function neighbors(state: QuoridorState, point: Point): Point[] {
  const candidates: Point[] = [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ];

  return candidates.filter(
    (candidate) => inBounds(state, candidate) && !hasWallBetween(state, point, candidate)
  );
}

function hasPathToGoal(state: QuoridorState, player: QuoridorPlayer): boolean {
  const start = state.pawns[player];
  const targetRow = player === 'black' ? state.boardSize - 1 : 0;
  const queue: Point[] = [start];
  const visited = new Set<string>([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift() as Point;
    if (current.y === targetRow) {
      return true;
    }

    for (const next of neighbors(state, current)) {
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

function canPlaceWall(
  state: QuoridorState,
  orientation: QuoridorWallOrientation,
  x: number,
  y: number
): { allowed: boolean; reason?: string } {
  const maxAnchor = state.boardSize - 2;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > maxAnchor || y > maxAnchor) {
    return { allowed: false, reason: 'out_of_bounds' };
  }

  if (orientation === 'h') {
    if (state.walls.horizontal[y][x]) {
      return { allowed: false, reason: 'occupied_wall' };
    }
    if (state.walls.vertical[y][x]) {
      return { allowed: false, reason: 'wall_crossing' };
    }
  } else {
    if (state.walls.vertical[y][x]) {
      return { allowed: false, reason: 'occupied_wall' };
    }
    if (state.walls.horizontal[y][x]) {
      return { allowed: false, reason: 'wall_crossing' };
    }
  }

  const nextState: QuoridorState = {
    ...state,
    walls: {
      horizontal: cloneWallGrid(state.walls.horizontal),
      vertical: cloneWallGrid(state.walls.vertical)
    }
  };

  if (orientation === 'h') {
    nextState.walls.horizontal[y][x] = true;
  } else {
    nextState.walls.vertical[y][x] = true;
  }

  if (!hasPathToGoal(nextState, 'black') || !hasPathToGoal(nextState, 'white')) {
    return {
      allowed: false,
      reason: 'blocks_all_paths'
    };
  }

  return { allowed: true };
}

export function createQuoridorState(options?: QuoridorStateOptions): QuoridorState {
  const normalized = normalizeOptions(options);
  if (!Number.isInteger(normalized.boardSize) || normalized.boardSize < 3) {
    throw new Error('invalid_board_size');
  }
  if (!Number.isInteger(normalized.wallsPerPlayer) || normalized.wallsPerPlayer < 0) {
    throw new Error('invalid_walls_per_player');
  }

  const wallGridSize = normalized.boardSize - 1;
  return {
    boardSize: normalized.boardSize,
    wallsPerPlayer: normalized.wallsPerPlayer,
    pawns: {
      black: {
        x: Math.floor(normalized.boardSize / 2),
        y: 0
      },
      white: {
        x: Math.floor(normalized.boardSize / 2),
        y: normalized.boardSize - 1
      }
    },
    walls: {
      horizontal: Array.from({ length: wallGridSize }, () =>
        Array.from({ length: wallGridSize }, () => false)
      ),
      vertical: Array.from({ length: wallGridSize }, () => Array.from({ length: wallGridSize }, () => false))
    },
    remainingWalls: {
      black: normalized.wallsPerPlayer,
      white: normalized.wallsPerPlayer
    },
    nextPlayer: 'black',
    status: 'playing',
    winner: null,
    moveCount: 0
  };
}

export function applyQuoridorMove(
  state: QuoridorState,
  move: QuoridorMove
): { nextState: QuoridorState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (move.type === 'pawn') {
    if (!Number.isInteger(move.x) || !Number.isInteger(move.y)) {
      return { nextState: state, accepted: false, reason: 'invalid_move' };
    }

    const targets = legalPawnTargets(state, move.player);
    const legal = targets.some((point) => point.x === move.x && point.y === move.y);
    if (!legal) {
      return { nextState: state, accepted: false, reason: 'illegal_move' };
    }

    const nextState: QuoridorState = {
      ...state,
      pawns: {
        ...state.pawns,
        [move.player]: {
          x: move.x,
          y: move.y
        }
      },
      nextPlayer: otherPlayer(move.player),
      moveCount: state.moveCount + 1
    };

    const reachedGoal =
      (move.player === 'black' && move.y === state.boardSize - 1) ||
      (move.player === 'white' && move.y === 0);
    if (reachedGoal) {
      nextState.status = 'completed';
      nextState.winner = move.player;
      nextState.nextPlayer = move.player;
    }

    return {
      accepted: true,
      nextState
    };
  }

  if (state.remainingWalls[move.player] <= 0) {
    return { nextState: state, accepted: false, reason: 'no_walls_remaining' };
  }

  const placement = canPlaceWall(state, move.orientation, move.x, move.y);
  if (!placement.allowed) {
    return {
      nextState: state,
      accepted: false,
      reason: placement.reason ?? 'invalid_move'
    };
  }

  const horizontal = cloneWallGrid(state.walls.horizontal);
  const vertical = cloneWallGrid(state.walls.vertical);

  if (move.orientation === 'h') {
    horizontal[move.y][move.x] = true;
  } else {
    vertical[move.y][move.x] = true;
  }

  return {
    accepted: true,
    nextState: {
      ...state,
      walls: {
        horizontal,
        vertical
      },
      remainingWalls: {
        ...state.remainingWalls,
        [move.player]: state.remainingWalls[move.player] - 1
      },
      nextPlayer: otherPlayer(move.player),
      moveCount: state.moveCount + 1
    }
  };
}

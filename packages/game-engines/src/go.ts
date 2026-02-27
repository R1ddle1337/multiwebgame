import type { GoMove, GoPoint, GoState, GoStone } from '@multiwebgame/shared-types';

type GroupInfo = {
  stones: GoPoint[];
  liberties: Set<string>;
};

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

function createBoard(boardSize: number): (GoStone | null)[][] {
  return Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => null));
}

function cloneBoard(board: (GoStone | null)[][]): (GoStone | null)[][] {
  return board.map((row) => [...row]);
}

function inBounds(boardSize: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

function otherPlayer(player: GoStone): GoStone {
  return player === 'black' ? 'white' : 'black';
}

function collectGroup(board: (GoStone | null)[][], startX: number, startY: number): GroupInfo {
  const color = board[startY][startX];
  if (color === null) {
    return {
      stones: [],
      liberties: new Set<string>()
    };
  }

  const visited = new Set<string>();
  const stones: GoPoint[] = [];
  const liberties = new Set<string>();
  const stack: Array<[number, number]> = [[startX, startY]];
  const boardSize = board.length;

  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    const key = pointKey(x, y);
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    stones.push({ x, y });

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;

      if (!inBounds(boardSize, nx, ny)) {
        continue;
      }

      const cell = board[ny][nx];
      if (cell === null) {
        liberties.add(pointKey(nx, ny));
        continue;
      }

      if (cell === color && !visited.has(pointKey(nx, ny))) {
        stack.push([nx, ny]);
      }
    }
  }

  return { stones, liberties };
}

export function createGoState(boardSize = 19): GoState {
  return {
    boardSize,
    board: createBoard(boardSize),
    nextPlayer: 'black',
    status: 'playing',
    moveCount: 0,
    consecutivePasses: 0,
    koPoint: null
  };
}

export function applyGoMove(
  state: GoState,
  move: GoMove
): { nextState: GoState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (move.type === 'pass') {
    const consecutivePasses = state.consecutivePasses + 1;
    return {
      accepted: true,
      nextState: {
        ...state,
        nextPlayer: otherPlayer(move.player),
        status: consecutivePasses >= 2 ? 'completed' : 'playing',
        moveCount: state.moveCount + 1,
        consecutivePasses,
        koPoint: null
      }
    };
  }

  if (!inBounds(state.boardSize, move.x, move.y)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  if (state.board[move.y][move.x] !== null) {
    return { nextState: state, accepted: false, reason: 'occupied_cell' };
  }

  if (state.koPoint && state.koPoint.x === move.x && state.koPoint.y === move.y) {
    return { nextState: state, accepted: false, reason: 'ko_violation' };
  }

  const board = cloneBoard(state.board);
  board[move.y][move.x] = move.player;

  const opponent = otherPlayer(move.player);
  const capturedStones: GoPoint[] = [];
  const checkedOpponentStones = new Set<string>();

  for (const [dx, dy] of DIRECTIONS) {
    const nx = move.x + dx;
    const ny = move.y + dy;

    if (!inBounds(state.boardSize, nx, ny)) {
      continue;
    }

    if (board[ny][nx] !== opponent) {
      continue;
    }

    const neighborKey = pointKey(nx, ny);
    if (checkedOpponentStones.has(neighborKey)) {
      continue;
    }

    const group = collectGroup(board, nx, ny);
    for (const stone of group.stones) {
      checkedOpponentStones.add(pointKey(stone.x, stone.y));
    }

    if (group.liberties.size === 0) {
      for (const stone of group.stones) {
        board[stone.y][stone.x] = null;
        capturedStones.push(stone);
      }
    }
  }

  const ownGroup = collectGroup(board, move.x, move.y);
  if (ownGroup.liberties.size === 0) {
    return { nextState: state, accepted: false, reason: 'suicide_move' };
  }

  let koPoint: GoPoint | null = null;
  if (capturedStones.length === 1 && ownGroup.stones.length === 1 && ownGroup.liberties.size === 1) {
    const captured = capturedStones[0];
    koPoint = { x: captured.x, y: captured.y };
  }

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      nextPlayer: opponent,
      status: 'playing',
      moveCount: state.moveCount + 1,
      consecutivePasses: 0,
      koPoint
    }
  };
}

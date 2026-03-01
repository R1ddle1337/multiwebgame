import type { HexMove, HexPlayer, HexState } from '@multiwebgame/shared-types';

const HEX_DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1]
];

export interface HexStateOptions {
  boardSize?: number;
}

function otherPlayer(player: HexPlayer): HexPlayer {
  return player === 'black' ? 'white' : 'black';
}

function inBounds(state: HexState, x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < state.boardSize &&
    y < state.boardSize
  );
}

function hasConnection(board: (HexPlayer | null)[][], player: HexPlayer): boolean {
  const size = board.length;
  const queue: Array<[number, number]> = [];
  const visited = new Set<string>();

  if (player === 'black') {
    for (let x = 0; x < size; x += 1) {
      if (board[0][x] === 'black') {
        queue.push([x, 0]);
        visited.add(`${x},0`);
      }
    }
  } else {
    for (let y = 0; y < size; y += 1) {
      if (board[y][0] === 'white') {
        queue.push([0, y]);
        visited.add(`0,${y}`);
      }
    }
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    if (player === 'black' && y === size - 1) {
      return true;
    }
    if (player === 'white' && x === size - 1) {
      return true;
    }

    for (const [dx, dy] of HEX_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
        continue;
      }
      if (board[ny][nx] !== player) {
        continue;
      }

      const key = `${nx},${ny}`;
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push([nx, ny]);
    }
  }

  return false;
}

export function createHexState(options?: HexStateOptions): HexState {
  const boardSize = options?.boardSize ?? 11;
  if (!Number.isInteger(boardSize) || boardSize < 2) {
    throw new Error('invalid_board_size');
  }

  return {
    boardSize,
    board: Array.from({ length: boardSize }, () =>
      Array.from({ length: boardSize }, () => null as HexPlayer | null)
    ),
    nextPlayer: 'black',
    winner: null,
    status: 'playing',
    moveCount: 0
  };
}

export function applyHexMove(
  state: HexState,
  move: HexMove
): { nextState: HexState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (!inBounds(state, move.x, move.y)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  if (state.board[move.y][move.x] !== null) {
    return { nextState: state, accepted: false, reason: 'occupied_cell' };
  }

  const board = state.board.map((row) => [...row]);
  board[move.y][move.x] = move.player;

  const winner = hasConnection(board, move.player) ? move.player : null;
  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      nextPlayer: winner ? move.player : otherPlayer(move.player),
      winner,
      status: winner ? 'completed' : 'playing',
      moveCount: state.moveCount + 1
    }
  };
}

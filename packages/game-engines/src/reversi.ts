import type { ReversiDisc, ReversiMove, ReversiState } from '@multiwebgame/shared-types';

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];

export interface ReversiStateOptions {
  boardSize?: number;
}

function normalizeOptions(options?: ReversiStateOptions): Required<ReversiStateOptions> {
  return {
    boardSize: options?.boardSize ?? 8
  };
}

function otherPlayer(player: ReversiDisc): ReversiDisc {
  return player === 'black' ? 'white' : 'black';
}

function inBounds(boardSize: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function collectFlipsInDirection(
  board: (ReversiDisc | null)[][],
  x: number,
  y: number,
  player: ReversiDisc,
  dx: number,
  dy: number
): Array<[number, number]> {
  const opponent = otherPlayer(player);
  const flips: Array<[number, number]> = [];

  let cx = x + dx;
  let cy = y + dy;

  while (inBounds(board.length, cx, cy) && board[cy][cx] === opponent) {
    flips.push([cx, cy]);
    cx += dx;
    cy += dy;
  }

  if (!inBounds(board.length, cx, cy) || board[cy][cx] !== player || flips.length === 0) {
    return [];
  }

  return flips;
}

function collectFlips(
  board: (ReversiDisc | null)[][],
  x: number,
  y: number,
  player: ReversiDisc
): Array<[number, number]> {
  const allFlips: Array<[number, number]> = [];

  for (const [dx, dy] of DIRECTIONS) {
    allFlips.push(...collectFlipsInDirection(board, x, y, player, dx, dy));
  }

  return allFlips;
}

function hasAnyLegalMove(board: (ReversiDisc | null)[][], player: ReversiDisc): boolean {
  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board.length; x += 1) {
      if (board[y][x] !== null) {
        continue;
      }

      if (collectFlips(board, x, y, player).length > 0) {
        return true;
      }
    }
  }

  return false;
}

function countDiscs(board: (ReversiDisc | null)[][]): { black: number; white: number } {
  let black = 0;
  let white = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') {
        black += 1;
      }

      if (cell === 'white') {
        white += 1;
      }
    }
  }

  return { black, white };
}

export function createReversiState(options?: ReversiStateOptions): ReversiState {
  const normalized = normalizeOptions(options);
  const board = Array.from({ length: normalized.boardSize }, () =>
    Array.from({ length: normalized.boardSize }, () => null as ReversiDisc | null)
  );

  const mid = normalized.boardSize / 2;
  board[mid - 1][mid - 1] = 'white';
  board[mid][mid] = 'white';
  board[mid - 1][mid] = 'black';
  board[mid][mid - 1] = 'black';

  return {
    boardSize: normalized.boardSize,
    board,
    nextPlayer: 'black',
    winner: null,
    status: 'playing',
    moveCount: 0,
    counts: {
      black: 2,
      white: 2
    }
  };
}

export function applyReversiMove(
  state: ReversiState,
  move: ReversiMove
): { nextState: ReversiState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (!inBounds(state.boardSize, move.x, move.y)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  if (state.board[move.y][move.x] !== null) {
    return { nextState: state, accepted: false, reason: 'occupied_cell' };
  }

  const flips = collectFlips(state.board, move.x, move.y, move.player);
  if (flips.length === 0) {
    return { nextState: state, accepted: false, reason: 'illegal_move' };
  }

  const board = state.board.map((row) => [...row]);
  board[move.y][move.x] = move.player;

  for (const [flipX, flipY] of flips) {
    board[flipY][flipX] = move.player;
  }

  const counts = countDiscs(board);
  const current = move.player;
  const opponent = otherPlayer(current);
  const opponentHasMove = hasAnyLegalMove(board, opponent);
  const currentHasMove = hasAnyLegalMove(board, current);

  if (!opponentHasMove && !currentHasMove) {
    const winner = counts.black > counts.white ? 'black' : counts.white > counts.black ? 'white' : null;

    return {
      accepted: true,
      nextState: {
        ...state,
        board,
        moveCount: state.moveCount + 1,
        counts,
        nextPlayer: opponent,
        status: winner ? 'completed' : 'draw',
        winner
      }
    };
  }

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      moveCount: state.moveCount + 1,
      counts,
      nextPlayer: opponentHasMove ? opponent : current,
      status: 'playing',
      winner: null
    }
  };
}

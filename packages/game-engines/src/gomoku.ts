import type { GomokuMark, GomokuMove, GomokuState } from '@multiwebgame/shared-types';

const WIN_LENGTH = 5;

export function createGomokuState(boardSize = 15): GomokuState {
  return {
    boardSize,
    board: Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => null)),
    nextPlayer: 'black',
    winner: null,
    status: 'playing',
    moveCount: 0
  };
}

function inBounds(state: GomokuState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.boardSize && y < state.boardSize;
}

function hasFiveInRow(board: (GomokuMark | null)[][], x: number, y: number, player: GomokuMark): boolean {
  const directions: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dx, dy] of directions) {
    let count = 1;

    let nx = x + dx;
    let ny = y + dy;
    while (nx >= 0 && ny >= 0 && nx < board.length && ny < board.length && board[ny][nx] === player) {
      count += 1;
      nx += dx;
      ny += dy;
    }

    nx = x - dx;
    ny = y - dy;
    while (nx >= 0 && ny >= 0 && nx < board.length && ny < board.length && board[ny][nx] === player) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }

    if (count >= WIN_LENGTH) {
      return true;
    }
  }

  return false;
}

export function applyGomokuMove(
  state: GomokuState,
  move: GomokuMove
): { nextState: GomokuState; accepted: boolean; reason?: string } {
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

  const winner = hasFiveInRow(board, move.x, move.y, move.player) ? move.player : null;
  const moveCount = state.moveCount + 1;
  const isDraw = !winner && moveCount >= state.boardSize * state.boardSize;

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      moveCount,
      nextPlayer: move.player === 'black' ? 'white' : 'black',
      winner,
      status: winner ? 'completed' : isDraw ? 'draw' : 'playing'
    }
  };
}

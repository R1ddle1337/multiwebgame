import type { Connect4Disc, Connect4Move, Connect4State } from '@multiwebgame/shared-types';

const WIN_LENGTH = 4;
const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

export interface Connect4StateOptions {
  columns?: number;
  rows?: number;
}

function normalizeOptions(input?: Connect4StateOptions): Required<Connect4StateOptions> {
  return {
    columns: input?.columns ?? 7,
    rows: input?.rows ?? 6
  };
}

function otherPlayer(player: Connect4Disc): Connect4Disc {
  return player === 'red' ? 'yellow' : 'red';
}

function inBounds(state: Connect4State, column: number): boolean {
  return Number.isInteger(column) && column >= 0 && column < state.columns;
}

function countDirection(
  board: (Connect4Disc | null)[][],
  row: number,
  column: number,
  rowDelta: number,
  columnDelta: number,
  player: Connect4Disc
): number {
  let count = 0;
  let nextRow = row + rowDelta;
  let nextColumn = column + columnDelta;

  while (
    nextRow >= 0 &&
    nextColumn >= 0 &&
    nextRow < board.length &&
    nextColumn < board[0].length &&
    board[nextRow][nextColumn] === player
  ) {
    count += 1;
    nextRow += rowDelta;
    nextColumn += columnDelta;
  }

  return count;
}

function hasWinningLine(
  board: (Connect4Disc | null)[][],
  row: number,
  column: number,
  player: Connect4Disc
): boolean {
  for (const [columnDelta, rowDelta] of DIRECTIONS) {
    const lineLength =
      1 +
      countDirection(board, row, column, rowDelta, columnDelta, player) +
      countDirection(board, row, column, -rowDelta, -columnDelta, player);

    if (lineLength >= WIN_LENGTH) {
      return true;
    }
  }

  return false;
}

function resolveDropRow(state: Connect4State, column: number): number {
  for (let row = state.rows - 1; row >= 0; row -= 1) {
    if (state.board[row][column] === null) {
      return row;
    }
  }

  return -1;
}

export function createConnect4State(options?: Connect4StateOptions): Connect4State {
  const normalized = normalizeOptions(options);

  return {
    columns: normalized.columns,
    rows: normalized.rows,
    board: Array.from({ length: normalized.rows }, () =>
      Array.from({ length: normalized.columns }, () => null)
    ),
    nextPlayer: 'red',
    winner: null,
    status: 'playing',
    moveCount: 0
  };
}

export function applyConnect4Move(
  state: Connect4State,
  move: Connect4Move
): { nextState: Connect4State; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (!inBounds(state, move.column)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  const dropRow = resolveDropRow(state, move.column);
  if (dropRow < 0) {
    return { nextState: state, accepted: false, reason: 'column_full' };
  }

  const board = state.board.map((row) => [...row]);
  board[dropRow][move.column] = move.player;

  const winner = hasWinningLine(board, dropRow, move.column, move.player) ? move.player : null;
  const moveCount = state.moveCount + 1;
  const isDraw = !winner && moveCount >= state.rows * state.columns;

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      nextPlayer: otherPlayer(move.player),
      winner,
      status: winner ? 'completed' : isDraw ? 'draw' : 'playing',
      moveCount
    }
  };
}

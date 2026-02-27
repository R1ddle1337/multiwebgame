import type {
  GomokuForbiddenMoveReason,
  GomokuMark,
  GomokuMove,
  GomokuRuleset,
  GomokuState
} from '@multiwebgame/shared-types';

const WIN_LENGTH = 5;
const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

type CellCode = '0' | '1' | '2';

export interface GomokuStateOptions {
  boardSize?: number;
  ruleset?: GomokuRuleset;
}

function normalizeOptions(input?: number | GomokuStateOptions): Required<GomokuStateOptions> {
  if (typeof input === 'number') {
    return {
      boardSize: input,
      ruleset: 'freestyle'
    };
  }

  return {
    boardSize: input?.boardSize ?? 15,
    ruleset: input?.ruleset ?? 'freestyle'
  };
}

export function createGomokuState(input?: number | GomokuStateOptions): GomokuState {
  const options = normalizeOptions(input);
  return {
    boardSize: options.boardSize,
    board: Array.from({ length: options.boardSize }, () =>
      Array.from({ length: options.boardSize }, () => null)
    ),
    nextPlayer: 'black',
    winner: null,
    status: 'playing',
    moveCount: 0,
    ruleset: options.ruleset,
    forbiddenMove: null
  };
}

function inBounds(state: GomokuState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.boardSize && y < state.boardSize;
}

function countAlongDirection(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: GomokuMark
): number {
  let count = 0;
  let cx = x + dx;
  let cy = y + dy;

  while (cx >= 0 && cy >= 0 && cx < board.length && cy < board.length && board[cy][cx] === player) {
    count += 1;
    cx += dx;
    cy += dy;
  }

  return count;
}

function lineLengthThroughMove(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: GomokuMark
): number {
  return (
    1 + countAlongDirection(board, x, y, dx, dy, player) + countAlongDirection(board, x, y, -dx, -dy, player)
  );
}

function maxLineLength(board: (GomokuMark | null)[][], x: number, y: number, player: GomokuMark): number {
  let max = 1;

  for (const [dx, dy] of DIRECTIONS) {
    max = Math.max(max, lineLengthThroughMove(board, x, y, dx, dy, player));
  }

  return max;
}

function hasExactFive(board: (GomokuMark | null)[][], x: number, y: number, player: GomokuMark): boolean {
  for (const [dx, dy] of DIRECTIONS) {
    if (lineLengthThroughMove(board, x, y, dx, dy, player) === WIN_LENGTH) {
      return true;
    }
  }

  return false;
}

function encodeCell(cell: GomokuMark | null, player: GomokuMark): CellCode {
  if (cell === null) {
    return '0';
  }
  return cell === player ? '1' : '2';
}

function buildDirectionalLine(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: GomokuMark,
  radius = 5
): { line: string; center: number } {
  const encoded: CellCode[] = [];

  for (let offset = -radius; offset <= radius; offset += 1) {
    const px = x + dx * offset;
    const py = y + dy * offset;
    if (px < 0 || py < 0 || py >= board.length || px >= board.length) {
      encoded.push('2');
      continue;
    }

    encoded.push(encodeCell(board[py][px], player));
  }

  return {
    line: encoded.join(''),
    center: radius
  };
}

function directionHasFourThreat(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: GomokuMark
): boolean {
  const { line, center } = buildDirectionalLine(board, x, y, dx, dy, player, 4);

  for (let start = 0; start <= 4; start += 1) {
    const end = start + 4;
    if (!(start <= center && center <= end)) {
      continue;
    }

    const window = line.slice(start, end + 1);
    if (window.includes('2')) {
      continue;
    }

    let stones = 0;
    let empties = 0;

    for (const cell of window) {
      if (cell === '1') {
        stones += 1;
      } else if (cell === '0') {
        empties += 1;
      }
    }

    if (stones === 4 && empties === 1) {
      return true;
    }
  }

  return false;
}

function directionHasOpenThree(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: GomokuMark
): boolean {
  const { line, center } = buildDirectionalLine(board, x, y, dx, dy, player, 5);
  const patterns = ['01110', '010110', '011010'];

  for (const pattern of patterns) {
    let index = line.indexOf(pattern);
    while (index !== -1) {
      const end = index + pattern.length - 1;
      if (index <= center && center <= end) {
        return true;
      }

      index = line.indexOf(pattern, index + 1);
    }
  }

  return false;
}

function evaluateRenjuForbiddenMove(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  player: GomokuMark
): GomokuForbiddenMoveReason | null {
  if (player !== 'black') {
    return null;
  }

  const max = maxLineLength(board, x, y, player);
  if (max > WIN_LENGTH) {
    return 'overline';
  }

  if (hasExactFive(board, x, y, player)) {
    return null;
  }

  let fourThreatDirections = 0;
  let openThreeDirections = 0;

  for (const [dx, dy] of DIRECTIONS) {
    if (directionHasFourThreat(board, x, y, dx, dy, player)) {
      fourThreatDirections += 1;
    }

    if (directionHasOpenThree(board, x, y, dx, dy, player)) {
      openThreeDirections += 1;
    }
  }

  if (fourThreatDirections >= 2) {
    return 'double_four';
  }

  if (openThreeDirections >= 2) {
    return 'double_three';
  }

  return null;
}

function hasWinningLine(
  board: (GomokuMark | null)[][],
  x: number,
  y: number,
  player: GomokuMark,
  ruleset: GomokuRuleset
): boolean {
  const max = maxLineLength(board, x, y, player);

  if (ruleset === 'freestyle') {
    return max >= WIN_LENGTH;
  }

  if (player === 'black') {
    return hasExactFive(board, x, y, player);
  }

  return max >= WIN_LENGTH;
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

  if (state.ruleset === 'renju') {
    const forbidden = evaluateRenjuForbiddenMove(board, move.x, move.y, move.player);
    if (forbidden) {
      return {
        nextState: state,
        accepted: false,
        reason: `forbidden_${forbidden}`
      };
    }
  }

  const winner = hasWinningLine(board, move.x, move.y, move.player, state.ruleset) ? move.player : null;
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
      status: winner ? 'completed' : isDraw ? 'draw' : 'playing',
      forbiddenMove: null
    }
  };
}

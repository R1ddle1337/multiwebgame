import type {
  XiangqiColor,
  XiangqiMove,
  XiangqiOutcomeReason,
  XiangqiPiece,
  XiangqiPieceType,
  XiangqiPosition,
  XiangqiState
} from '@multiwebgame/shared-types';

const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;
const RED_PALACE_Y_MIN = 7;
const RED_PALACE_Y_MAX = 9;
const BLACK_PALACE_Y_MIN = 0;
const BLACK_PALACE_Y_MAX = 2;

type XiangqiBoard = (XiangqiPiece | null)[][];

const MAJOR_PIECE_LAYOUT: XiangqiPieceType[] = [
  'chariot',
  'horse',
  'elephant',
  'advisor',
  'general',
  'advisor',
  'elephant',
  'horse',
  'chariot'
];

function createPiece(type: XiangqiPieceType, color: XiangqiColor): XiangqiPiece {
  return { type, color };
}

function createEmptyBoard(): XiangqiBoard {
  return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null));
}

function cloneBoard(board: XiangqiBoard): XiangqiBoard {
  return board.map((row) => [...row]);
}

function inBounds(position: XiangqiPosition): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < BOARD_WIDTH && position.y < BOARD_HEIGHT;
}

function oppositeColor(color: XiangqiColor): XiangqiColor {
  return color === 'red' ? 'black' : 'red';
}

function isInsidePalace(color: XiangqiColor, position: XiangqiPosition): boolean {
  if (position.x < 3 || position.x > 5) {
    return false;
  }

  if (color === 'red') {
    return position.y >= RED_PALACE_Y_MIN && position.y <= RED_PALACE_Y_MAX;
  }

  return position.y >= BLACK_PALACE_Y_MIN && position.y <= BLACK_PALACE_Y_MAX;
}

function countPiecesBetween(board: XiangqiBoard, from: XiangqiPosition, to: XiangqiPosition): number {
  if (from.x === to.x) {
    const step = to.y > from.y ? 1 : -1;
    let count = 0;
    for (let y = from.y + step; y !== to.y; y += step) {
      if (board[y][from.x] !== null) {
        count += 1;
      }
    }
    return count;
  }

  if (from.y === to.y) {
    const step = to.x > from.x ? 1 : -1;
    let count = 0;
    for (let x = from.x + step; x !== to.x; x += step) {
      if (board[from.y][x] !== null) {
        count += 1;
      }
    }
    return count;
  }

  return -1;
}

function findGeneral(board: XiangqiBoard, color: XiangqiColor): XiangqiPosition | null {
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x];
      if (piece && piece.type === 'general' && piece.color === color) {
        return { x, y };
      }
    }
  }

  return null;
}

function isLegalPieceMovement(
  board: XiangqiBoard,
  from: XiangqiPosition,
  to: XiangqiPosition,
  piece: XiangqiPiece
): boolean {
  if (from.x === to.x && from.y === to.y) {
    return false;
  }

  const target = board[to.y][to.x];
  if (target && target.color === piece.color) {
    return false;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (piece.type === 'general') {
    if (target && target.type === 'general' && dx === 0 && countPiecesBetween(board, from, to) === 0) {
      return true;
    }

    return absDx + absDy === 1 && isInsidePalace(piece.color, to);
  }

  if (piece.type === 'advisor') {
    return absDx === 1 && absDy === 1 && isInsidePalace(piece.color, to);
  }

  if (piece.type === 'elephant') {
    if (absDx !== 2 || absDy !== 2) {
      return false;
    }

    if (piece.color === 'red' && to.y < 5) {
      return false;
    }

    if (piece.color === 'black' && to.y > 4) {
      return false;
    }

    const eyeX = from.x + dx / 2;
    const eyeY = from.y + dy / 2;
    return board[eyeY][eyeX] === null;
  }

  if (piece.type === 'horse') {
    if (!((absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2))) {
      return false;
    }

    const legX = absDx === 2 ? from.x + dx / 2 : from.x;
    const legY = absDy === 2 ? from.y + dy / 2 : from.y;
    return board[legY][legX] === null;
  }

  if (piece.type === 'chariot') {
    if (dx !== 0 && dy !== 0) {
      return false;
    }

    return countPiecesBetween(board, from, to) === 0;
  }

  if (piece.type === 'cannon') {
    if (dx !== 0 && dy !== 0) {
      return false;
    }

    const blockers = countPiecesBetween(board, from, to);
    if (target === null) {
      return blockers === 0;
    }

    return blockers === 1;
  }

  const forwardStep = piece.color === 'red' ? -1 : 1;
  if (dx === 0 && dy === forwardStep) {
    return true;
  }

  const crossedRiver = piece.color === 'red' ? from.y <= 4 : from.y >= 5;
  return crossedRiver && dy === 0 && absDx === 1;
}

function isGeneralInCheck(board: XiangqiBoard, color: XiangqiColor): boolean {
  const generalPosition = findGeneral(board, color);
  if (!generalPosition) {
    return true;
  }

  const attackerColor = oppositeColor(color);
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x];
      if (!piece || piece.color !== attackerColor) {
        continue;
      }

      if (isLegalPieceMovement(board, { x, y }, generalPosition, piece)) {
        return true;
      }
    }
  }

  return false;
}

function hasAnyLegalMove(board: XiangqiBoard, color: XiangqiColor): boolean {
  return generateLegalMoves(board, color).length > 0;
}

function generateLegalMoves(board: XiangqiBoard, color: XiangqiColor): XiangqiMove[] {
  const legalMoves: XiangqiMove[] = [];

  for (let fromY = 0; fromY < BOARD_HEIGHT; fromY += 1) {
    for (let fromX = 0; fromX < BOARD_WIDTH; fromX += 1) {
      const piece = board[fromY][fromX];
      if (!piece || piece.color !== color) {
        continue;
      }

      for (let toY = 0; toY < BOARD_HEIGHT; toY += 1) {
        for (let toX = 0; toX < BOARD_WIDTH; toX += 1) {
          const from = { x: fromX, y: fromY };
          const to = { x: toX, y: toY };

          if (!isLegalPieceMovement(board, from, to, piece)) {
            continue;
          }

          const next = cloneBoard(board);
          next[toY][toX] = piece;
          next[fromY][fromX] = null;

          if (!isGeneralInCheck(next, color)) {
            legalMoves.push({
              from: { x: fromX, y: fromY },
              to: { x: toX, y: toY },
              player: color
            });
          }
        }
      }
    }
  }

  return legalMoves;
}

function pieceCode(piece: XiangqiPiece | null): string {
  if (!piece) {
    return '.';
  }

  const color = piece.color === 'red' ? 'r' : 'b';
  const type =
    piece.type === 'general'
      ? 'g'
      : piece.type === 'advisor'
        ? 'a'
        : piece.type === 'elephant'
          ? 'e'
          : piece.type === 'horse'
            ? 'h'
            : piece.type === 'chariot'
              ? 'r'
              : piece.type === 'cannon'
                ? 'c'
                : 's';

  return `${color}${type}`;
}

function createPositionHash(board: XiangqiBoard, nextPlayer: XiangqiColor): string {
  const rows = board.map((row) => row.map((cell) => pieceCode(cell)).join(''));
  return `${nextPlayer}|${rows.join('/')}`;
}

function createInitialBoard(): XiangqiBoard {
  const board = createEmptyBoard();

  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    board[0][x] = createPiece(MAJOR_PIECE_LAYOUT[x], 'black');
    board[9][x] = createPiece(MAJOR_PIECE_LAYOUT[x], 'red');
  }

  board[2][1] = createPiece('cannon', 'black');
  board[2][7] = createPiece('cannon', 'black');
  board[7][1] = createPiece('cannon', 'red');
  board[7][7] = createPiece('cannon', 'red');

  for (const x of [0, 2, 4, 6, 8]) {
    board[3][x] = createPiece('soldier', 'black');
    board[6][x] = createPiece('soldier', 'red');
  }

  return board;
}

export function createXiangqiState(): XiangqiState {
  const board = createInitialBoard();
  return {
    board,
    nextPlayer: 'red',
    status: 'playing',
    winner: null,
    outcomeReason: null,
    moveCount: 0,
    positionHistory: [createPositionHash(board, 'red')]
  };
}

function buildCompletedState(
  state: XiangqiState,
  board: XiangqiBoard,
  nextPlayer: XiangqiColor,
  winner: XiangqiColor | null,
  outcomeReason: XiangqiOutcomeReason
): XiangqiState {
  const hash = createPositionHash(board, nextPlayer);
  return {
    ...state,
    board,
    nextPlayer,
    status: 'completed',
    winner,
    outcomeReason,
    moveCount: state.moveCount + 1,
    positionHistory: [...state.positionHistory, hash]
  };
}

function applyRepetitionPolicy(
  state: XiangqiState,
  board: XiangqiBoard,
  nextPlayer: XiangqiColor
): XiangqiState | null {
  const nextHash = createPositionHash(board, nextPlayer);
  const nextHistory = [...state.positionHistory, nextHash];

  let repetitionCount = 0;
  for (const hash of nextHistory) {
    if (hash === nextHash) {
      repetitionCount += 1;
    }
  }

  if (repetitionCount < 3) {
    return null;
  }

  if (isGeneralInCheck(board, nextPlayer)) {
    return {
      ...state,
      board,
      nextPlayer,
      status: 'completed',
      winner: nextPlayer,
      outcomeReason: 'perpetual_check_violation',
      moveCount: state.moveCount + 1,
      positionHistory: nextHistory
    };
  }

  return {
    ...state,
    board,
    nextPlayer,
    status: 'completed',
    winner: null,
    outcomeReason: 'draw_repetition',
    moveCount: state.moveCount + 1,
    positionHistory: nextHistory
  };
}

export function applyXiangqiMove(
  state: XiangqiState,
  move: XiangqiMove
): { nextState: XiangqiState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (!inBounds(move.from) || !inBounds(move.to)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  const piece = state.board[move.from.y][move.from.x];
  if (!piece) {
    return { nextState: state, accepted: false, reason: 'no_piece_at_source' };
  }

  if (piece.color !== move.player) {
    return { nextState: state, accepted: false, reason: 'piece_not_owned' };
  }

  const target = state.board[move.to.y][move.to.x];
  if (target && target.color === move.player) {
    return { nextState: state, accepted: false, reason: 'occupied_by_friendly' };
  }

  if (!isLegalPieceMovement(state.board, move.from, move.to, piece)) {
    return { nextState: state, accepted: false, reason: 'illegal_piece_movement' };
  }

  const nextBoard = cloneBoard(state.board);
  nextBoard[move.to.y][move.to.x] = piece;
  nextBoard[move.from.y][move.from.x] = null;

  if (isGeneralInCheck(nextBoard, move.player)) {
    return { nextState: state, accepted: false, reason: 'leaves_general_in_check' };
  }

  const opponentColor = oppositeColor(move.player);
  const opponentGeneral = findGeneral(nextBoard, opponentColor);

  if (!opponentGeneral) {
    return {
      accepted: true,
      nextState: buildCompletedState(state, nextBoard, opponentColor, move.player, 'capture_general')
    };
  }

  const opponentInCheck = isGeneralInCheck(nextBoard, opponentColor);
  const opponentHasMove = hasAnyLegalMove(nextBoard, opponentColor);

  if (!opponentHasMove) {
    return {
      accepted: true,
      nextState: buildCompletedState(
        state,
        nextBoard,
        opponentColor,
        move.player,
        opponentInCheck ? 'checkmate' : 'stalemate'
      )
    };
  }

  const repetitionResolved = applyRepetitionPolicy(state, nextBoard, opponentColor);
  if (repetitionResolved) {
    return {
      accepted: true,
      nextState: repetitionResolved
    };
  }

  const nextHash = createPositionHash(nextBoard, opponentColor);
  const nextHistory = [...state.positionHistory, nextHash];

  return {
    accepted: true,
    nextState: {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1,
      nextPlayer: opponentColor,
      status: 'playing',
      winner: null,
      outcomeReason: null,
      positionHistory: nextHistory
    }
  };
}

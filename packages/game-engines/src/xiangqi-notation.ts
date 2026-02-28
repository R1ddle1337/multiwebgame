import type {
  XiangqiColor,
  XiangqiMove,
  XiangqiPiece,
  XiangqiPieceType,
  XiangqiState
} from '@multiwebgame/shared-types';

export type XiangqiBlackNumeralStyle = 'arabic' | 'hanzi';
export type XiangqiArabicDigitStyle = 'ascii' | 'fullwidth';
export type XiangqiBlackCharacterVariant = 'simplified' | 'traditional';

export interface XiangqiNotationOptions {
  blackNumeralStyle?: XiangqiBlackNumeralStyle;
  blackArabicDigitStyle?: XiangqiArabicDigitStyle;
  blackCharacterVariant?: XiangqiBlackCharacterVariant;
}

const HANZI_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const FULLWIDTH_DIGITS = ['０', '１', '２', '３', '４', '５', '６', '７', '８', '９'];

const RED_PIECE_NAMES: Record<XiangqiPieceType, string> = {
  general: '帅',
  advisor: '仕',
  elephant: '相',
  horse: '马',
  chariot: '车',
  cannon: '炮',
  soldier: '兵'
};

const BLACK_PIECE_NAMES: Record<XiangqiBlackCharacterVariant, Record<XiangqiPieceType, string>> = {
  simplified: {
    general: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '卒'
  },
  traditional: {
    general: '将',
    advisor: '士',
    elephant: '象',
    horse: '馬',
    chariot: '車',
    cannon: '砲',
    soldier: '卒'
  }
};

const DESTINATION_FILE_PIECES = new Set<XiangqiPieceType>(['advisor', 'elephant', 'horse']);

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x <= 8 && y >= 0 && y <= 9;
}

function fileNumberFor(color: XiangqiColor, x: number): number {
  return color === 'red' ? 9 - x : x + 1;
}

function toHanzi(value: number): string {
  if (value >= 0 && value < HANZI_NUMERALS.length) {
    return HANZI_NUMERALS[value];
  }

  return String(value);
}

function toArabic(value: number, digitStyle: XiangqiArabicDigitStyle): string {
  if (digitStyle === 'ascii') {
    return String(value);
  }

  return String(value)
    .split('')
    .map((char) => {
      const digit = Number(char);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return char;
      }
      return FULLWIDTH_DIGITS[digit] ?? char;
    })
    .join('');
}

function formatNumber(color: XiangqiColor, value: number, options: XiangqiNotationOptions): string {
  if (color === 'red') {
    return toHanzi(value);
  }

  if ((options.blackNumeralStyle ?? 'arabic') === 'hanzi') {
    return toHanzi(value);
  }

  return toArabic(value, options.blackArabicDigitStyle ?? 'fullwidth');
}

function isForward(color: XiangqiColor, dy: number): boolean {
  return color === 'red' ? dy < 0 : dy > 0;
}

function resolvePieceName(piece: XiangqiPiece, options: XiangqiNotationOptions): string {
  if (piece.color === 'red') {
    return RED_PIECE_NAMES[piece.type];
  }

  const variant = options.blackCharacterVariant ?? 'simplified';
  return BLACK_PIECE_NAMES[variant][piece.type];
}

export function formatXiangqiMoveNotation(
  state: XiangqiState,
  move: XiangqiMove,
  options: XiangqiNotationOptions = {}
): string {
  if (!inBounds(move.from.x, move.from.y) || !inBounds(move.to.x, move.to.y)) {
    return '';
  }

  const piece = state.board[move.from.y]?.[move.from.x];
  if (!piece || piece.color !== move.player) {
    return '';
  }

  const dy = move.to.y - move.from.y;
  const action = dy === 0 ? '平' : isForward(piece.color, dy) ? '进' : '退';

  let targetNumber: number;
  if (action === '平' || DESTINATION_FILE_PIECES.has(piece.type)) {
    targetNumber = fileNumberFor(piece.color, move.to.x);
  } else {
    targetNumber = Math.abs(dy);
  }

  return `${resolvePieceName(piece, options)}${formatNumber(
    piece.color,
    fileNumberFor(piece.color, move.from.x),
    options
  )}${action}${formatNumber(piece.color, targetNumber, options)}`;
}

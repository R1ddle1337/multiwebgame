import type {
  OnitamaCard,
  OnitamaCardName,
  OnitamaMove,
  OnitamaMoveInput,
  OnitamaPiece,
  OnitamaPlayer,
  OnitamaPosition,
  OnitamaState
} from '@multiwebgame/shared-types';

function otherPlayer(player: OnitamaPlayer): OnitamaPlayer {
  return player === 'black' ? 'white' : 'black';
}

function clonePosition(position: OnitamaPosition): OnitamaPosition {
  return { x: position.x, y: position.y };
}

function cloneBoard(board: OnitamaState['board']): OnitamaState['board'] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function isInBounds(state: OnitamaState, position: OnitamaPosition): boolean {
  return (
    Number.isInteger(position.x) &&
    Number.isInteger(position.y) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < state.boardSize &&
    position.y < state.boardSize
  );
}

function isCardName(value: unknown): value is OnitamaCardName {
  return (
    value === 'tiger' ||
    value === 'dragon' ||
    value === 'frog' ||
    value === 'rabbit' ||
    value === 'crab' ||
    value === 'elephant' ||
    value === 'goose' ||
    value === 'rooster' ||
    value === 'monkey' ||
    value === 'mantis' ||
    value === 'horse' ||
    value === 'ox' ||
    value === 'crane' ||
    value === 'boar' ||
    value === 'eel' ||
    value === 'cobra'
  );
}

function vectorsForPlayer(card: OnitamaCardName, player: OnitamaPlayer): Array<{ dx: number; dy: number }> {
  const base = ONITAMA_CARDS_BY_NAME[card]?.vectors ?? [];
  if (player === 'black') {
    return base.map((vector) => ({ dx: vector.dx, dy: vector.dy }));
  }

  return base.map((vector) => ({ dx: -vector.dx, dy: -vector.dy }));
}

export const ONITAMA_CARDS: OnitamaCard[] = [
  {
    name: 'tiger',
    vectors: [
      { dx: 0, dy: -2 },
      { dx: 0, dy: 1 }
    ]
  },
  {
    name: 'dragon',
    vectors: [
      { dx: -2, dy: 1 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: 2, dy: 1 }
    ]
  },
  {
    name: 'frog',
    vectors: [
      { dx: -2, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: 1 }
    ]
  },
  {
    name: 'rabbit',
    vectors: [
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: 2, dy: 0 }
    ]
  },
  {
    name: 'crab',
    vectors: [
      { dx: -2, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 2, dy: 0 }
    ]
  },
  {
    name: 'elephant',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: -1 }
    ]
  },
  {
    name: 'goose',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 }
    ]
  },
  {
    name: 'rooster',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: -1 }
    ]
  },
  {
    name: 'monkey',
    vectors: [
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 }
    ]
  },
  {
    name: 'mantis',
    vectors: [
      { dx: -1, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: -1 }
    ]
  },
  {
    name: 'horse',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }
    ]
  },
  {
    name: 'ox',
    vectors: [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }
    ]
  },
  {
    name: 'crane',
    vectors: [
      { dx: 0, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 }
    ]
  },
  {
    name: 'boar',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 }
    ]
  },
  {
    name: 'eel',
    vectors: [
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 0 }
    ]
  },
  {
    name: 'cobra',
    vectors: [
      { dx: -1, dy: 0 },
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 }
    ]
  }
];

const ONITAMA_CARDS_BY_NAME = Object.fromEntries(ONITAMA_CARDS.map((card) => [card.name, card])) as Record<
  OnitamaCardName,
  OnitamaCard
>;

export interface CreateOnitamaStateOptions {
  openingCards: OnitamaCardName[];
}

export interface ApplyOnitamaMoveResult {
  accepted: boolean;
  nextState: OnitamaState;
  reason?: string;
}

export function createOnitamaState(options: CreateOnitamaStateOptions): OnitamaState {
  if (!Array.isArray(options.openingCards) || options.openingCards.length !== 5) {
    throw new Error('invalid_opening_cards');
  }

  const cards = options.openingCards.map((card) => card);
  const cardSet = new Set(cards);
  if (cardSet.size !== 5 || cards.some((card) => !isCardName(card))) {
    throw new Error('invalid_opening_cards');
  }

  const boardSize = 5;
  const board: (OnitamaPiece | null)[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null)
  );

  board[4][0] = { player: 'black', kind: 'student' };
  board[4][1] = { player: 'black', kind: 'student' };
  board[4][2] = { player: 'black', kind: 'master' };
  board[4][3] = { player: 'black', kind: 'student' };
  board[4][4] = { player: 'black', kind: 'student' };

  board[0][0] = { player: 'white', kind: 'student' };
  board[0][1] = { player: 'white', kind: 'student' };
  board[0][2] = { player: 'white', kind: 'master' };
  board[0][3] = { player: 'white', kind: 'student' };
  board[0][4] = { player: 'white', kind: 'student' };

  return {
    boardSize,
    board,
    cards: {
      black: [cards[0], cards[1]],
      white: [cards[2], cards[3]],
      side: cards[4]
    },
    nextPlayer: 'black',
    status: 'playing',
    winner: null,
    moveCount: 0
  };
}

export function normalizeOnitamaMove(input: OnitamaMoveInput, player: OnitamaPlayer): OnitamaMove {
  return {
    from: clonePosition(input.from),
    to: clonePosition(input.to),
    card: input.card,
    player
  };
}

export function applyOnitamaMove(state: OnitamaState, move: OnitamaMove): ApplyOnitamaMoveResult {
  if (state.status !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'match_is_not_active'
    };
  }

  if (move.player !== state.nextPlayer) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_turn'
    };
  }

  if (!isInBounds(state, move.from) || !isInBounds(state, move.to)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_bounds'
    };
  }

  if (!isCardName(move.card)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'unknown_card'
    };
  }

  const sourcePiece = state.board[move.from.y][move.from.x];
  if (!sourcePiece) {
    return {
      accepted: false,
      nextState: state,
      reason: 'empty_origin'
    };
  }

  if (sourcePiece.player !== move.player) {
    return {
      accepted: false,
      nextState: state,
      reason: 'piece_not_owned'
    };
  }

  if (!state.cards[move.player].includes(move.card)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'card_not_in_hand'
    };
  }

  const dx = move.to.x - move.from.x;
  const dy = move.to.y - move.from.y;
  const legalVectors = vectorsForPlayer(move.card, move.player);
  const legal = legalVectors.some((vector) => vector.dx === dx && vector.dy === dy);
  if (!legal) {
    return {
      accepted: false,
      nextState: state,
      reason: 'illegal_card_vector'
    };
  }

  const targetPiece = state.board[move.to.y][move.to.x];
  if (targetPiece?.player === move.player) {
    return {
      accepted: false,
      nextState: state,
      reason: 'destination_occupied_by_ally'
    };
  }

  const nextBoard = cloneBoard(state.board);
  nextBoard[move.from.y][move.from.x] = null;
  nextBoard[move.to.y][move.to.x] = {
    player: sourcePiece.player,
    kind: sourcePiece.kind
  };

  const capturedMaster = Boolean(targetPiece && targetPiece.kind === 'master');
  const reachedTemple =
    sourcePiece.kind === 'master' &&
    ((move.player === 'black' && move.to.x === 2 && move.to.y === 0) ||
      (move.player === 'white' && move.to.x === 2 && move.to.y === 4));

  const cards = {
    black: [...state.cards.black],
    white: [...state.cards.white],
    side: state.cards.side
  };
  const hand = cards[move.player];
  const usedIndex = hand.findIndex((card) => card === move.card);
  hand[usedIndex] = cards.side;
  cards.side = move.card;

  const winner = capturedMaster || reachedTemple ? move.player : null;
  const nextPlayer = otherPlayer(move.player);

  return {
    accepted: true,
    nextState: {
      ...state,
      board: nextBoard,
      cards,
      nextPlayer,
      status: winner ? 'completed' : 'playing',
      winner,
      moveCount: state.moveCount + 1
    }
  };
}

export function createOnitamaCardPool(): OnitamaCardName[] {
  return ONITAMA_CARDS.map((card) => card.name);
}

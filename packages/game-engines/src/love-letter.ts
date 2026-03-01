import type {
  LoveLetterCardName,
  LoveLetterMove,
  LoveLetterMoveInput,
  LoveLetterPlayer,
  LoveLetterState
} from '@multiwebgame/shared-types';

const CARD_VALUES: Record<LoveLetterCardName, number> = {
  guard: 1,
  priest: 2,
  baron: 3,
  handmaid: 4,
  prince: 5,
  king: 6,
  countess: 7,
  princess: 8
};

const LOVE_LETTER_TWO_PLAYER_FACE_UP_REMOVALS = 3;
const LOVE_LETTER_TWO_PLAYER_TOKEN_TARGET = 7;

function otherPlayer(player: LoveLetterPlayer): LoveLetterPlayer {
  return player === 'black' ? 'white' : 'black';
}

function cloneCards(hand: LoveLetterCardName[]): LoveLetterCardName[] {
  return hand.map((card) => card);
}

function cloneTokens(tokens: LoveLetterRuntimeState['tokens']): LoveLetterRuntimeState['tokens'] {
  return {
    black: tokens.black,
    white: tokens.white
  };
}

function isCard(value: unknown): value is LoveLetterCardName {
  return (
    value === 'guard' ||
    value === 'priest' ||
    value === 'baron' ||
    value === 'handmaid' ||
    value === 'prince' ||
    value === 'king' ||
    value === 'countess' ||
    value === 'princess'
  );
}

function cardValue(card: LoveLetterCardName | undefined): number {
  if (!card) {
    return 0;
  }

  return CARD_VALUES[card];
}

function discardTotal(cards: LoveLetterCardName[]): number {
  return cards.reduce((total, card) => total + cardValue(card), 0);
}

function showdownRoundWinners(state: LoveLetterRuntimeState): LoveLetterPlayer[] {
  const blackScore = cardValue(state.hands.black[0]);
  const whiteScore = cardValue(state.hands.white[0]);
  if (blackScore > whiteScore) {
    return ['black'];
  }
  if (whiteScore > blackScore) {
    return ['white'];
  }

  const blackDiscard = discardTotal(state.discardPiles.black);
  const whiteDiscard = discardTotal(state.discardPiles.white);
  if (blackDiscard > whiteDiscard) {
    return ['black'];
  }
  if (whiteDiscard > blackDiscard) {
    return ['white'];
  }

  return ['black', 'white'];
}

function drawCard(state: LoveLetterRuntimeState, includeFacedown = false): LoveLetterCardName | null {
  const next = state.drawPile[0];
  if (next) {
    state.drawPile = state.drawPile.slice(1);
    return next;
  }

  if (includeFacedown && state.facedownCard) {
    const facedown = state.facedownCard;
    state.facedownCard = null;
    return facedown;
  }

  return null;
}

function eliminatePlayer(state: LoveLetterRuntimeState, player: LoveLetterPlayer): void {
  if (state.eliminated[player]) {
    return;
  }

  state.eliminated = {
    ...state.eliminated,
    [player]: true
  };

  if (state.hands[player].length > 0) {
    state.discardPiles = {
      ...state.discardPiles,
      [player]: [...state.discardPiles[player], ...state.hands[player]]
    };
  }

  state.hands = {
    ...state.hands,
    [player]: []
  };
  state.protected = {
    ...state.protected,
    [player]: false
  };
}

function targetIsValid(
  state: LoveLetterRuntimeState,
  actor: LoveLetterPlayer,
  target: LoveLetterPlayer,
  allowSelf: boolean
): boolean {
  if (state.eliminated[target]) {
    return false;
  }

  if (target === actor) {
    return allowSelf;
  }

  return !state.protected[target];
}

function isRoundDeckExhausted(state: LoveLetterRuntimeState): boolean {
  return state.drawPile.length === 0;
}

function isShowdownReady(state: LoveLetterRuntimeState): boolean {
  return isRoundDeckExhausted(state) && state.hands.black.length <= 1 && state.hands.white.length <= 1;
}

function resolveMatchWinnerByTokens(
  tokens: LoveLetterRuntimeState['tokens'],
  tokenTarget: number
): LoveLetterPlayer | null {
  const blackReached = tokens.black >= tokenTarget;
  const whiteReached = tokens.white >= tokenTarget;

  if (!blackReached && !whiteReached) {
    return null;
  }

  if (blackReached && !whiteReached) {
    return 'black';
  }

  if (whiteReached && !blackReached) {
    return 'white';
  }

  if (tokens.black > tokens.white) {
    return 'black';
  }

  if (tokens.white > tokens.black) {
    return 'white';
  }

  return null;
}

interface LoveLetterRoundSetup {
  drawPile: LoveLetterCardName[];
  facedownCard: LoveLetterCardName | null;
  removedFaceUp: LoveLetterCardName[];
  hands: {
    black: LoveLetterCardName[];
    white: LoveLetterCardName[];
  };
}

function createRoundSetup(
  deckInput: LoveLetterCardName[],
  startingPlayer: LoveLetterPlayer
): LoveLetterRoundSetup {
  if (!Array.isArray(deckInput) || deckInput.length < 8) {
    throw new Error('love_letter_deck_too_small');
  }

  if (deckInput.some((card) => !isCard(card))) {
    throw new Error('invalid_love_letter_deck');
  }

  const deck = deckInput.map((card) => card);
  const facedownCard = deck.shift() ?? null;

  const removedFaceUp: LoveLetterCardName[] = [];
  for (let index = 0; index < LOVE_LETTER_TWO_PLAYER_FACE_UP_REMOVALS; index += 1) {
    const removed = deck.shift();
    if (!removed) {
      throw new Error('love_letter_deck_too_small');
    }
    removedFaceUp.push(removed);
  }

  const blackFirst = deck.shift();
  const whiteFirst = deck.shift();
  if (!blackFirst || !whiteFirst) {
    throw new Error('love_letter_deck_too_small');
  }

  const startingExtra = deck.shift();
  if (!startingExtra) {
    throw new Error('love_letter_deck_too_small');
  }

  const hands = {
    black: [blackFirst],
    white: [whiteFirst]
  } satisfies Record<LoveLetterPlayer, LoveLetterCardName[]>;

  hands[startingPlayer].push(startingExtra);

  return {
    drawPile: deck,
    facedownCard,
    removedFaceUp,
    hands
  };
}

export interface LoveLetterRuntimeState {
  drawPile: LoveLetterCardName[];
  facedownCard: LoveLetterCardName | null;
  removedFaceUp: LoveLetterCardName[];
  hands: {
    black: LoveLetterCardName[];
    white: LoveLetterCardName[];
  };
  discardPiles: {
    black: LoveLetterCardName[];
    white: LoveLetterCardName[];
  };
  eliminated: {
    black: boolean;
    white: boolean;
  };
  protected: {
    black: boolean;
    white: boolean;
  };
  nextPlayer: LoveLetterPlayer;
  status: 'playing' | 'completed';
  winner: LoveLetterPlayer | null;
  moveCount: number;
  turnCount: number;
  round: number;
  tokenTarget: number;
  tokens: {
    black: number;
    white: number;
  };
}

export interface CreateLoveLetterStateOptions {
  deck: LoveLetterCardName[];
  startingPlayer?: LoveLetterPlayer;
  tokenTarget?: number;
}

export interface ApplyLoveLetterMoveResult {
  accepted: boolean;
  nextState: LoveLetterRuntimeState;
  reason?: string;
}

export function createLoveLetterDeck(): LoveLetterCardName[] {
  return [
    'guard',
    'guard',
    'guard',
    'guard',
    'guard',
    'priest',
    'priest',
    'baron',
    'baron',
    'handmaid',
    'handmaid',
    'prince',
    'prince',
    'king',
    'countess',
    'princess'
  ];
}

export function createLoveLetterState(options: CreateLoveLetterStateOptions): LoveLetterRuntimeState {
  const startingPlayer = options.startingPlayer ?? 'black';
  const tokenTarget = options.tokenTarget ?? LOVE_LETTER_TWO_PLAYER_TOKEN_TARGET;
  if (!Number.isInteger(tokenTarget) || tokenTarget <= 0) {
    throw new Error('invalid_love_letter_token_target');
  }

  const setup = createRoundSetup(options.deck, startingPlayer);

  return {
    drawPile: setup.drawPile,
    facedownCard: setup.facedownCard,
    removedFaceUp: setup.removedFaceUp,
    hands: setup.hands,
    discardPiles: {
      black: [],
      white: []
    },
    eliminated: {
      black: false,
      white: false
    },
    protected: {
      black: false,
      white: false
    },
    nextPlayer: startingPlayer,
    status: 'playing',
    winner: null,
    moveCount: 0,
    turnCount: 1,
    round: 1,
    tokenTarget,
    tokens: {
      black: 0,
      white: 0
    }
  };
}

export function normalizeLoveLetterMove(
  input: LoveLetterMoveInput,
  player: LoveLetterPlayer
): LoveLetterMove {
  return {
    type: 'play',
    card: input.card,
    target: input.target,
    guess: input.guess,
    player
  };
}

export function toLoveLetterPublicState(
  state: LoveLetterRuntimeState,
  viewer: LoveLetterPlayer | null
): LoveLetterState {
  return {
    nextPlayer: state.nextPlayer,
    status: state.status,
    winner: state.winner,
    moveCount: state.moveCount,
    turnCount: state.turnCount,
    round: state.round,
    tokenTarget: state.tokenTarget,
    tokens: cloneTokens(state.tokens),
    drawPileCount: state.drawPile.length + (state.facedownCard ? 1 : 0),
    removedFaceUp: cloneCards(state.removedFaceUp),
    handCounts: {
      black: state.hands.black.length,
      white: state.hands.white.length
    },
    hand: viewer ? cloneCards(state.hands[viewer]) : null,
    discardPiles: {
      black: cloneCards(state.discardPiles.black),
      white: cloneCards(state.discardPiles.white)
    },
    eliminated: {
      black: state.eliminated.black,
      white: state.eliminated.white
    },
    protected: {
      black: state.protected.black,
      white: state.protected.white
    }
  };
}

function completeRound(
  stateAfterMove: LoveLetterRuntimeState,
  roundWinners: LoveLetterPlayer[],
  drawRoundDeck: () => LoveLetterCardName[]
): ApplyLoveLetterMoveResult {
  const nextTokens = cloneTokens(stateAfterMove.tokens);
  for (const winner of roundWinners) {
    nextTokens[winner] += 1;
  }

  const reachedTarget =
    nextTokens.black >= stateAfterMove.tokenTarget || nextTokens.white >= stateAfterMove.tokenTarget;
  if (reachedTarget) {
    return {
      accepted: true,
      nextState: {
        ...stateAfterMove,
        status: 'completed',
        winner: resolveMatchWinnerByTokens(nextTokens, stateAfterMove.tokenTarget),
        tokens: nextTokens
      }
    };
  }

  const nextStartingPlayer = roundWinners.length === 1 ? roundWinners[0] : stateAfterMove.nextPlayer;

  let roundDeck: LoveLetterCardName[];
  try {
    roundDeck = drawRoundDeck();
  } catch {
    return {
      accepted: false,
      nextState: stateAfterMove,
      reason: 'invalid_round_deck'
    };
  }

  let setup: LoveLetterRoundSetup;
  try {
    setup = createRoundSetup(roundDeck, nextStartingPlayer);
  } catch {
    return {
      accepted: false,
      nextState: stateAfterMove,
      reason: 'invalid_round_deck'
    };
  }

  return {
    accepted: true,
    nextState: {
      ...stateAfterMove,
      drawPile: setup.drawPile,
      facedownCard: setup.facedownCard,
      removedFaceUp: setup.removedFaceUp,
      hands: setup.hands,
      discardPiles: {
        black: [],
        white: []
      },
      eliminated: {
        black: false,
        white: false
      },
      protected: {
        black: false,
        white: false
      },
      nextPlayer: nextStartingPlayer,
      status: 'playing',
      winner: null,
      turnCount: 1,
      round: stateAfterMove.round + 1,
      tokens: nextTokens
    }
  };
}

export function applyLoveLetterMove(
  state: LoveLetterRuntimeState,
  move: LoveLetterMove,
  drawRoundDeck: () => LoveLetterCardName[] = createLoveLetterDeck
): ApplyLoveLetterMoveResult {
  if (state.status !== 'playing') {
    return { accepted: false, nextState: state, reason: 'match_is_not_active' };
  }

  if (move.type !== 'play') {
    return { accepted: false, nextState: state, reason: 'invalid_move' };
  }

  if (move.player !== state.nextPlayer) {
    return { accepted: false, nextState: state, reason: 'out_of_turn' };
  }

  if (state.eliminated[move.player]) {
    return { accepted: false, nextState: state, reason: 'player_eliminated' };
  }

  const opponent = otherPlayer(move.player);
  const hand = state.hands[move.player];
  const cardIndex = hand.findIndex((card) => card === move.card);
  if (cardIndex < 0) {
    return { accepted: false, nextState: state, reason: 'card_not_in_hand' };
  }

  const hasCountess = hand.includes('countess');
  const hasKingOrPrince = hand.includes('king') || hand.includes('prince');
  if (move.card !== 'countess' && hasCountess && hasKingOrPrince) {
    return { accepted: false, nextState: state, reason: 'must_play_countess' };
  }

  const next: LoveLetterRuntimeState = {
    drawPile: cloneCards(state.drawPile),
    facedownCard: state.facedownCard,
    removedFaceUp: cloneCards(state.removedFaceUp),
    hands: {
      black: cloneCards(state.hands.black),
      white: cloneCards(state.hands.white)
    },
    discardPiles: {
      black: cloneCards(state.discardPiles.black),
      white: cloneCards(state.discardPiles.white)
    },
    eliminated: {
      black: state.eliminated.black,
      white: state.eliminated.white
    },
    protected: {
      black: state.protected.black,
      white: state.protected.white
    },
    nextPlayer: state.nextPlayer,
    status: state.status,
    winner: state.winner,
    moveCount: state.moveCount + 1,
    turnCount: state.turnCount,
    round: state.round,
    tokenTarget: state.tokenTarget,
    tokens: cloneTokens(state.tokens)
  };

  next.hands[move.player] = next.hands[move.player].filter((_card, index) => index !== cardIndex);
  next.discardPiles[move.player].push(move.card);

  if (move.card === 'guard') {
    const target = move.target ?? opponent;
    if (!targetIsValid(next, move.player, target, false)) {
      return { accepted: false, nextState: state, reason: 'invalid_target' };
    }

    if (!move.guess || !isCard(move.guess) || move.guess === 'guard') {
      return { accepted: false, nextState: state, reason: 'invalid_guess' };
    }

    if (next.hands[target][0] === move.guess) {
      eliminatePlayer(next, target);
    }
  } else if (move.card === 'priest') {
    const target = move.target ?? opponent;
    if (!targetIsValid(next, move.player, target, false)) {
      return { accepted: false, nextState: state, reason: 'invalid_target' };
    }
  } else if (move.card === 'baron') {
    const target = move.target ?? opponent;
    if (!targetIsValid(next, move.player, target, false)) {
      return { accepted: false, nextState: state, reason: 'invalid_target' };
    }

    const actorValue = cardValue(next.hands[move.player][0]);
    const targetValue = cardValue(next.hands[target][0]);
    if (actorValue > targetValue) {
      eliminatePlayer(next, target);
    } else if (targetValue > actorValue) {
      eliminatePlayer(next, move.player);
    }
  } else if (move.card === 'handmaid') {
    next.protected = {
      ...next.protected,
      [move.player]: true
    };
  } else if (move.card === 'prince') {
    const target = move.target ?? opponent;
    if (!targetIsValid(next, move.player, target, true)) {
      return { accepted: false, nextState: state, reason: 'invalid_target' };
    }

    const discarded = next.hands[target][0];
    if (discarded) {
      next.discardPiles[target].push(discarded);
      next.hands[target] = [];
    }

    if (discarded === 'princess') {
      eliminatePlayer(next, target);
    } else if (!next.eliminated[target]) {
      const drawn = drawCard(next, true);
      if (drawn) {
        next.hands[target].push(drawn);
      }
    }
  } else if (move.card === 'king') {
    const target = move.target ?? opponent;
    if (!targetIsValid(next, move.player, target, false)) {
      return { accepted: false, nextState: state, reason: 'invalid_target' };
    }

    const actorHand = next.hands[move.player];
    next.hands[move.player] = next.hands[target];
    next.hands[target] = actorHand;
  } else if (move.card === 'princess') {
    eliminatePlayer(next, move.player);
  }

  if (next.eliminated.black && next.eliminated.white) {
    return completeRound(next, [], drawRoundDeck);
  }

  if (next.eliminated.black) {
    return completeRound(next, ['white'], drawRoundDeck);
  }

  if (next.eliminated.white) {
    return completeRound(next, ['black'], drawRoundDeck);
  }

  if (isShowdownReady(next)) {
    return completeRound(next, showdownRoundWinners(next), drawRoundDeck);
  }

  let nextPlayer = opponent;
  if (next.eliminated[nextPlayer]) {
    nextPlayer = move.player;
  }

  next.nextPlayer = nextPlayer;
  next.turnCount += 1;

  next.protected = {
    ...next.protected,
    [nextPlayer]: false
  };

  if (!next.eliminated[nextPlayer] && next.hands[nextPlayer].length < 2) {
    const drawn = drawCard(next);
    if (drawn) {
      next.hands[nextPlayer].push(drawn);
    }
  }

  if (isShowdownReady(next)) {
    return completeRound(next, showdownRoundWinners(next), drawRoundDeck);
  }

  return {
    accepted: true,
    nextState: next
  };
}

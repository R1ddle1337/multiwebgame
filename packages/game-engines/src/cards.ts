import type {
  CardsCard,
  CardsMove,
  CardsPlayer,
  CardsRank,
  CardsState,
  CardsSuit
} from '@multiwebgame/shared-types';

const SUITS: CardsSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: CardsRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function otherPlayer(player: CardsPlayer): CardsPlayer {
  return player === 'black' ? 'white' : 'black';
}

function cardsEqual(a: CardsCard, b: CardsCard): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function cloneCard(card: CardsCard): CardsCard {
  return {
    suit: card.suit,
    rank: card.rank
  };
}

function isSuit(value: unknown): value is CardsSuit {
  return value === 'clubs' || value === 'diamonds' || value === 'hearts' || value === 'spades';
}

function topDiscard(state: CardsRuntimeState): CardsCard {
  return state.discardPile[state.discardPile.length - 1];
}

function handHasPlayableCard(state: CardsRuntimeState, player: CardsPlayer): boolean {
  return state.hands[player].some((card) => canPlayCardsCard(state, card));
}

export interface CardsRuntimeState {
  drawPile: CardsCard[];
  discardPile: CardsCard[];
  hands: {
    black: CardsCard[];
    white: CardsCard[];
  };
  nextPlayer: CardsPlayer;
  status: 'playing' | 'completed';
  winner: CardsPlayer | null;
  moveCount: number;
  activeSuit: CardsSuit;
  pendingDrawPlay: boolean;
  stalledTurns: number;
}

export interface CreateCardsStateOptions {
  deck: CardsCard[];
  startingPlayer?: CardsPlayer;
}

export interface ApplyCardsMoveResult {
  nextState: CardsRuntimeState;
  accepted: boolean;
  reason?: string;
}

export function createCardsDeck(): CardsCard[] {
  const cards: CardsCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank });
    }
  }

  return cards;
}

export function createCardsState(options: CreateCardsStateOptions): CardsRuntimeState {
  if (!Array.isArray(options.deck) || options.deck.length < 11) {
    throw new Error('cards_deck_too_small');
  }

  const deck = options.deck.map(cloneCard);
  const blackHand = deck.splice(0, 5);
  const whiteHand = deck.splice(0, 5);
  const openingCard = deck.shift();
  if (!openingCard) {
    throw new Error('cards_missing_opening_card');
  }

  return {
    drawPile: deck,
    discardPile: [openingCard],
    hands: {
      black: blackHand,
      white: whiteHand
    },
    nextPlayer: options.startingPlayer ?? 'black',
    status: 'playing',
    winner: null,
    moveCount: 0,
    activeSuit: openingCard.suit,
    pendingDrawPlay: false,
    stalledTurns: 0
  };
}

export function canPlayCardsCard(state: CardsRuntimeState, card: CardsCard): boolean {
  const top = topDiscard(state);
  return card.rank === '8' || card.suit === state.activeSuit || card.rank === top.rank;
}

export function toCardsPublicState(
  state: CardsRuntimeState,
  viewer: CardsPlayer | null,
  showDrawPileCount: boolean
): CardsState {
  const top = topDiscard(state);
  return {
    nextPlayer: state.nextPlayer,
    status: state.status,
    winner: state.winner,
    topCard: cloneCard(top),
    activeSuit: state.activeSuit,
    moveCount: state.moveCount,
    handCounts: {
      black: state.hands.black.length,
      white: state.hands.white.length
    },
    hand: viewer ? state.hands[viewer].map(cloneCard) : null,
    drawPileCount: showDrawPileCount ? state.drawPile.length : null,
    discardPileCount: state.discardPile.length,
    pendingDrawPlay: state.pendingDrawPlay
  };
}

export function applyCardsMove(state: CardsRuntimeState, move: CardsMove): ApplyCardsMoveResult {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (move.type === 'end_turn') {
    if (!state.pendingDrawPlay) {
      return { nextState: state, accepted: false, reason: 'end_turn_not_allowed' };
    }

    return {
      accepted: true,
      nextState: {
        ...state,
        nextPlayer: otherPlayer(move.player),
        pendingDrawPlay: false,
        moveCount: state.moveCount + 1
      }
    };
  }

  if (move.type === 'draw') {
    if (state.pendingDrawPlay) {
      return { nextState: state, accepted: false, reason: 'must_resolve_draw_play' };
    }

    if (handHasPlayableCard(state, move.player)) {
      return {
        nextState: state,
        accepted: false,
        reason: 'draw_not_allowed_when_playable'
      };
    }

    if (state.drawPile.length === 0) {
      const stalledTurns = state.stalledTurns + 1;
      const ended = stalledTurns >= 2;
      return {
        accepted: true,
        nextState: {
          ...state,
          nextPlayer: otherPlayer(move.player),
          moveCount: state.moveCount + 1,
          stalledTurns,
          pendingDrawPlay: false,
          status: ended ? 'completed' : 'playing',
          winner: ended ? null : state.winner
        }
      };
    }

    const [drawnCard, ...remainingDrawPile] = state.drawPile;
    const nextHand = [...state.hands[move.player], drawnCard];
    const playableAfterDraw = canPlayCardsCard(state, drawnCard);
    const nextState: CardsRuntimeState = {
      ...state,
      drawPile: remainingDrawPile,
      hands: {
        ...state.hands,
        [move.player]: nextHand
      },
      moveCount: state.moveCount + 1,
      pendingDrawPlay: playableAfterDraw,
      nextPlayer: playableAfterDraw ? move.player : otherPlayer(move.player),
      stalledTurns: 0
    };

    return {
      accepted: true,
      nextState
    };
  }

  const hand = state.hands[move.player];
  const cardIndex = hand.findIndex((card) => cardsEqual(card, move.card));
  if (cardIndex < 0) {
    return {
      nextState: state,
      accepted: false,
      reason: 'card_not_in_hand'
    };
  }

  if (!canPlayCardsCard(state, move.card)) {
    return {
      nextState: state,
      accepted: false,
      reason: 'card_not_playable'
    };
  }

  if (move.card.rank === '8' && !isSuit(move.chosenSuit)) {
    return {
      nextState: state,
      accepted: false,
      reason: 'choose_suit_required'
    };
  }

  const nextHand = hand.filter((_, index) => index !== cardIndex);
  const winner = nextHand.length === 0 ? move.player : null;

  return {
    accepted: true,
    nextState: {
      ...state,
      hands: {
        ...state.hands,
        [move.player]: nextHand
      },
      discardPile: [...state.discardPile, cloneCard(move.card)],
      activeSuit: move.card.rank === '8' ? (move.chosenSuit as CardsSuit) : move.card.suit,
      nextPlayer: winner ? state.nextPlayer : otherPlayer(move.player),
      status: winner ? 'completed' : 'playing',
      winner,
      moveCount: state.moveCount + 1,
      pendingDrawPlay: false,
      stalledTurns: 0
    }
  };
}

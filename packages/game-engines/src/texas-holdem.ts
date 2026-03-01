import type {
  CardsCard,
  CardsRank,
  CardsSuit,
  TexasHoldemMove,
  TexasHoldemMoveInput,
  TexasHoldemSeatState,
  TexasHoldemShowdownEntry,
  TexasHoldemState,
  TexasHoldemStreet
} from '@multiwebgame/shared-types';

const SUITS: CardsSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS: CardsRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_VALUE: Record<CardsRank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

type HandCategory = TexasHoldemShowdownEntry['category'];

interface HandRank {
  category: HandCategory;
  strength: number[];
}

export interface TexasHoldemRuntimeSeatState extends TexasHoldemSeatState {
  actedThisStreet: boolean;
}

export interface TexasHoldemRuntimeState extends Omit<TexasHoldemState, 'seats'> {
  seats: TexasHoldemRuntimeSeatState[];
  deck: CardsCard[];
  pendingActionSeats: number[];
  lastFullRaise: number;
}

export interface CreateTexasHoldemStateOptions {
  players: Array<{ seat: number; userId: string }>;
  startingStack?: number;
  smallBlind?: number;
  bigBlind?: number;
  buttonSeat?: number | null;
}

export interface StartTexasHoldemHandResult {
  accepted: boolean;
  nextState: TexasHoldemRuntimeState;
  reason?: string;
}

export interface ApplyTexasHoldemMoveResult {
  accepted: boolean;
  nextState: TexasHoldemRuntimeState;
  reason?: string;
}

function cloneCard(card: CardsCard): CardsCard {
  return {
    suit: card.suit,
    rank: card.rank
  };
}

function cloneCards(cards: CardsCard[]): CardsCard[] {
  return cards.map(cloneCard);
}

function cloneSeat(seat: TexasHoldemRuntimeSeatState): TexasHoldemRuntimeSeatState {
  return {
    seat: seat.seat,
    userId: seat.userId,
    stack: seat.stack,
    inHand: seat.inHand,
    folded: seat.folded,
    allIn: seat.allIn,
    bet: seat.bet,
    totalCommitted: seat.totalCommitted,
    holeCards: seat.holeCards ? cloneCards(seat.holeCards) : null,
    actedThisStreet: seat.actedThisStreet
  };
}

function cloneShowdownEntry(entry: TexasHoldemShowdownEntry): TexasHoldemShowdownEntry {
  return {
    seat: entry.seat,
    userId: entry.userId,
    category: entry.category
  };
}

function cloneRuntimeState(state: TexasHoldemRuntimeState): TexasHoldemRuntimeState {
  return {
    ...state,
    board: cloneCards(state.board),
    seats: state.seats.map(cloneSeat),
    showdown: state.showdown ? state.showdown.map(cloneShowdownEntry) : null,
    winnerUserIds: state.winnerUserIds ? [...state.winnerUserIds] : null,
    lastHandWinners: state.lastHandWinners ? state.lastHandWinners.map((entry) => ({ ...entry })) : null,
    deck: cloneCards(state.deck),
    pendingActionSeats: [...state.pendingActionSeats]
  };
}

function sortSeatsAscending(seats: TexasHoldemRuntimeSeatState[]): TexasHoldemRuntimeSeatState[] {
  return [...seats].sort((left, right) => left.seat - right.seat);
}

function seatByNumber(
  seats: TexasHoldemRuntimeSeatState[],
  seatNumber: number
): TexasHoldemRuntimeSeatState | undefined {
  return seats.find((seat) => seat.seat === seatNumber);
}

function activeSeatNumbers(seats: TexasHoldemRuntimeSeatState[]): number[] {
  return sortSeatsAscending(seats)
    .filter((seat) => seat.stack > 0)
    .map((seat) => seat.seat);
}

function nextSeatFrom(activeSeats: number[], fromSeat: number | null): number | null {
  if (activeSeats.length === 0) {
    return null;
  }

  if (fromSeat === null) {
    return activeSeats[0] ?? null;
  }

  for (const seat of activeSeats) {
    if (seat > fromSeat) {
      return seat;
    }
  }

  return activeSeats[0] ?? null;
}

function nextPendingSeat(currentSeat: number, pendingSeats: number[], orderedSeats: number[]): number | null {
  if (pendingSeats.length === 0) {
    return null;
  }

  const pending = new Set(pendingSeats);
  const startingIndex = orderedSeats.indexOf(currentSeat);
  if (startingIndex < 0) {
    return pendingSeats[0] ?? null;
  }

  for (let offset = 1; offset <= orderedSeats.length; offset += 1) {
    const candidate = orderedSeats[(startingIndex + offset) % orderedSeats.length];
    if (pending.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isDuplicateCard(cards: CardsCard[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    const key = `${card.rank}:${card.suit}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

function buildDefaultSeats(
  players: Array<{ seat: number; userId: string }>,
  startingStack: number
): TexasHoldemRuntimeSeatState[] {
  const uniqueSeats = new Set<number>();
  const uniqueUsers = new Set<string>();

  for (const player of players) {
    if (!Number.isInteger(player.seat) || player.seat < 1 || player.seat > 6) {
      throw new Error('invalid_texas_holdem_seat');
    }
    if (!player.userId || typeof player.userId !== 'string') {
      throw new Error('invalid_texas_holdem_user');
    }
    if (uniqueSeats.has(player.seat)) {
      throw new Error('duplicate_texas_holdem_seat');
    }
    if (uniqueUsers.has(player.userId)) {
      throw new Error('duplicate_texas_holdem_user');
    }
    uniqueSeats.add(player.seat);
    uniqueUsers.add(player.userId);
  }

  if (players.length < 2 || players.length > 6) {
    throw new Error('invalid_texas_holdem_player_count');
  }

  return [...players]
    .sort((left, right) => left.seat - right.seat)
    .map((player) => ({
      seat: player.seat,
      userId: player.userId,
      stack: startingStack,
      inHand: false,
      folded: false,
      allIn: false,
      bet: 0,
      totalCommitted: 0,
      holeCards: null,
      actedThisStreet: false
    }));
}

export function createTexasHoldemDeck(): CardsCard[] {
  const deck: CardsCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

function rankCounts(cards: CardsCard[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const card of cards) {
    const value = RANK_VALUE[card.rank];
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function straightHighCard(ranks: number[]): number | null {
  const unique = [...new Set(ranks)].sort((left, right) => right - left);
  if (unique.includes(14)) {
    unique.push(1);
  }

  for (let index = 0; index <= unique.length - 5; index += 1) {
    const slice = unique.slice(index, index + 5);
    let valid = true;
    for (let i = 1; i < slice.length; i += 1) {
      if (slice[i - 1] - slice[i] !== 1) {
        valid = false;
        break;
      }
    }

    if (valid) {
      return slice[0] === 1 ? 5 : slice[0];
    }
  }

  return null;
}

function compareStrength(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  }
  return 0;
}

function evaluateFiveCardHand(cards: CardsCard[]): HandRank {
  const ranks = cards.map((card) => RANK_VALUE[card.rank]).sort((left, right) => right - left);
  const counts = rankCounts(cards);
  const isFlush = cards.every((card) => card.suit === cards[0]?.suit);
  const straightHigh = straightHighCard(ranks);

  const byCountThenRank = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return right[0] - left[0];
  });

  if (isFlush && straightHigh !== null) {
    return {
      category: 'straight_flush',
      strength: [8, straightHigh]
    };
  }

  if (byCountThenRank[0]?.[1] === 4) {
    const quad = byCountThenRank[0][0];
    const kicker = byCountThenRank[1][0];
    return {
      category: 'four_of_a_kind',
      strength: [7, quad, kicker]
    };
  }

  if (byCountThenRank[0]?.[1] === 3 && byCountThenRank[1]?.[1] === 2) {
    return {
      category: 'full_house',
      strength: [6, byCountThenRank[0][0], byCountThenRank[1][0]]
    };
  }

  if (isFlush) {
    return {
      category: 'flush',
      strength: [5, ...ranks]
    };
  }

  if (straightHigh !== null) {
    return {
      category: 'straight',
      strength: [4, straightHigh]
    };
  }

  if (byCountThenRank[0]?.[1] === 3) {
    const trip = byCountThenRank[0][0];
    const kickers = byCountThenRank
      .slice(1)
      .map((entry) => entry[0])
      .sort((left, right) => right - left);
    return {
      category: 'three_of_a_kind',
      strength: [3, trip, ...kickers]
    };
  }

  if (byCountThenRank[0]?.[1] === 2 && byCountThenRank[1]?.[1] === 2) {
    const highPair = Math.max(byCountThenRank[0][0], byCountThenRank[1][0]);
    const lowPair = Math.min(byCountThenRank[0][0], byCountThenRank[1][0]);
    const kicker = byCountThenRank[2][0];
    return {
      category: 'two_pair',
      strength: [2, highPair, lowPair, kicker]
    };
  }

  if (byCountThenRank[0]?.[1] === 2) {
    const pair = byCountThenRank[0][0];
    const kickers = byCountThenRank
      .slice(1)
      .map((entry) => entry[0])
      .sort((left, right) => right - left);
    return {
      category: 'pair',
      strength: [1, pair, ...kickers]
    };
  }

  return {
    category: 'high_card',
    strength: [0, ...ranks]
  };
}

export function evaluateTexasHoldemBestHand(cards: CardsCard[]): HandRank {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) {
    throw new Error('invalid_texas_holdem_hand_size');
  }

  let best: HandRank | null = null;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const candidate = evaluateFiveCardHand([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareStrength(candidate.strength, best.strength) > 0) {
              best = candidate;
            }
          }
        }
      }
    }
  }

  if (!best) {
    throw new Error('texas_holdem_best_hand_missing');
  }

  return best;
}

function validateBetAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isInteger(amount) && amount > 0;
}

function collectPendingActionSeats(state: TexasHoldemRuntimeState): number[] {
  return state.seats.filter((seat) => seat.inHand && !seat.folded && !seat.allIn).map((seat) => seat.seat);
}

function resetStreetBets(state: TexasHoldemRuntimeState): void {
  for (const seat of state.seats) {
    seat.bet = 0;
    seat.actedThisStreet = false;
    seat.allIn = seat.inHand && seat.stack === 0;
  }
  state.currentBet = 0;
  state.minRaiseTo = state.bigBlind;
  state.lastFullRaise = state.bigBlind;
}

function popDeck(state: TexasHoldemRuntimeState): CardsCard {
  const card = state.deck.shift();
  if (!card) {
    throw new Error('texas_holdem_deck_exhausted');
  }
  return card;
}

function dealHoleCards(state: TexasHoldemRuntimeState, buttonSeat: number): void {
  const actives = sortSeatsAscending(state.seats).filter((seat) => seat.inHand);
  const order: TexasHoldemRuntimeSeatState[] = [];

  let currentSeat = buttonSeat;
  for (let index = 0; index < actives.length; index += 1) {
    const nextSeat = nextSeatFrom(
      actives.map((seat) => seat.seat),
      currentSeat
    );
    if (nextSeat === null) {
      break;
    }

    const found = actives.find((seat) => seat.seat === nextSeat);
    if (!found) {
      break;
    }

    order.push(found);
    currentSeat = nextSeat;
  }

  for (let round = 0; round < 2; round += 1) {
    for (const seat of order) {
      seat.holeCards = [...(seat.holeCards ?? []), popDeck(state)];
    }
  }
}

function postBlind(state: TexasHoldemRuntimeState, seatNumber: number, amount: number): number {
  const seat = seatByNumber(state.seats, seatNumber);
  if (!seat || !seat.inHand || seat.folded || seat.stack <= 0 || amount <= 0) {
    return 0;
  }

  const paid = Math.min(seat.stack, amount);
  seat.stack -= paid;
  seat.bet += paid;
  seat.totalCommitted += paid;
  seat.allIn = seat.stack === 0;
  state.pot += paid;
  return paid;
}

function firstToActPreflop(
  state: TexasHoldemRuntimeState,
  buttonSeat: number,
  bigBlindSeat: number
): number | null {
  const eligible = collectPendingActionSeats(state);
  if (eligible.length === 0) {
    return null;
  }

  if (eligible.length === 2) {
    return buttonSeat;
  }

  return nextSeatFrom(eligible, bigBlindSeat);
}

function firstToActPostflop(state: TexasHoldemRuntimeState, buttonSeat: number | null): number | null {
  const eligible = collectPendingActionSeats(state);
  if (eligible.length === 0) {
    return null;
  }

  return nextSeatFrom(eligible, buttonSeat);
}

function remainingInHand(state: TexasHoldemRuntimeState): TexasHoldemRuntimeSeatState[] {
  return state.seats.filter((seat) => seat.inHand && !seat.folded);
}

function awardUncontestedPot(state: TexasHoldemRuntimeState): void {
  const contenders = remainingInHand(state);
  const winner = contenders[0];
  if (!winner) {
    return;
  }

  winner.stack += state.pot;
  state.lastHandWinners = [{ seat: winner.seat, userId: winner.userId, amount: state.pot }];
  state.showdown = null;
  state.pot = 0;
}

function showdownAndAward(state: TexasHoldemRuntimeState): void {
  const live = remainingInHand(state);
  if (live.length === 0) {
    state.showdown = null;
    state.lastHandWinners = null;
    state.pot = 0;
    return;
  }

  const rankBySeat = new Map<number, HandRank>();
  for (const seat of live) {
    const hole = seat.holeCards ?? [];
    rankBySeat.set(seat.seat, evaluateTexasHoldemBestHand([...hole, ...state.board]));
  }

  state.showdown = live.map((seat) => ({
    seat: seat.seat,
    userId: seat.userId,
    category: rankBySeat.get(seat.seat)?.category ?? 'high_card'
  }));

  const contributions = state.seats
    .filter((seat) => seat.totalCommitted > 0)
    .map((seat) => seat.totalCommitted)
    .sort((left, right) => left - right);
  const uniqueLevels = [...new Set(contributions)];

  const winnings = new Map<number, number>();
  let previousLevel = 0;

  for (const level of uniqueLevels) {
    const involved = state.seats.filter((seat) => seat.totalCommitted >= level);
    const layer = level - previousLevel;
    previousLevel = level;
    if (layer <= 0 || involved.length === 0) {
      continue;
    }

    const sidePot = layer * involved.length;
    const eligible = involved.filter((seat) => seat.inHand && !seat.folded);

    if (eligible.length === 0) {
      continue;
    }

    let best: HandRank | null = null;
    const winners: TexasHoldemRuntimeSeatState[] = [];
    for (const seat of eligible) {
      const rank = rankBySeat.get(seat.seat);
      if (!rank) {
        continue;
      }

      if (!best) {
        best = rank;
        winners.length = 0;
        winners.push(seat);
        continue;
      }

      const compared = compareStrength(rank.strength, best.strength);
      if (compared > 0) {
        best = rank;
        winners.length = 0;
        winners.push(seat);
      } else if (compared === 0) {
        winners.push(seat);
      }
    }

    if (winners.length === 0) {
      continue;
    }

    const split = Math.floor(sidePot / winners.length);
    let remainder = sidePot % winners.length;
    const orderedWinners = [...winners].sort((left, right) => left.seat - right.seat);

    for (const winner of orderedWinners) {
      const current = winnings.get(winner.seat) ?? 0;
      winnings.set(winner.seat, current + split);
    }

    let cursor = nextSeatFrom(
      orderedWinners.map((seat) => seat.seat),
      state.buttonSeat
    );
    while (remainder > 0 && cursor !== null) {
      const current = winnings.get(cursor) ?? 0;
      winnings.set(cursor, current + 1);
      remainder -= 1;
      cursor = nextSeatFrom(
        orderedWinners.map((seat) => seat.seat),
        cursor
      );
    }
  }

  for (const seat of state.seats) {
    const won = winnings.get(seat.seat) ?? 0;
    if (won > 0) {
      seat.stack += won;
    }
  }

  state.lastHandWinners = [...winnings.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([seatNumber, amount]) => {
      const seat = seatByNumber(state.seats, seatNumber)!;
      return {
        seat: seatNumber,
        userId: seat.userId,
        amount
      };
    });

  state.pot = 0;
}

function setNextMatchStageAfterHand(state: TexasHoldemRuntimeState): void {
  const alive = state.seats.filter((seat) => seat.stack > 0);
  if (alive.length <= 1) {
    state.status = 'completed';
    state.stage = 'hand_complete';
    state.actionSeat = null;
    state.pendingActionSeats = [];
    state.winnerUserIds = alive.map((seat) => seat.userId);
    return;
  }

  state.stage = 'awaiting_rng';
  state.actionSeat = null;
  state.pendingActionSeats = [];
  state.winnerUserIds = null;
}

function dealBoardForStreet(state: TexasHoldemRuntimeState, street: TexasHoldemStreet): void {
  if (street === 'flop') {
    popDeck(state);
    state.board.push(popDeck(state), popDeck(state), popDeck(state));
    return;
  }

  if (street === 'turn' || street === 'river') {
    popDeck(state);
    state.board.push(popDeck(state));
  }
}

function maybeFastForwardAllInBoard(state: TexasHoldemRuntimeState): void {
  while (
    state.board.length < 5 &&
    collectPendingActionSeats(state).length === 0 &&
    remainingInHand(state).length > 1
  ) {
    if (state.stage === 'preflop') {
      state.stage = 'flop';
      dealBoardForStreet(state, 'flop');
      continue;
    }

    if (state.stage === 'flop') {
      state.stage = 'turn';
      dealBoardForStreet(state, 'turn');
      continue;
    }

    if (state.stage === 'turn') {
      state.stage = 'river';
      dealBoardForStreet(state, 'river');
      continue;
    }

    break;
  }
}

function beginNextStreet(state: TexasHoldemRuntimeState): void {
  const live = remainingInHand(state);
  if (live.length <= 1) {
    awardUncontestedPot(state);
    setNextMatchStageAfterHand(state);
    return;
  }

  if (state.stage === 'river') {
    state.stage = 'showdown';
    showdownAndAward(state);
    setNextMatchStageAfterHand(state);
    return;
  }

  if (state.stage === 'preflop') {
    state.stage = 'flop';
    resetStreetBets(state);
    dealBoardForStreet(state, 'flop');
  } else if (state.stage === 'flop') {
    state.stage = 'turn';
    resetStreetBets(state);
    dealBoardForStreet(state, 'turn');
  } else if (state.stage === 'turn') {
    state.stage = 'river';
    resetStreetBets(state);
    dealBoardForStreet(state, 'river');
  }

  state.pendingActionSeats = collectPendingActionSeats(state);
  state.actionSeat = firstToActPostflop(state, state.buttonSeat ?? null);

  maybeFastForwardAllInBoard(state);
  if (state.board.length === 5 && collectPendingActionSeats(state).length === 0) {
    state.stage = 'showdown';
    showdownAndAward(state);
    setNextMatchStageAfterHand(state);
  }
}

export function createTexasHoldemState(options: CreateTexasHoldemStateOptions): TexasHoldemRuntimeState {
  const startingStack = options.startingStack ?? 100;
  const smallBlind = options.smallBlind ?? 1;
  const bigBlind = options.bigBlind ?? 2;

  if (!Number.isInteger(startingStack) || startingStack <= 0) {
    throw new Error('invalid_texas_holdem_starting_stack');
  }

  if (!Number.isInteger(smallBlind) || !Number.isInteger(bigBlind) || smallBlind <= 0 || bigBlind <= 0) {
    throw new Error('invalid_texas_holdem_blinds');
  }

  if (smallBlind >= bigBlind) {
    throw new Error('invalid_texas_holdem_blind_order');
  }

  const seats = buildDefaultSeats(options.players, startingStack);
  const activeSeats = activeSeatNumbers(seats);
  const normalizedButton = options.buttonSeat ?? null;
  const buttonSeat =
    normalizedButton !== null && activeSeats.includes(normalizedButton)
      ? normalizedButton
      : (activeSeats[0] ?? null);

  return {
    status: 'playing',
    stage: 'awaiting_rng',
    moveCount: 0,
    handNumber: 0,
    buttonSeat,
    smallBlind,
    bigBlind,
    currentBet: 0,
    minRaiseTo: bigBlind,
    actionSeat: null,
    pot: 0,
    board: [],
    seats,
    showdown: null,
    winnerUserIds: null,
    lastHandWinners: null,
    deck: [],
    pendingActionSeats: [],
    lastFullRaise: bigBlind
  };
}

export function startTexasHoldemHand(
  state: TexasHoldemRuntimeState,
  deckInput: CardsCard[]
): StartTexasHoldemHandResult {
  if (state.status !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'match_is_not_active'
    };
  }

  if (state.stage !== 'awaiting_rng' && state.stage !== 'hand_complete') {
    return {
      accepted: false,
      nextState: state,
      reason: 'hand_already_running'
    };
  }

  if (!Array.isArray(deckInput) || deckInput.length < 52 || isDuplicateCard(deckInput)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'invalid_deck'
    };
  }

  const next = cloneRuntimeState(state);
  const activeSeats = activeSeatNumbers(next.seats);
  if (activeSeats.length < 2) {
    next.status = 'completed';
    next.stage = 'hand_complete';
    next.winnerUserIds = activeSeats
      .map((seatNumber) => seatByNumber(next.seats, seatNumber)?.userId)
      .filter((value): value is string => Boolean(value));
    next.actionSeat = null;
    next.pendingActionSeats = [];
    return {
      accepted: true,
      nextState: next
    };
  }

  next.deck = cloneCards(deckInput);
  next.board = [];
  next.pot = 0;
  next.showdown = null;
  next.lastHandWinners = null;
  next.winnerUserIds = null;
  next.currentBet = 0;
  next.minRaiseTo = next.bigBlind;
  next.lastFullRaise = next.bigBlind;

  for (const seat of next.seats) {
    seat.inHand = seat.stack > 0;
    seat.folded = false;
    seat.allIn = seat.inHand && seat.stack === 0;
    seat.bet = 0;
    seat.totalCommitted = 0;
    seat.holeCards = seat.inHand ? [] : null;
    seat.actedThisStreet = false;
  }

  const button = nextSeatFrom(activeSeats, next.buttonSeat);
  const smallBlindSeat = nextSeatFrom(activeSeats, button);
  const bigBlindSeat = nextSeatFrom(activeSeats, smallBlindSeat);

  if (button === null || smallBlindSeat === null || bigBlindSeat === null) {
    return {
      accepted: false,
      nextState: state,
      reason: 'not_enough_players'
    };
  }

  next.handNumber += 1;
  next.buttonSeat = button;

  dealHoleCards(next, button);

  postBlind(next, smallBlindSeat, next.smallBlind);
  postBlind(next, bigBlindSeat, next.bigBlind);

  next.currentBet = Math.max(...next.seats.map((seat) => seat.bet));
  next.minRaiseTo = next.currentBet + next.bigBlind;
  next.stage = 'preflop';
  next.pendingActionSeats = collectPendingActionSeats(next);
  next.actionSeat = firstToActPreflop(next, button, bigBlindSeat);

  maybeFastForwardAllInBoard(next);
  if (next.board.length === 5 && collectPendingActionSeats(next).length === 0) {
    next.stage = 'showdown';
    showdownAndAward(next);
    setNextMatchStageAfterHand(next);
  }

  return {
    accepted: true,
    nextState: next
  };
}

function applyFold(next: TexasHoldemRuntimeState, seat: TexasHoldemRuntimeSeatState): void {
  seat.folded = true;
  seat.inHand = false;
  seat.actedThisStreet = true;
}

function applyCheck(next: TexasHoldemRuntimeState, seat: TexasHoldemRuntimeSeatState): string | null {
  if (seat.bet !== next.currentBet) {
    return 'cannot_check';
  }

  seat.actedThisStreet = true;
  return null;
}

function applyCall(next: TexasHoldemRuntimeState, seat: TexasHoldemRuntimeSeatState): string | null {
  const toCall = next.currentBet - seat.bet;
  if (toCall <= 0) {
    return 'nothing_to_call';
  }

  const paid = Math.min(seat.stack, toCall);
  if (paid <= 0) {
    return 'cannot_call';
  }

  seat.stack -= paid;
  seat.bet += paid;
  seat.totalCommitted += paid;
  seat.allIn = seat.stack === 0;
  seat.actedThisStreet = true;
  next.pot += paid;
  return null;
}

function applyBetRaise(
  next: TexasHoldemRuntimeState,
  seat: TexasHoldemRuntimeSeatState,
  amount: number
): string | null {
  const previousBet = seat.bet;
  const previousCurrentBet = next.currentBet;
  const maxTo = seat.bet + seat.stack;
  if (maxTo <= previousCurrentBet) {
    return 'all_in_must_call';
  }

  const raiseTo = Math.min(amount, maxTo);
  if (raiseTo <= previousCurrentBet) {
    return 'raise_must_exceed_current_bet';
  }

  const raiseSize = raiseTo - previousCurrentBet;
  const isAllIn = raiseTo === maxTo;
  if (!isAllIn && raiseTo < next.minRaiseTo) {
    return 'raise_below_minimum';
  }

  const paid = raiseTo - previousBet;
  if (paid <= 0 || paid > seat.stack) {
    return 'invalid_raise_amount';
  }

  seat.stack -= paid;
  seat.bet += paid;
  seat.totalCommitted += paid;
  seat.allIn = seat.stack === 0;
  seat.actedThisStreet = true;
  next.pot += paid;

  next.currentBet = raiseTo;
  if (raiseSize >= next.lastFullRaise) {
    next.lastFullRaise = raiseSize;
    next.minRaiseTo = raiseTo + next.lastFullRaise;
  } else {
    next.minRaiseTo = raiseTo + next.lastFullRaise;
  }

  return null;
}

export function applyTexasHoldemMove(
  state: TexasHoldemRuntimeState,
  move: TexasHoldemMove
): ApplyTexasHoldemMoveResult {
  if (state.status !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'match_is_not_active'
    };
  }

  if (
    state.stage !== 'preflop' &&
    state.stage !== 'flop' &&
    state.stage !== 'turn' &&
    state.stage !== 'river'
  ) {
    return {
      accepted: false,
      nextState: state,
      reason: 'hand_not_in_action'
    };
  }

  if (state.actionSeat === null) {
    return {
      accepted: false,
      nextState: state,
      reason: 'no_action_required'
    };
  }

  if (move.seat !== state.actionSeat) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_turn'
    };
  }

  const next = cloneRuntimeState(state);
  const actingSeat = seatByNumber(next.seats, move.seat);
  if (!actingSeat || !actingSeat.inHand || actingSeat.folded || actingSeat.allIn) {
    return {
      accepted: false,
      nextState: state,
      reason: 'seat_cannot_act'
    };
  }

  let reason: string | null = null;
  switch (move.type) {
    case 'fold':
      applyFold(next, actingSeat);
      break;
    case 'check':
      reason = applyCheck(next, actingSeat);
      break;
    case 'call':
      reason = applyCall(next, actingSeat);
      break;
    case 'bet':
      reason = applyBetRaise(next, actingSeat, move.amount);
      break;
  }

  if (reason) {
    return {
      accepted: false,
      nextState: state,
      reason
    };
  }

  next.moveCount += 1;

  if (move.type === 'bet') {
    const pending = collectPendingActionSeats(next).filter((seatNumber) => seatNumber !== move.seat);
    next.pendingActionSeats = pending;
  } else {
    next.pendingActionSeats = next.pendingActionSeats.filter((seatNumber) => seatNumber !== move.seat);
  }

  const liveAfterAction = remainingInHand(next);
  if (liveAfterAction.length <= 1) {
    awardUncontestedPot(next);
    setNextMatchStageAfterHand(next);
    return {
      accepted: true,
      nextState: next
    };
  }

  if (next.pendingActionSeats.length === 0) {
    beginNextStreet(next);
    return {
      accepted: true,
      nextState: next
    };
  }

  const orderedSeats = sortSeatsAscending(next.seats)
    .filter((seat) => seat.inHand && !seat.folded && !seat.allIn)
    .map((seat) => seat.seat);

  next.actionSeat = nextPendingSeat(move.seat, next.pendingActionSeats, orderedSeats);
  if (next.actionSeat === null) {
    beginNextStreet(next);
  }

  return {
    accepted: true,
    nextState: next
  };
}

export function normalizeTexasHoldemMove(input: TexasHoldemMoveInput, seat: number): TexasHoldemMove {
  if (input.type === 'bet') {
    return {
      type: 'bet',
      seat,
      amount: validateBetAmount(input.amount) ? input.amount : 0
    };
  }

  return {
    type: input.type,
    seat
  };
}

export function toTexasHoldemPublicState(
  state: TexasHoldemRuntimeState,
  viewerUserId: string | null,
  revealAll = false
): TexasHoldemState {
  const showAll = revealAll || state.status === 'completed';

  return {
    status: state.status,
    stage: state.stage,
    moveCount: state.moveCount,
    handNumber: state.handNumber,
    buttonSeat: state.buttonSeat,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    currentBet: state.currentBet,
    minRaiseTo: state.minRaiseTo,
    actionSeat: state.actionSeat,
    pot: state.pot,
    board: cloneCards(state.board),
    seats: state.seats.map((seat) => ({
      seat: seat.seat,
      userId: seat.userId,
      stack: seat.stack,
      inHand: seat.inHand,
      folded: seat.folded,
      allIn: seat.allIn,
      bet: seat.bet,
      totalCommitted: seat.totalCommitted,
      holeCards:
        showAll || viewerUserId === seat.userId ? (seat.holeCards ? cloneCards(seat.holeCards) : null) : null
    })),
    showdown: state.showdown ? state.showdown.map(cloneShowdownEntry) : null,
    winnerUserIds: state.winnerUserIds ? [...state.winnerUserIds] : null,
    lastHandWinners: state.lastHandWinners ? state.lastHandWinners.map((entry) => ({ ...entry })) : null
  };
}

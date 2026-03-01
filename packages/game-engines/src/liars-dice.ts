import type {
  LiarsDiceBid,
  LiarsDiceMove,
  LiarsDicePlayer,
  LiarsDiceRoundResolution,
  LiarsDiceState
} from '@multiwebgame/shared-types';

function otherPlayer(player: LiarsDicePlayer): LiarsDicePlayer {
  return player === 'black' ? 'white' : 'black';
}

function cloneBid(bid: LiarsDiceBid): LiarsDiceBid {
  return {
    quantity: bid.quantity,
    face: bid.face,
    player: bid.player
  };
}

function cloneDice(values: number[]): number[] {
  return values.map((value) => value);
}

function cloneRoundResolution(round: LiarsDiceRoundResolution): LiarsDiceRoundResolution {
  return {
    round: round.round,
    starter: round.starter,
    bids: round.bids.map(cloneBid),
    caller: round.caller,
    calledBid: cloneBid(round.calledBid),
    totalMatching: round.totalMatching,
    wasLiar: round.wasLiar,
    loser: round.loser
  };
}

function isValidDieValue(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function rollDice(count: number, rollDie: () => number): number[] {
  const dice: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = rollDie();
    if (!isValidDieValue(value)) {
      throw new Error('invalid_die_roll');
    }
    dice.push(value);
  }
  return dice;
}

function countMatchingFace(values: number[], face: number): number {
  let total = 0;
  for (const value of values) {
    if (value === face) {
      total += 1;
    }
  }
  return total;
}

function isHigherBid(previous: LiarsDiceBid, next: Pick<LiarsDiceBid, 'quantity' | 'face'>): boolean {
  return (
    next.quantity > previous.quantity || (next.quantity === previous.quantity && next.face > previous.face)
  );
}

function normalizeOptions(input?: LiarsDiceStateOptions): Required<LiarsDiceStateOptions> {
  return {
    dicePerPlayer: input?.dicePerPlayer ?? 5,
    startingPlayer: input?.startingPlayer ?? 'black',
    rollDie: input?.rollDie ?? (() => Math.floor(Math.random() * 6) + 1)
  };
}

export interface LiarsDiceStateOptions {
  dicePerPlayer?: number;
  startingPlayer?: LiarsDicePlayer;
  rollDie?: () => number;
}

export interface LiarsDiceRoundReveal extends LiarsDiceRoundResolution {
  dice: {
    black: number[];
    white: number[];
  };
}

export interface LiarsDiceRuntimeState {
  dicePerPlayer: number;
  currentRound: number;
  currentRoundStarter: LiarsDicePlayer;
  nextPlayer: LiarsDicePlayer;
  status: 'playing' | 'completed';
  winner: LiarsDicePlayer | null;
  moveCount: number;
  diceCounts: {
    black: number;
    white: number;
  };
  dice: {
    black: number[];
    white: number[];
  };
  currentBid: LiarsDiceBid | null;
  bidHistory: LiarsDiceBid[];
  lastRound: LiarsDiceRoundResolution | null;
  roundHistory: LiarsDiceRoundReveal[];
}

export interface ApplyLiarsDiceMoveResult {
  nextState: LiarsDiceRuntimeState;
  accepted: boolean;
  reason?: string;
}

export function createLiarsDiceState(options?: LiarsDiceStateOptions): LiarsDiceRuntimeState {
  const normalized = normalizeOptions(options);

  if (!Number.isInteger(normalized.dicePerPlayer) || normalized.dicePerPlayer <= 0) {
    throw new Error('invalid_dice_per_player');
  }

  const blackDice = rollDice(normalized.dicePerPlayer, normalized.rollDie);
  const whiteDice = rollDice(normalized.dicePerPlayer, normalized.rollDie);

  return {
    dicePerPlayer: normalized.dicePerPlayer,
    currentRound: 1,
    currentRoundStarter: normalized.startingPlayer,
    nextPlayer: normalized.startingPlayer,
    status: 'playing',
    winner: null,
    moveCount: 0,
    diceCounts: {
      black: normalized.dicePerPlayer,
      white: normalized.dicePerPlayer
    },
    dice: {
      black: blackDice,
      white: whiteDice
    },
    currentBid: null,
    bidHistory: [],
    lastRound: null,
    roundHistory: []
  };
}

export function toLiarsDicePublicState(
  state: LiarsDiceRuntimeState,
  viewer: LiarsDicePlayer | null
): LiarsDiceState {
  return {
    dicePerPlayer: state.dicePerPlayer,
    currentRound: state.currentRound,
    nextPlayer: state.nextPlayer,
    status: state.status,
    winner: state.winner,
    moveCount: state.moveCount,
    diceCounts: {
      black: state.diceCounts.black,
      white: state.diceCounts.white
    },
    currentBid: state.currentBid ? cloneBid(state.currentBid) : null,
    bidHistory: state.bidHistory.map(cloneBid),
    viewerDice: viewer ? cloneDice(state.dice[viewer]) : null,
    lastRound: state.lastRound ? cloneRoundResolution(state.lastRound) : null
  };
}

export function applyLiarsDiceMove(
  state: LiarsDiceRuntimeState,
  move: LiarsDiceMove,
  rollDie: () => number
): ApplyLiarsDiceMoveResult {
  if (state.status !== 'playing') {
    return {
      nextState: state,
      accepted: false,
      reason: 'match_is_not_active'
    };
  }

  if (move.player !== state.nextPlayer) {
    return {
      nextState: state,
      accepted: false,
      reason: 'out_of_turn'
    };
  }

  if (move.type === 'bid') {
    if (!Number.isInteger(move.quantity) || move.quantity <= 0) {
      return {
        nextState: state,
        accepted: false,
        reason: 'invalid_bid_quantity'
      };
    }

    const maxQuantity = state.diceCounts.black + state.diceCounts.white;
    if (move.quantity > maxQuantity) {
      return {
        nextState: state,
        accepted: false,
        reason: 'bid_exceeds_total_dice'
      };
    }

    if (!Number.isInteger(move.face) || move.face < 1 || move.face > 6) {
      return {
        nextState: state,
        accepted: false,
        reason: 'invalid_bid_face'
      };
    }

    if (state.currentBid && !isHigherBid(state.currentBid, move)) {
      return {
        nextState: state,
        accepted: false,
        reason: 'bid_not_higher'
      };
    }

    const bid: LiarsDiceBid = {
      quantity: move.quantity,
      face: move.face,
      player: move.player
    };

    return {
      accepted: true,
      nextState: {
        ...state,
        currentBid: bid,
        bidHistory: [...state.bidHistory, bid],
        nextPlayer: otherPlayer(move.player),
        moveCount: state.moveCount + 1
      }
    };
  }

  if (!state.currentBid) {
    return {
      nextState: state,
      accepted: false,
      reason: 'no_bid_to_call'
    };
  }

  const totalMatching =
    countMatchingFace(state.dice.black, state.currentBid.face) +
    countMatchingFace(state.dice.white, state.currentBid.face);
  const wasLiar = totalMatching < state.currentBid.quantity;
  const loser = wasLiar ? state.currentBid.player : move.player;
  const nextCounts = {
    ...state.diceCounts,
    [loser]: Math.max(0, state.diceCounts[loser] - 1)
  };

  const roundResolution: LiarsDiceRoundReveal = {
    round: state.currentRound,
    starter: state.currentRoundStarter,
    bids: state.bidHistory.map(cloneBid),
    caller: move.player,
    calledBid: cloneBid(state.currentBid),
    totalMatching,
    wasLiar,
    loser,
    dice: {
      black: cloneDice(state.dice.black),
      white: cloneDice(state.dice.white)
    }
  };

  const winner =
    nextCounts.black === 0 ? ('white' as const) : nextCounts.white === 0 ? ('black' as const) : null;

  if (winner) {
    return {
      accepted: true,
      nextState: {
        ...state,
        diceCounts: nextCounts,
        currentBid: null,
        bidHistory: [],
        nextPlayer: otherPlayer(loser),
        status: 'completed',
        winner,
        moveCount: state.moveCount + 1,
        lastRound: cloneRoundResolution(roundResolution),
        roundHistory: [...state.roundHistory, roundResolution]
      }
    };
  }

  let blackDice: number[];
  let whiteDice: number[];
  try {
    blackDice = rollDice(nextCounts.black, rollDie);
    whiteDice = rollDice(nextCounts.white, rollDie);
  } catch {
    return {
      nextState: state,
      accepted: false,
      reason: 'invalid_die_roll'
    };
  }

  return {
    accepted: true,
    nextState: {
      ...state,
      currentRound: state.currentRound + 1,
      currentRoundStarter: loser,
      nextPlayer: loser,
      moveCount: state.moveCount + 1,
      diceCounts: nextCounts,
      dice: {
        black: blackDice,
        white: whiteDice
      },
      currentBid: null,
      bidHistory: [],
      lastRound: cloneRoundResolution(roundResolution),
      roundHistory: [...state.roundHistory, roundResolution]
    }
  };
}

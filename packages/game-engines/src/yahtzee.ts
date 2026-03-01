import type {
  YahtzeeCategory,
  YahtzeeMove,
  YahtzeeMoveInput,
  YahtzeePlayer,
  YahtzeeState
} from '@multiwebgame/shared-types';

const YAHTZEE_CATEGORIES: YahtzeeCategory[] = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'three_of_a_kind',
  'four_of_a_kind',
  'full_house',
  'small_straight',
  'large_straight',
  'yahtzee',
  'chance'
];
const YAHTZEE_DICE_COUNT = 5;

function otherPlayer(player: YahtzeePlayer): YahtzeePlayer {
  return player === 'black' ? 'white' : 'black';
}

function createEmptyHolds(): boolean[] {
  return Array.from({ length: YAHTZEE_DICE_COUNT }, () => false);
}

function createPlaceholderDice(): number[] {
  return Array.from({ length: YAHTZEE_DICE_COUNT }, () => 1);
}

function isCategory(value: unknown): value is YahtzeeCategory {
  return YAHTZEE_CATEGORIES.includes(value as YahtzeeCategory);
}

function countFaces(dice: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const die of dice) {
    counts.set(die, (counts.get(die) ?? 0) + 1);
  }
  return counts;
}

function sumDice(dice: number[]): number {
  return dice.reduce((total, value) => total + value, 0);
}

function hasStraightAtLeast(dice: number[], length: number): boolean {
  const unique = Array.from(new Set(dice)).sort((a, b) => a - b);
  let longest = 1;
  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] === unique[index - 1] + 1) {
      streak += 1;
      longest = Math.max(longest, streak);
      continue;
    }
    streak = 1;
  }
  return longest >= length;
}

function isValidDie(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function scoreCategory(dice: number[], category: YahtzeeCategory): number {
  const counts = countFaces(dice);
  if (category === 'ones') {
    return (counts.get(1) ?? 0) * 1;
  }
  if (category === 'twos') {
    return (counts.get(2) ?? 0) * 2;
  }
  if (category === 'threes') {
    return (counts.get(3) ?? 0) * 3;
  }
  if (category === 'fours') {
    return (counts.get(4) ?? 0) * 4;
  }
  if (category === 'fives') {
    return (counts.get(5) ?? 0) * 5;
  }
  if (category === 'sixes') {
    return (counts.get(6) ?? 0) * 6;
  }
  if (category === 'three_of_a_kind') {
    for (const count of counts.values()) {
      if (count >= 3) {
        return sumDice(dice);
      }
    }
    return 0;
  }
  if (category === 'four_of_a_kind') {
    for (const count of counts.values()) {
      if (count >= 4) {
        return sumDice(dice);
      }
    }
    return 0;
  }
  if (category === 'full_house') {
    const values = Array.from(counts.values()).sort((a, b) => a - b);
    return values.length === 2 && values[0] === 2 && values[1] === 3 ? 25 : 0;
  }
  if (category === 'small_straight') {
    return hasStraightAtLeast(dice, 4) ? 30 : 0;
  }
  if (category === 'large_straight') {
    const sorted = Array.from(new Set(dice)).sort((a, b) => a - b);
    return sorted.length === 5 && hasStraightAtLeast(dice, 5) ? 40 : 0;
  }
  if (category === 'yahtzee') {
    return counts.size === 1 ? 50 : 0;
  }

  return sumDice(dice);
}

function totalScore(scoreCard: Partial<Record<YahtzeeCategory, number>>): number {
  return Object.values(scoreCard).reduce((total, value) => total + (value ?? 0), 0);
}

export type YahtzeeRuntimeState = YahtzeeState;

export interface CreateYahtzeeStateOptions {
  startingPlayer?: YahtzeePlayer;
}

export interface ApplyYahtzeeMoveResult {
  accepted: boolean;
  nextState: YahtzeeRuntimeState;
  reason?: string;
}

export function createYahtzeeState(options: CreateYahtzeeStateOptions = {}): YahtzeeRuntimeState {
  return {
    categories: [...YAHTZEE_CATEGORIES],
    dice: createPlaceholderDice(),
    held: createEmptyHolds(),
    nextPlayer: options.startingPlayer ?? 'black',
    status: 'playing',
    winner: null,
    moveCount: 0,
    turnCount: 1,
    rollsUsed: 0,
    scores: {
      black: {},
      white: {}
    },
    totals: {
      black: 0,
      white: 0
    },
    completedCategories: {
      black: 0,
      white: 0
    }
  };
}

export function normalizeYahtzeeMove(input: YahtzeeMoveInput, player: YahtzeePlayer): YahtzeeMove {
  if (input.type === 'roll') {
    return {
      type: 'roll',
      hold: Array.isArray(input.hold) ? input.hold.map((value) => Boolean(value)) : undefined,
      player
    };
  }

  return {
    type: 'score',
    category: input.category,
    player
  };
}

export function applyYahtzeeMove(
  state: YahtzeeRuntimeState,
  move: YahtzeeMove,
  rollDie: () => number = () => Math.floor(Math.random() * 6) + 1
): ApplyYahtzeeMoveResult {
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

  if (move.type === 'roll') {
    if (state.rollsUsed >= 3) {
      return {
        accepted: false,
        nextState: state,
        reason: 'no_rolls_remaining'
      };
    }

    if (move.hold && move.hold.length !== YAHTZEE_DICE_COUNT) {
      return {
        accepted: false,
        nextState: state,
        reason: 'invalid_hold_mask'
      };
    }

    const incomingHold = Array.isArray(move.hold) ? move.hold : null;
    const shouldApplyHold = state.rollsUsed > 0 && incomingHold !== null;
    const holdMask = shouldApplyHold ? incomingHold.map((value) => Boolean(value)) : createEmptyHolds();
    const nextDice = state.dice.map((previous, index) => {
      if (holdMask[index]) {
        return previous;
      }
      return rollDie();
    });

    if (nextDice.some((die) => !isValidDie(die))) {
      return {
        accepted: false,
        nextState: state,
        reason: 'invalid_die_roll'
      };
    }

    return {
      accepted: true,
      nextState: {
        ...state,
        dice: nextDice,
        held: holdMask,
        rollsUsed: state.rollsUsed + 1,
        moveCount: state.moveCount + 1
      }
    };
  }

  if (!isCategory(move.category)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'unknown_category'
    };
  }

  if (state.rollsUsed === 0) {
    return {
      accepted: false,
      nextState: state,
      reason: 'must_roll_before_score'
    };
  }

  if (typeof state.scores[move.player][move.category] === 'number') {
    return {
      accepted: false,
      nextState: state,
      reason: 'category_already_scored'
    };
  }

  const gained = scoreCategory(state.dice, move.category);
  const nextScores = {
    black: { ...state.scores.black },
    white: { ...state.scores.white }
  };
  nextScores[move.player][move.category] = gained;

  const nextTotals = {
    black: totalScore(nextScores.black),
    white: totalScore(nextScores.white)
  };
  const nextCompleted = {
    black: Object.keys(nextScores.black).length,
    white: Object.keys(nextScores.white).length
  };
  const finished =
    nextCompleted.black >= YAHTZEE_CATEGORIES.length && nextCompleted.white >= YAHTZEE_CATEGORIES.length;
  const winner =
    nextTotals.black > nextTotals.white
      ? ('black' as const)
      : nextTotals.white > nextTotals.black
        ? ('white' as const)
        : null;

  return {
    accepted: true,
    nextState: {
      ...state,
      dice: finished ? [...state.dice] : createPlaceholderDice(),
      held: createEmptyHolds(),
      nextPlayer: finished ? state.nextPlayer : otherPlayer(move.player),
      status: finished ? 'completed' : 'playing',
      winner: finished ? winner : null,
      moveCount: state.moveCount + 1,
      turnCount: state.turnCount + 1,
      rollsUsed: finished ? state.rollsUsed : 0,
      scores: nextScores,
      totals: nextTotals,
      completedCategories: nextCompleted
    }
  };
}

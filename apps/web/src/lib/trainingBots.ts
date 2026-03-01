import {
  applyBackgammonMove,
  applyBattleshipMove,
  applyCardsMove,
  applyCodenamesDuetMove,
  applyConnect4Move,
  applyDominationMove,
  applyDotsMove,
  applyGoMove,
  applyGomokuMove,
  applyHexMove,
  applyLiarsDiceMove,
  applyLoveLetterMove,
  applyOnitamaMove,
  applyQuoridorMove,
  applyReversiMove,
  applySantoriniMove,
  applyXiangqiMove,
  applyYahtzeeMove,
  assignBackgammonTurnDice,
  createBattleshipState,
  createBackgammonState,
  createCardsDeck,
  createCardsState,
  createCodenamesDuetKeyPair,
  createCodenamesDuetState,
  createCodenamesDuetWordPool,
  createLiarsDiceState,
  createLoveLetterDeck,
  createLoveLetterState,
  createOnitamaCardPool,
  createOnitamaState,
  createDeterministicPrng,
  hasAnyLegalBackgammonMove,
  type BattleshipRuntimeState,
  type CardsRuntimeState,
  type CodenamesDuetRuntimeState,
  type DeterministicPrng,
  type LiarsDiceRuntimeState,
  type LoveLetterRuntimeState
} from '@multiwebgame/game-engines';
import type {
  BackgammonColor,
  BackgammonMove,
  BackgammonState,
  BattleshipMove,
  BattleshipShipPlacement,
  CardsMove,
  CardsSuit,
  CodenamesDuetMove,
  Connect4Move,
  Connect4State,
  DominationMove,
  DominationState,
  DotsMove,
  DotsState,
  GoMove,
  GoState,
  GomokuMove,
  GomokuState,
  HexMove,
  HexState,
  LiarsDiceMove,
  LoveLetterCardName,
  LoveLetterMove,
  LoveLetterPlayer,
  OnitamaMove,
  OnitamaState,
  QuoridorMove,
  QuoridorState,
  ReversiMove,
  ReversiState,
  SantoriniMove,
  SantoriniPlayer,
  SantoriniState,
  XiangqiMove,
  XiangqiState,
  YahtzeeCategory,
  YahtzeeMove,
  YahtzeeState
} from '@multiwebgame/shared-types';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
  nextDie(sides?: number): number;
  shuffleInPlace<T>(items: T[]): T[];
}

function fallbackNextInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function fallbackNextDie(sides = 6): number {
  return fallbackNextInt(sides) + 1;
}

function fallbackShuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = fallbackNextInt(index + 1);
    const item = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = item;
  }

  return items;
}

function nextInt(maxExclusive: number, random?: Partial<RandomSource>): number {
  if (maxExclusive <= 0) {
    return 0;
  }

  if (typeof random?.nextInt === 'function') {
    return random.nextInt(maxExclusive);
  }

  return fallbackNextInt(maxExclusive);
}

function nextDie(random?: Partial<RandomSource>, sides = 6): number {
  if (typeof random?.nextDie === 'function') {
    return random.nextDie(sides);
  }

  return fallbackNextDie(sides);
}

function shuffleCopy<T>(items: T[], random?: Partial<RandomSource>): T[] {
  const copied = [...items];
  if (typeof random?.shuffleInPlace === 'function') {
    return random.shuffleInPlace(copied);
  }

  return fallbackShuffleInPlace(copied);
}

function pickRandom<T>(items: T[], random?: Partial<RandomSource>): T | null {
  if (items.length === 0) {
    return null;
  }

  return items[nextInt(items.length, random)] ?? null;
}

function legalByApply<TMove, TState>(
  state: TState,
  candidates: TMove[],
  apply: (source: TState, move: TMove) => { accepted: boolean }
): TMove[] {
  const legal: TMove[] = [];
  for (const candidate of candidates) {
    if (apply(state, candidate).accepted) {
      legal.push(candidate);
    }
  }

  return legal;
}

function applyRandomLegalMove<TMove, TState>(
  state: TState,
  candidates: TMove[],
  apply: (source: TState, move: TMove) => { accepted: boolean; nextState: TState },
  random?: Partial<RandomSource>
): TState {
  const legal = legalByApply(state, candidates, apply);
  const chosen = pickRandom(legal, random);
  if (!chosen) {
    return state;
  }

  const applied = apply(state, chosen);
  return applied.accepted ? applied.nextState : state;
}

export function gomokuBotMove(state: GomokuState, random?: Partial<RandomSource>): GomokuState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: GomokuMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      if (state.board[y][x] === null) {
        moves.push({ x, y, player: 'white' });
      }
    }
  }

  return applyRandomLegalMove(state, moves, applyGomokuMove, random);
}

export function goBotMove(state: GoState, random?: Partial<RandomSource>): GoState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: GoMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      moves.push({ type: 'place', x, y, player: 'white' });
    }
  }
  moves.push({ type: 'pass', player: 'white' });

  return applyRandomLegalMove(state, moves, applyGoMove, random);
}

export function xiangqiBotMove(state: XiangqiState, random?: Partial<RandomSource>): XiangqiState {
  if (state.status !== 'playing' || state.nextPlayer !== 'black') {
    return state;
  }

  const moves: XiangqiMove[] = [];
  for (let fromY = 0; fromY < 10; fromY += 1) {
    for (let fromX = 0; fromX < 9; fromX += 1) {
      const piece = state.board[fromY][fromX];
      if (!piece || piece.color !== 'black') {
        continue;
      }

      for (let toY = 0; toY < 10; toY += 1) {
        for (let toX = 0; toX < 9; toX += 1) {
          moves.push({
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
            player: 'black'
          });
        }
      }
    }
  }

  return applyRandomLegalMove(state, moves, applyXiangqiMove, random);
}

export function connect4BotMove(state: Connect4State, random?: Partial<RandomSource>): Connect4State {
  if (state.status !== 'playing' || state.nextPlayer !== 'yellow') {
    return state;
  }

  const moves: Connect4Move[] = Array.from({ length: state.columns }, (_entry, column) => ({
    column,
    player: 'yellow'
  }));

  return applyRandomLegalMove(state, moves, applyConnect4Move, random);
}

export function reversiBotMove(state: ReversiState, random?: Partial<RandomSource>): ReversiState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: ReversiMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      moves.push({ x, y, player: 'white' });
    }
  }

  return applyRandomLegalMove(state, moves, applyReversiMove, random);
}

export function dotsBotMove(state: DotsState, random?: Partial<RandomSource>): DotsState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: DotsMove[] = [];
  for (let y = 0; y < state.dotsY; y += 1) {
    for (let x = 0; x < state.dotsX - 1; x += 1) {
      moves.push({ orientation: 'h', x, y, player: 'white' });
    }
  }
  for (let y = 0; y < state.dotsY - 1; y += 1) {
    for (let x = 0; x < state.dotsX; x += 1) {
      moves.push({ orientation: 'v', x, y, player: 'white' });
    }
  }

  return applyRandomLegalMove(state, moves, applyDotsMove, random);
}

export function hexBotMove(state: HexState, random?: Partial<RandomSource>): HexState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: HexMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      moves.push({ x, y, player: 'white' });
    }
  }

  return applyRandomLegalMove(state, moves, applyHexMove, random);
}

export function quoridorBotMove(state: QuoridorState, random?: Partial<RandomSource>): QuoridorState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  return applyRandomLegalMove(state, generateQuoridorMoves(state, 'white'), applyQuoridorMove, random);
}

export function santoriniBotMove(state: SantoriniState, random?: Partial<RandomSource>): SantoriniState {
  if (state.status === 'completed' || state.nextPlayer !== 'white') {
    return state;
  }

  return applyRandomLegalMove(state, generateSantoriniMoves(state, 'white'), applySantoriniMove, random);
}

export function dominationBotMove(state: DominationState, random?: Partial<RandomSource>): DominationState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const moves: DominationMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      moves.push({ x, y, player: 'white' });
    }
  }

  return applyRandomLegalMove(state, moves, applyDominationMove, random);
}

export function onitamaBotMove(state: OnitamaState, random?: Partial<RandomSource>): OnitamaState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  return applyRandomLegalMove(state, generateOnitamaMoves(state, 'white'), applyOnitamaMove, random);
}

function defaultFleetPlacements(lengths: number[]): BattleshipShipPlacement[] {
  return lengths.map((length, index) => ({
    x: 0,
    y: index,
    orientation: 'h',
    length
  }));
}

function generateFleetPlacements(
  boardSize: number,
  lengths: number[],
  random?: Partial<RandomSource>
): BattleshipShipPlacement[] | null {
  const occupied = new Set<string>();

  const placeShip = (ship: BattleshipShipPlacement, delta: 1 | -1): void => {
    for (let offset = 0; offset < ship.length; offset += 1) {
      const x = ship.x + (ship.orientation === 'h' ? offset : 0);
      const y = ship.y + (ship.orientation === 'v' ? offset : 0);
      const key = `${x},${y}`;
      if (delta > 0) {
        occupied.add(key);
      } else {
        occupied.delete(key);
      }
    }
  };

  const canPlaceShip = (ship: BattleshipShipPlacement): boolean => {
    for (let offset = 0; offset < ship.length; offset += 1) {
      const x = ship.x + (ship.orientation === 'h' ? offset : 0);
      const y = ship.y + (ship.orientation === 'v' ? offset : 0);
      if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
        return false;
      }
      if (occupied.has(`${x},${y}`)) {
        return false;
      }
    }

    return true;
  };

  const backtrack = (shipIndex: number): BattleshipShipPlacement[] | null => {
    if (shipIndex >= lengths.length) {
      return [];
    }

    const length = lengths[shipIndex];
    const candidates: BattleshipShipPlacement[] = [];

    for (const orientation of ['h', 'v'] as const) {
      const maxX = orientation === 'h' ? boardSize - length : boardSize - 1;
      const maxY = orientation === 'v' ? boardSize - length : boardSize - 1;

      for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
          candidates.push({ x, y, orientation, length });
        }
      }
    }

    const orderedCandidates = shuffleCopy(candidates, random);

    for (const candidate of orderedCandidates) {
      if (!canPlaceShip(candidate)) {
        continue;
      }

      placeShip(candidate, 1);
      const tail = backtrack(shipIndex + 1);
      if (tail) {
        return [candidate, ...tail];
      }
      placeShip(candidate, -1);
    }

    return null;
  };

  return backtrack(0);
}

function applyFleet(
  state: BattleshipRuntimeState,
  player: 'black' | 'white',
  ships: BattleshipShipPlacement[]
): BattleshipRuntimeState {
  const applied = applyBattleshipMove(state, {
    type: 'place_fleet',
    player,
    ships
  });

  return applied.accepted ? applied.nextState : state;
}

export function createTrainingBattleshipState(random: Partial<RandomSource>): BattleshipRuntimeState {
  let state = createBattleshipState({ boardSize: 10 });

  const baseLengths = [...state.shipLengths];
  const blackFleet =
    generateFleetPlacements(state.boardSize, baseLengths, random) ?? defaultFleetPlacements(baseLengths);
  state = applyFleet(state, 'black', blackFleet);

  const whiteFleet =
    generateFleetPlacements(state.boardSize, baseLengths, random) ??
    defaultFleetPlacements(baseLengths).map((ship, index) => ({
      ...ship,
      x: state.boardSize - ship.length,
      y: state.boardSize - 1 - index
    }));
  state = applyFleet(state, 'white', whiteFleet);

  return state;
}

export function battleshipBotMove(
  state: BattleshipRuntimeState,
  random?: Partial<RandomSource>
): BattleshipRuntimeState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  if (state.phase === 'placement') {
    if (state.ships.white) {
      return state;
    }

    const ships =
      generateFleetPlacements(state.boardSize, [...state.shipLengths], random) ??
      defaultFleetPlacements([...state.shipLengths]).map((ship, index) => ({
        ...ship,
        x: state.boardSize - ship.length,
        y: state.boardSize - 1 - index
      }));

    const placed = applyBattleshipMove(state, {
      type: 'place_fleet',
      player: 'white',
      ships
    });
    return placed.accepted ? placed.nextState : state;
  }

  const moves: BattleshipMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      if (state.shots.white[y][x] === 'unknown') {
        moves.push({
          type: 'fire',
          x,
          y,
          player: 'white'
        });
      }
    }
  }

  return applyRandomLegalMove(state, moves, applyBattleshipMove, random);
}

function randomHoldMask(random?: Partial<RandomSource>): boolean[] {
  return Array.from({ length: 5 }, () => nextInt(2, random) === 1);
}

function availableYahtzeeCategories(state: YahtzeeState, player: 'black' | 'white'): YahtzeeCategory[] {
  return state.categories.filter((category) => typeof state.scores[player][category] !== 'number');
}

export function yahtzeeBotMove(state: YahtzeeState, random?: Partial<RandomSource>): YahtzeeState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const scoresLeft = availableYahtzeeCategories(state, 'white');
  const canScore = state.rollsUsed > 0 && scoresLeft.length > 0;
  const shouldRoll =
    state.rollsUsed === 0 || (state.rollsUsed < 3 && (!canScore || nextInt(100, random) < 65));

  if (shouldRoll) {
    const move: YahtzeeMove = {
      type: 'roll',
      player: 'white',
      hold: state.rollsUsed > 0 ? randomHoldMask(random) : undefined
    };
    const rolled = applyYahtzeeMove(state, move, () => nextDie(random));
    return rolled.accepted ? rolled.nextState : state;
  }

  const category = pickRandom(scoresLeft, random);
  if (!category) {
    return state;
  }

  const scored = applyYahtzeeMove(
    state,
    {
      type: 'score',
      category,
      player: 'white'
    },
    () => nextDie(random)
  );

  return scored.accepted ? scored.nextState : state;
}

function loveLetterDeck(random?: Partial<RandomSource>): LoveLetterCardName[] {
  return shuffleCopy(createLoveLetterDeck(), random);
}

export function createTrainingLoveLetterDeck(random?: Partial<RandomSource>): LoveLetterCardName[] {
  return loveLetterDeck(random);
}

export function createTrainingLoveLetterState(random: Partial<RandomSource>): LoveLetterRuntimeState {
  return createLoveLetterState({
    deck: loveLetterDeck(random),
    startingPlayer: 'black'
  });
}

function createLoveLetterRoundDeck(random?: Partial<RandomSource>): LoveLetterCardName[] {
  return loveLetterDeck(random);
}

export function generateLoveLetterMoves(
  state: LoveLetterRuntimeState,
  player: LoveLetterPlayer
): LoveLetterMove[] {
  const cards = state.hands[player];
  const opponent: LoveLetterPlayer = player === 'black' ? 'white' : 'black';
  const guesses: LoveLetterCardName[] = [
    'priest',
    'baron',
    'handmaid',
    'prince',
    'king',
    'countess',
    'princess'
  ];

  const moves: LoveLetterMove[] = [];

  const uniqueCards = [...new Set(cards)];
  for (const card of uniqueCards) {
    if (card === 'guard') {
      for (const target of [opponent, player] as const) {
        for (const guess of guesses) {
          moves.push({ type: 'play', card, target, guess, player });
        }
      }
      continue;
    }

    if (card === 'priest' || card === 'baron' || card === 'king') {
      for (const target of [opponent, player] as const) {
        moves.push({ type: 'play', card, target, player });
      }
      continue;
    }

    if (card === 'prince') {
      for (const target of [opponent, player] as const) {
        moves.push({ type: 'play', card, target, player });
      }
      continue;
    }

    moves.push({ type: 'play', card, player });
  }

  return moves;
}

export function loveLetterBotMove(
  state: LoveLetterRuntimeState,
  random?: Partial<RandomSource>
): LoveLetterRuntimeState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const legal = legalByApply(state, generateLoveLetterMoves(state, 'white'), (source, move) =>
    applyLoveLetterMove(source, move, () => createLoveLetterRoundDeck(random))
  );
  const chosen = pickRandom(legal, random);
  if (!chosen) {
    return state;
  }

  const applied = applyLoveLetterMove(state, chosen, () => createLoveLetterRoundDeck(random));
  return applied.accepted ? applied.nextState : state;
}

function wordsForCodenames(random: Partial<RandomSource>): string[] {
  const pool = createCodenamesDuetWordPool();
  const shuffled = shuffleCopy(pool, random);
  return shuffled.slice(0, 25);
}

export function createTrainingCodenamesState(random: Partial<RandomSource>): CodenamesDuetRuntimeState {
  const keys = createCodenamesDuetKeyPair((items) => {
    shuffleCopy(items, random).forEach((value, index) => {
      items[index] = value;
    });
  });

  return createCodenamesDuetState({
    words: wordsForCodenames(random),
    keyBlack: keys.keyBlack,
    keyWhite: keys.keyWhite,
    startingCluer: 'black'
  });
}

function codenamesTargetIndexes(state: CodenamesDuetRuntimeState): number[] {
  const indexes: number[] = [];
  for (let index = 0; index < state.revealed.length; index += 1) {
    if (!state.revealed[index]) {
      indexes.push(index);
    }
  }
  return indexes;
}

export function codenamesBotMove(
  state: CodenamesDuetRuntimeState,
  random?: Partial<RandomSource>
): CodenamesDuetRuntimeState {
  if (state.status !== 'playing') {
    return state;
  }

  const guesser = state.currentCluer === 'black' ? 'white' : 'black';
  const botTurn =
    (state.phase === 'clue' && state.currentCluer === 'white') ||
    (state.phase === 'guess' && guesser === 'white');

  if (!botTurn) {
    return state;
  }

  const moves: CodenamesDuetMove[] = [];
  if (state.phase === 'clue') {
    const options = ['signal', 'trail', 'anchor', 'stone'];
    for (const word of options) {
      for (let count = 1; count <= 3; count += 1) {
        moves.push({
          type: 'clue',
          player: 'white',
          word,
          count
        });
      }
    }
  } else {
    for (const index of codenamesTargetIndexes(state)) {
      moves.push({
        type: 'guess',
        player: 'white',
        index
      });
    }
    moves.push({
      type: 'end_guesses',
      player: 'white'
    });
  }

  return applyRandomLegalMove(state, moves, applyCodenamesDuetMove, random);
}

function cardsDeck(random: Partial<RandomSource>) {
  return shuffleCopy(createCardsDeck(), random);
}

export function createTrainingCardsState(random: Partial<RandomSource>): CardsRuntimeState {
  return createCardsState({
    deck: cardsDeck(random),
    startingPlayer: 'black'
  });
}

export function generateCardsMoves(state: CardsRuntimeState, player: 'black' | 'white'): CardsMove[] {
  const moves: CardsMove[] = [
    {
      type: 'draw',
      player
    },
    {
      type: 'end_turn',
      player
    }
  ];

  const hand = state.hands[player];
  for (const card of hand) {
    if (card.rank === '8') {
      for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const) {
        moves.push({
          type: 'play',
          player,
          card,
          chosenSuit: suit
        });
      }
    } else {
      moves.push({
        type: 'play',
        player,
        card
      });
    }
  }

  return moves;
}

export function cardsBotMove(state: CardsRuntimeState, random?: Partial<RandomSource>): CardsRuntimeState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  return applyRandomLegalMove(state, generateCardsMoves(state, 'white'), applyCardsMove, random);
}

export function createTrainingLiarsDiceState(random: Partial<RandomSource>): LiarsDiceRuntimeState {
  return createLiarsDiceState({
    dicePerPlayer: 5,
    startingPlayer: 'black',
    rollDie: () => nextDie(random)
  });
}

export function generateLiarsDiceMoves(
  state: LiarsDiceRuntimeState,
  player: 'black' | 'white'
): LiarsDiceMove[] {
  const moves: LiarsDiceMove[] = [
    {
      type: 'call_liar',
      player
    }
  ];

  const maxQuantity = state.diceCounts.black + state.diceCounts.white;

  for (let quantity = 1; quantity <= maxQuantity; quantity += 1) {
    for (let face = 1; face <= 6; face += 1) {
      if (!state.currentBid) {
        moves.push({
          type: 'bid',
          quantity,
          face,
          player
        });
        continue;
      }

      if (
        quantity > state.currentBid.quantity ||
        (quantity === state.currentBid.quantity && face > state.currentBid.face)
      ) {
        moves.push({
          type: 'bid',
          quantity,
          face,
          player
        });
      }
    }
  }

  return moves;
}

export function liarsDiceBotMove(
  state: LiarsDiceRuntimeState,
  random?: Partial<RandomSource>
): LiarsDiceRuntimeState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const legal = legalByApply(state, generateLiarsDiceMoves(state, 'white'), (source, move) =>
    applyLiarsDiceMove(source, move, () => nextDie(random))
  );
  const chosen = pickRandom(legal, random);
  if (!chosen) {
    return state;
  }

  const applied = applyLiarsDiceMove(state, chosen, () => nextDie(random));
  return applied.accepted ? applied.nextState : state;
}

export function ensureBackgammonTurnDice(
  state: BackgammonState,
  random?: Partial<RandomSource>
): BackgammonState {
  if (state.status !== 'playing' || state.remainingDice.length > 0) {
    return state;
  }

  return assignBackgammonTurnDice(state, [nextDie(random), nextDie(random)]);
}

function otherBackgammonPlayer(player: BackgammonColor): BackgammonColor {
  return player === 'white' ? 'black' : 'white';
}

export function skipBackgammonBlockedTurn(state: BackgammonState): BackgammonState {
  if (state.status !== 'playing' || state.remainingDice.length === 0) {
    return state;
  }

  if (hasAnyLegalBackgammonMove(state, state.nextPlayer)) {
    return state;
  }

  return {
    ...state,
    nextPlayer: otherBackgammonPlayer(state.nextPlayer),
    dice: null,
    remainingDice: []
  };
}

export function createTrainingBackgammonState(random: Partial<RandomSource>): BackgammonState {
  const state = createBackgammonState();
  return ensureBackgammonTurnDice(state, random);
}

export function generateBackgammonMoves(state: BackgammonState, player: BackgammonColor): BackgammonMove[] {
  if (state.status !== 'playing' || state.nextPlayer !== player || state.remainingDice.length === 0) {
    return [];
  }

  const sources: Array<number | 'bar'> = [];
  if (state.bar[player] > 0) {
    sources.push('bar');
  } else {
    for (let point = 0; point < state.points.length; point += 1) {
      const value = state.points[point];
      if ((player === 'white' && value > 0) || (player === 'black' && value < 0)) {
        sources.push(point);
      }
    }
  }

  const dice = [...new Set(state.remainingDice)];
  const destinations: Array<number | 'off'> = [
    ...Array.from({ length: state.points.length }, (_x, index) => index),
    'off'
  ];

  const legal: BackgammonMove[] = [];
  for (const from of sources) {
    for (const die of dice) {
      for (const to of destinations) {
        const move: BackgammonMove = {
          from,
          to,
          die,
          player
        };
        const applied = applyBackgammonMove(state, move);
        if (applied.accepted) {
          legal.push(move);
        }
      }
    }
  }

  return legal;
}

export function backgammonBotMove(state: BackgammonState, random?: Partial<RandomSource>): BackgammonState {
  if (state.status !== 'playing') {
    return state;
  }

  let current = ensureBackgammonTurnDice(state, random);
  current = skipBackgammonBlockedTurn(current);

  if (current.status !== 'playing' || current.nextPlayer !== 'black') {
    return current;
  }

  const legalMoves = generateBackgammonMoves(current, 'black');
  const chosen = pickRandom(legalMoves, random);
  if (!chosen) {
    return skipBackgammonBlockedTurn(current);
  }

  const applied = applyBackgammonMove(current, chosen);
  return applied.accepted ? applied.nextState : current;
}

export function createTrainingOnitamaState(random: Partial<RandomSource>): OnitamaState {
  const cards = shuffleCopy(createOnitamaCardPool(), random).slice(0, 5);
  return createOnitamaState({ openingCards: cards });
}

export function generateOnitamaMoves(state: OnitamaState, player: 'black' | 'white'): OnitamaMove[] {
  const cards = state.cards[player];
  const moves: OnitamaMove[] = [];

  for (let fromY = 0; fromY < state.boardSize; fromY += 1) {
    for (let fromX = 0; fromX < state.boardSize; fromX += 1) {
      const piece = state.board[fromY][fromX];
      if (!piece || piece.player !== player) {
        continue;
      }

      for (const card of cards) {
        for (let toY = 0; toY < state.boardSize; toY += 1) {
          for (let toX = 0; toX < state.boardSize; toX += 1) {
            moves.push({
              from: { x: fromX, y: fromY },
              to: { x: toX, y: toY },
              card,
              player
            });
          }
        }
      }
    }
  }

  return moves;
}

export function generateSantoriniMoves(state: SantoriniState, player: SantoriniPlayer): SantoriniMove[] {
  const moves: SantoriniMove[] = [];

  if (state.status === 'setup') {
    for (const worker of ['a', 'b'] as const) {
      for (let y = 0; y < state.boardSize; y += 1) {
        for (let x = 0; x < state.boardSize; x += 1) {
          moves.push({
            type: 'place',
            worker,
            x,
            y,
            player
          });
        }
      }
    }

    return moves;
  }

  if (state.status !== 'playing') {
    return moves;
  }

  for (const worker of ['a', 'b'] as const) {
    for (let toY = 0; toY < state.boardSize; toY += 1) {
      for (let toX = 0; toX < state.boardSize; toX += 1) {
        for (let buildY = 0; buildY < state.boardSize; buildY += 1) {
          for (let buildX = 0; buildX < state.boardSize; buildX += 1) {
            moves.push({
              type: 'turn',
              worker,
              to: {
                x: toX,
                y: toY
              },
              build: {
                x: buildX,
                y: buildY
              },
              player
            });
          }
        }
      }
    }
  }

  return moves;
}

export function generateQuoridorMoves(state: QuoridorState, player: 'black' | 'white'): QuoridorMove[] {
  const moves: QuoridorMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      moves.push({
        type: 'pawn',
        x,
        y,
        player
      });
    }
  }

  const wallGrid = state.boardSize - 1;
  for (const orientation of ['h', 'v'] as const) {
    for (let y = 0; y < wallGrid; y += 1) {
      for (let x = 0; x < wallGrid; x += 1) {
        moves.push({
          type: 'wall',
          orientation,
          x,
          y,
          player
        });
      }
    }
  }

  return moves;
}

export function runBotUntilHumanTurn<TState>(
  initial: TState,
  isBotTurn: (state: TState) => boolean,
  step: (state: TState) => TState,
  maxSteps = 256
): TState {
  let state = initial;
  for (let index = 0; index < maxSteps; index += 1) {
    if (!isBotTurn(state)) {
      break;
    }

    const next = step(state);
    if (next === state) {
      break;
    }

    state = next;
  }

  return state;
}

export function createSeededRandom(seed: string): DeterministicPrng {
  return createDeterministicPrng(seed);
}

export const CARD_SUITS: CardsSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

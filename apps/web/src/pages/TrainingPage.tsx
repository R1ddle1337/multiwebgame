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
  createConnect4State,
  createDominationState,
  createDotsState,
  createGoState,
  createGomokuState,
  createHexState,
  createQuoridorState,
  createReversiState,
  createSantoriniState,
  createXiangqiState,
  createYahtzeeState,
  toBattleshipPublicState,
  toCardsPublicState,
  toCodenamesDuetPublicState,
  toLiarsDicePublicState,
  toLoveLetterPublicState
} from '@multiwebgame/game-engines';
import type {
  BackgammonMove,
  BattleshipMove,
  LoveLetterCardName,
  LoveLetterMove,
  OnitamaMove,
  OnitamaMoveInput,
  QuoridorMove,
  SantoriniMove,
  SantoriniMoveInput,
  XiangqiMove,
  YahtzeeCategory,
  YahtzeeMove
} from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Connect4Board } from '../components/Connect4Board';
import { DominationBoard } from '../components/DominationBoard';
import { DotsBoard } from '../components/DotsBoard';
import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { HexBoard } from '../components/HexBoard';
import { QuoridorBoard } from '../components/QuoridorBoard';
import { ReversiBoard } from '../components/ReversiBoard';
import { SantoriniBoard } from '../components/SantoriniBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import {
  CARD_SUITS,
  backgammonBotMove,
  battleshipBotMove,
  cardsBotMove,
  codenamesBotMove,
  connect4BotMove,
  createSeededRandom,
  createTrainingBackgammonState,
  createTrainingBattleshipState,
  createTrainingCardsState,
  createTrainingCodenamesState,
  createTrainingLiarsDiceState,
  createTrainingLoveLetterDeck,
  createTrainingLoveLetterState,
  createTrainingOnitamaState,
  dominationBotMove,
  dotsBotMove,
  ensureBackgammonTurnDice,
  generateBackgammonMoves,
  goBotMove,
  gomokuBotMove,
  hexBotMove,
  liarsDiceBotMove,
  loveLetterBotMove,
  onitamaBotMove,
  quoridorBotMove,
  reversiBotMove,
  runBotUntilHumanTurn,
  santoriniBotMove,
  skipBackgammonBlockedTurn,
  xiangqiBotMove,
  yahtzeeBotMove
} from '../lib/trainingBots';

type Phase1TrainingGame =
  | 'gomoku'
  | 'go'
  | 'xiangqi'
  | 'connect4'
  | 'reversi'
  | 'dots'
  | 'hex'
  | 'quoridor'
  | 'santorini'
  | 'domination';

type Phase2TrainingGame =
  | 'battleship'
  | 'onitama'
  | 'yahtzee'
  | 'love_letter'
  | 'codenames_duet'
  | 'cards'
  | 'liars_dice'
  | 'backgammon';

type TrainingGame = Phase1TrainingGame | Phase2TrainingGame;

const PHASE1_GAMES: Phase1TrainingGame[] = [
  'gomoku',
  'go',
  'xiangqi',
  'connect4',
  'reversi',
  'dots',
  'hex',
  'quoridor',
  'santorini',
  'domination'
];

const PHASE2_GAMES: Phase2TrainingGame[] = [
  'battleship',
  'onitama',
  'yahtzee',
  'love_letter',
  'codenames_duet',
  'cards',
  'liars_dice',
  'backgammon'
];

const GAME_LABEL: Record<TrainingGame, string> = {
  gomoku: 'Gomoku',
  go: 'Go',
  xiangqi: 'Xiangqi',
  connect4: 'Connect4',
  reversi: 'Reversi',
  dots: 'Dots',
  hex: 'Hex',
  quoridor: 'Quoridor',
  santorini: 'Santorini',
  domination: 'Domination',
  battleship: 'Battleship',
  onitama: 'Onitama',
  yahtzee: 'Yahtzee',
  love_letter: 'Love Letter',
  codenames_duet: 'Codenames Duet',
  cards: 'Cards',
  liars_dice: "Liar's Dice",
  backgammon: 'Backgammon'
};

const LOVE_LETTER_GUESS_OPTIONS: LoveLetterCardName[] = [
  'priest',
  'baron',
  'handmaid',
  'prince',
  'king',
  'countess',
  'princess'
];

const DEFAULT_YAHTZEE_HOLD = [false, false, false, false, false];

function isPhase2Game(game: TrainingGame): game is Phase2TrainingGame {
  return PHASE2_GAMES.includes(game as Phase2TrainingGame);
}

function onitamaPieceLabel(cell: { player: 'black' | 'white'; kind: 'master' | 'student' } | null): string {
  if (!cell) {
    return '·';
  }

  return `${cell.player === 'black' ? 'B' : 'W'}${cell.kind === 'master' ? 'M' : 'S'}`;
}

function formatBackgammonPoint(value: number): string {
  if (value === 0) {
    return '·';
  }

  if (value > 0) {
    return `W${value}`;
  }

  return `B${Math.abs(value)}`;
}

function sortBackgammonMoves(moves: BackgammonMove[]): BackgammonMove[] {
  return [...moves].sort((a, b) => {
    const fromA = a.from === 'bar' ? -1 : a.from;
    const fromB = b.from === 'bar' ? -1 : b.from;
    if (fromA !== fromB) {
      return fromA - fromB;
    }

    if (a.die !== b.die) {
      return a.die - b.die;
    }

    const toA = a.to === 'off' ? 99 : a.to;
    const toB = b.to === 'off' ? 99 : b.to;
    return toA - toB;
  });
}

function summarizeGame(game: TrainingGame, status: string, nextPlayer: string, sandbox = false): string {
  const suffix = sandbox ? 'Training Sandbox' : 'Training';
  return `${suffix} (${GAME_LABEL[game]}) - status: ${status}, next: ${nextPlayer}`;
}

export function TrainingPage() {
  const [game, setGame] = useState<TrainingGame>('gomoku');

  const [gomokuState, setGomokuState] = useState(() => createGomokuState(15));
  const [goState, setGoState] = useState(() => createGoState(9));
  const [xiangqiState, setXiangqiState] = useState(() => createXiangqiState());
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);

  const [connect4State, setConnect4State] = useState(() => createConnect4State());
  const [reversiState, setReversiState] = useState(() => createReversiState());
  const [dotsState, setDotsState] = useState(() => createDotsState());
  const [hexState, setHexState] = useState(() => createHexState({ boardSize: 11 }));
  const [quoridorState, setQuoridorState] = useState(() =>
    createQuoridorState({ boardSize: 9, wallsPerPlayer: 10 })
  );

  const [santoriniState, setSantoriniState] = useState(() => createSantoriniState({ boardSize: 5 }));
  const [santoriniWorker, setSantoriniWorker] = useState<SantoriniMoveInput['worker']>('a');
  const [santoriniSelection, setSantoriniSelection] = useState<{
    worker: SantoriniMoveInput['worker'];
    x: number;
    y: number;
  } | null>(null);
  const [santoriniMoveTarget, setSantoriniMoveTarget] = useState<{ x: number; y: number } | null>(null);

  const [dominationState, setDominationState] = useState(() => createDominationState({ boardSize: 9 }));

  const onitamaRandomRef = useRef(createSeededRandom('training-onitama-seed'));
  const battleshipRandomRef = useRef(createSeededRandom('training-battleship-seed'));
  const yahtzeeRandomRef = useRef(createSeededRandom('training-yahtzee-seed'));
  const loveLetterRandomRef = useRef(createSeededRandom('training-love-letter-seed'));
  const codenamesRandomRef = useRef(createSeededRandom('training-codenames-seed'));
  const cardsRandomRef = useRef(createSeededRandom('training-cards-seed'));
  const liarsRandomRef = useRef(createSeededRandom('training-liars-seed'));
  const backgammonRandomRef = useRef(createSeededRandom('training-backgammon-seed'));

  const [onitamaState, setOnitamaState] = useState(() =>
    createTrainingOnitamaState(onitamaRandomRef.current)
  );
  const [onitamaCard, setOnitamaCard] = useState<OnitamaMoveInput['card']>('tiger');
  const [onitamaSelection, setOnitamaSelection] = useState<{ x: number; y: number } | null>(null);

  const [battleshipState, setBattleshipState] = useState(() =>
    createTrainingBattleshipState(battleshipRandomRef.current)
  );

  const [yahtzeeState, setYahtzeeState] = useState(() => createYahtzeeState({ startingPlayer: 'black' }));
  const [yahtzeeHold, setYahtzeeHold] = useState<boolean[]>(DEFAULT_YAHTZEE_HOLD);
  const [yahtzeeCategory, setYahtzeeCategory] = useState<YahtzeeCategory>('chance');

  const [loveLetterState, setLoveLetterState] = useState(() =>
    createTrainingLoveLetterState(loveLetterRandomRef.current)
  );
  const [loveLetterCard, setLoveLetterCard] = useState<LoveLetterCardName>('guard');
  const [loveLetterTarget, setLoveLetterTarget] = useState<'black' | 'white'>('white');
  const [loveLetterGuess, setLoveLetterGuess] = useState<LoveLetterCardName>('priest');

  const [codenamesState, setCodenamesState] = useState(() =>
    createTrainingCodenamesState(codenamesRandomRef.current)
  );
  const [codenamesClueWord, setCodenamesClueWord] = useState('signal');
  const [codenamesClueCount, setCodenamesClueCount] = useState(1);

  const [cardsState, setCardsState] = useState(() => createTrainingCardsState(cardsRandomRef.current));
  const [cardsSuit, setCardsSuit] = useState<(typeof CARD_SUITS)[number]>('hearts');

  const [liarsDiceState, setLiarsDiceState] = useState(() =>
    createTrainingLiarsDiceState(liarsRandomRef.current)
  );
  const [liarsBidQuantity, setLiarsBidQuantity] = useState(1);
  const [liarsBidFace, setLiarsBidFace] = useState(1);

  const [backgammonState, setBackgammonState] = useState(() =>
    createTrainingBackgammonState(backgammonRandomRef.current)
  );

  useEffect(() => {
    if (!onitamaState.cards.black.includes(onitamaCard)) {
      setOnitamaCard(onitamaState.cards.black[0] ?? 'tiger');
    }
  }, [onitamaCard, onitamaState.cards.black]);

  useEffect(() => {
    if (yahtzeeState.rollsUsed === 0) {
      setYahtzeeHold(DEFAULT_YAHTZEE_HOLD);
    }
  }, [yahtzeeState.moveCount, yahtzeeState.rollsUsed]);

  useEffect(() => {
    if (!loveLetterState.hands.black.includes(loveLetterCard)) {
      setLoveLetterCard(loveLetterState.hands.black[0] ?? 'guard');
    }
  }, [loveLetterCard, loveLetterState.hands.black]);

  useEffect(() => {
    const next = skipBackgammonBlockedTurn(
      ensureBackgammonTurnDice(backgammonState, backgammonRandomRef.current)
    );
    if (next !== backgammonState) {
      setBackgammonState(next);
    }
  }, [backgammonState]);

  const info = useMemo(() => {
    if (game === 'gomoku') {
      return summarizeGame(game, gomokuState.status, gomokuState.nextPlayer);
    }
    if (game === 'go') {
      return summarizeGame(game, goState.status, goState.nextPlayer);
    }
    if (game === 'xiangqi') {
      return summarizeGame(game, xiangqiState.status, xiangqiState.nextPlayer);
    }
    if (game === 'connect4') {
      return summarizeGame(game, connect4State.status, connect4State.nextPlayer);
    }
    if (game === 'reversi') {
      return summarizeGame(game, reversiState.status, reversiState.nextPlayer);
    }
    if (game === 'dots') {
      return summarizeGame(game, dotsState.status, dotsState.nextPlayer);
    }
    if (game === 'hex') {
      return summarizeGame(game, hexState.status, hexState.nextPlayer);
    }
    if (game === 'quoridor') {
      return summarizeGame(game, quoridorState.status, quoridorState.nextPlayer);
    }
    if (game === 'santorini') {
      return summarizeGame(game, santoriniState.status, santoriniState.nextPlayer);
    }
    if (game === 'domination') {
      return summarizeGame(game, dominationState.status, dominationState.nextPlayer);
    }
    if (game === 'battleship') {
      return summarizeGame(game, battleshipState.status, battleshipState.nextPlayer, true);
    }
    if (game === 'onitama') {
      return summarizeGame(game, onitamaState.status, onitamaState.nextPlayer, true);
    }
    if (game === 'yahtzee') {
      return summarizeGame(game, yahtzeeState.status, yahtzeeState.nextPlayer, true);
    }
    if (game === 'love_letter') {
      return summarizeGame(game, loveLetterState.status, loveLetterState.nextPlayer, true);
    }
    if (game === 'codenames_duet') {
      const guesser = codenamesState.currentCluer === 'black' ? 'white' : 'black';
      const actor = codenamesState.phase === 'clue' ? codenamesState.currentCluer : guesser;
      return summarizeGame(game, codenamesState.status, actor, true);
    }
    if (game === 'cards') {
      return summarizeGame(game, cardsState.status, cardsState.nextPlayer, true);
    }
    if (game === 'liars_dice') {
      return summarizeGame(game, liarsDiceState.status, liarsDiceState.nextPlayer, true);
    }

    return summarizeGame(game, backgammonState.status, backgammonState.nextPlayer, true);
  }, [
    backgammonState.nextPlayer,
    backgammonState.status,
    battleshipState.nextPlayer,
    battleshipState.status,
    cardsState.nextPlayer,
    cardsState.status,
    codenamesState,
    connect4State.nextPlayer,
    connect4State.status,
    dominationState.nextPlayer,
    dominationState.status,
    dotsState.nextPlayer,
    dotsState.status,
    game,
    goState.nextPlayer,
    goState.status,
    gomokuState.nextPlayer,
    gomokuState.status,
    hexState.nextPlayer,
    hexState.status,
    liarsDiceState.nextPlayer,
    liarsDiceState.status,
    loveLetterState.nextPlayer,
    loveLetterState.status,
    onitamaState.nextPlayer,
    onitamaState.status,
    quoridorState.nextPlayer,
    quoridorState.status,
    reversiState.nextPlayer,
    reversiState.status,
    santoriniState.nextPlayer,
    santoriniState.status,
    xiangqiState.nextPlayer,
    xiangqiState.status,
    yahtzeeState.nextPlayer,
    yahtzeeState.status
  ]);

  const yahtzeeAvailableCategories = useMemo(
    () =>
      yahtzeeState.categories.filter((category) => typeof yahtzeeState.scores.black[category] !== 'number'),
    [yahtzeeState.categories, yahtzeeState.scores.black]
  );
  const yahtzeeSelectedCategory =
    yahtzeeAvailableCategories.includes(yahtzeeCategory) && yahtzeeAvailableCategories.length > 0
      ? yahtzeeCategory
      : (yahtzeeAvailableCategories[0] ?? 'chance');

  const battleshipPublic = useMemo(
    () => toBattleshipPublicState(battleshipState, 'black', false),
    [battleshipState]
  );
  const loveLetterPublic = useMemo(
    () => toLoveLetterPublicState(loveLetterState, 'black'),
    [loveLetterState]
  );
  const codenamesPublic = useMemo(
    () => toCodenamesDuetPublicState(codenamesState, 'black', false),
    [codenamesState]
  );
  const cardsPublic = useMemo(() => toCardsPublicState(cardsState, 'black', true), [cardsState]);
  const liarsPublic = useMemo(() => toLiarsDicePublicState(liarsDiceState, 'black'), [liarsDiceState]);
  const backgammonLegalMoves = useMemo(
    () => sortBackgammonMoves(generateBackgammonMoves(backgammonState, 'white')),
    [backgammonState]
  );

  function runPhase1Bots(nextState: typeof gomokuState): typeof gomokuState {
    return runBotUntilHumanTurn(
      nextState,
      (state) => state.status === 'playing' && state.nextPlayer === 'white',
      (state) => gomokuBotMove(state)
    );
  }

  function runBackgammonBots(initial: typeof backgammonState): typeof backgammonState {
    return runBotUntilHumanTurn(
      initial,
      (state) => state.status === 'playing' && state.nextPlayer === 'black',
      (state) => {
        const stepped = backgammonBotMove(state, backgammonRandomRef.current);
        return skipBackgammonBlockedTurn(ensureBackgammonTurnDice(stepped, backgammonRandomRef.current));
      }
    );
  }

  function resetGomoku() {
    setGomokuState(createGomokuState(15));
  }

  function resetGo() {
    setGoState(createGoState(9));
  }

  function resetXiangqi() {
    setXiangqiSelection(null);
    setXiangqiState(createXiangqiState());
  }

  function resetConnect4() {
    setConnect4State(createConnect4State());
  }

  function resetReversi() {
    setReversiState(createReversiState());
  }

  function resetDots() {
    setDotsState(createDotsState());
  }

  function resetHex() {
    setHexState(createHexState({ boardSize: 11 }));
  }

  function resetQuoridor() {
    setQuoridorState(createQuoridorState({ boardSize: 9, wallsPerPlayer: 10 }));
  }

  function resetSantorini() {
    setSantoriniWorker('a');
    setSantoriniSelection(null);
    setSantoriniMoveTarget(null);
    setSantoriniState(createSantoriniState({ boardSize: 5 }));
  }

  function resetDomination() {
    setDominationState(createDominationState({ boardSize: 9 }));
  }

  function resetOnitama() {
    onitamaRandomRef.current = createSeededRandom('training-onitama-seed');
    const next = createTrainingOnitamaState(onitamaRandomRef.current);
    setOnitamaSelection(null);
    setOnitamaCard(next.cards.black[0] ?? 'tiger');
    setOnitamaState(next);
  }

  function resetBattleship() {
    battleshipRandomRef.current = createSeededRandom('training-battleship-seed');
    setBattleshipState(createTrainingBattleshipState(battleshipRandomRef.current));
  }

  function resetYahtzee() {
    yahtzeeRandomRef.current = createSeededRandom('training-yahtzee-seed');
    setYahtzeeHold(DEFAULT_YAHTZEE_HOLD);
    setYahtzeeCategory('chance');
    setYahtzeeState(createYahtzeeState({ startingPlayer: 'black' }));
  }

  function resetLoveLetter() {
    loveLetterRandomRef.current = createSeededRandom('training-love-letter-seed');
    const next = createTrainingLoveLetterState(loveLetterRandomRef.current);
    setLoveLetterCard(next.hands.black[0] ?? 'guard');
    setLoveLetterTarget('white');
    setLoveLetterGuess('priest');
    setLoveLetterState(next);
  }

  function resetCodenames() {
    codenamesRandomRef.current = createSeededRandom('training-codenames-seed');
    setCodenamesClueWord('signal');
    setCodenamesClueCount(1);
    setCodenamesState(createTrainingCodenamesState(codenamesRandomRef.current));
  }

  function resetCards() {
    cardsRandomRef.current = createSeededRandom('training-cards-seed');
    setCardsSuit('hearts');
    setCardsState(createTrainingCardsState(cardsRandomRef.current));
  }

  function resetLiarsDice() {
    liarsRandomRef.current = createSeededRandom('training-liars-seed');
    setLiarsBidQuantity(1);
    setLiarsBidFace(1);
    setLiarsDiceState(createTrainingLiarsDiceState(liarsRandomRef.current));
  }

  function resetBackgammon() {
    backgammonRandomRef.current = createSeededRandom('training-backgammon-seed');
    setBackgammonState(createTrainingBackgammonState(backgammonRandomRef.current));
  }

  return (
    <main className="panel training-page">
      <h2>Training Mode</h2>
      <p>{info}</p>
      {isPhase2Game(game) ? (
        <p className="training-sandbox-note">
          Training Sandbox: deterministic local seed, no realtime commit/reveal.
        </p>
      ) : null}

      <h3>Phase 1 - Public Board Games</h3>
      <div className="button-row training-tabs">
        {PHASE1_GAMES.map((entry) => (
          <button
            key={`phase1-${entry}`}
            type="button"
            className={game === entry ? '' : 'secondary'}
            onClick={() => setGame(entry)}
          >
            {GAME_LABEL[entry]}
          </button>
        ))}
      </div>

      <h3>Phase 2 - Training Sandbox</h3>
      <div className="button-row training-tabs">
        {PHASE2_GAMES.map((entry) => (
          <button
            key={`phase2-${entry}`}
            type="button"
            className={game === entry ? '' : 'secondary'}
            onClick={() => setGame(entry)}
          >
            {GAME_LABEL[entry]}
          </button>
        ))}
      </div>

      {game === 'gomoku' ? (
        <>
          <GomokuBoard
            state={gomokuState}
            disabled={gomokuState.status !== 'playing' || gomokuState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              const applied = applyGomokuMove(gomokuState, { x, y, player: 'black' });
              if (!applied.accepted) {
                return;
              }

              setGomokuState(runPhase1Bots(applied.nextState));
            }}
          />
          <button type="button" className="secondary" onClick={resetGomoku}>
            Reset Gomoku Training
          </button>
        </>
      ) : null}

      {game === 'go' ? (
        <>
          <GoBoard
            state={goState}
            disabled={goState.status !== 'playing' || goState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              const applied = applyGoMove(goState, {
                type: 'place',
                x,
                y,
                player: 'black'
              });
              if (!applied.accepted) {
                return;
              }

              const withBots = runBotUntilHumanTurn(
                applied.nextState,
                (state) => state.status === 'playing' && state.nextPlayer === 'white',
                (state) => goBotMove(state)
              );
              setGoState(withBots);
            }}
          />
          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                const applied = applyGoMove(goState, {
                  type: 'pass',
                  player: 'black'
                });
                if (!applied.accepted) {
                  return;
                }

                setGoState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => goBotMove(state)
                  )
                );
              }}
              disabled={goState.status !== 'playing' || goState.nextPlayer !== 'black'}
            >
              Pass
            </button>
            <button type="button" className="secondary" onClick={resetGo}>
              Reset Go Training
            </button>
          </div>
        </>
      ) : null}

      {game === 'xiangqi' ? (
        <>
          <XiangqiBoard
            state={xiangqiState}
            selected={xiangqiSelection}
            disabled={xiangqiState.status !== 'playing' || xiangqiState.nextPlayer !== 'red'}
            onCellClick={(x, y) => {
              const piece = xiangqiState.board[y][x];
              if (!xiangqiSelection) {
                if (!piece || piece.color !== 'red') {
                  return;
                }
                setXiangqiSelection({ x, y });
                return;
              }

              const move: XiangqiMove = {
                from: xiangqiSelection,
                to: { x, y },
                player: 'red'
              };
              setXiangqiSelection(null);

              const applied = applyXiangqiMove(xiangqiState, move);
              if (!applied.accepted) {
                return;
              }

              setXiangqiState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'black',
                  (state) => xiangqiBotMove(state)
                )
              );
            }}
          />
          <button type="button" className="secondary" onClick={resetXiangqi}>
            Reset Xiangqi Training
          </button>
        </>
      ) : null}

      {game === 'connect4' ? (
        <>
          <Connect4Board
            state={connect4State}
            disabled={connect4State.status !== 'playing' || connect4State.nextPlayer !== 'red'}
            onColumnClick={(column) => {
              const applied = applyConnect4Move(connect4State, {
                column,
                player: 'red'
              });
              if (!applied.accepted) {
                return;
              }

              setConnect4State(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'yellow',
                  (state) => connect4BotMove(state)
                )
              );
            }}
          />
          <button type="button" className="secondary" onClick={resetConnect4}>
            Reset Connect4 Training
          </button>
        </>
      ) : null}

      {game === 'reversi' ? (
        <>
          <ReversiBoard
            state={reversiState}
            disabled={reversiState.status !== 'playing' || reversiState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              const applied = applyReversiMove(reversiState, {
                x,
                y,
                player: 'black'
              });
              if (!applied.accepted) {
                return;
              }

              setReversiState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => reversiBotMove(state)
                )
              );
            }}
          />
          <p>
            Counts - black: {reversiState.counts.black}, white: {reversiState.counts.white}
          </p>
          <button type="button" className="secondary" onClick={resetReversi}>
            Reset Reversi Training
          </button>
        </>
      ) : null}

      {game === 'dots' ? (
        <>
          <DotsBoard
            state={dotsState}
            disabled={dotsState.status !== 'playing' || dotsState.nextPlayer !== 'black'}
            onLineClick={(move) => {
              const applied = applyDotsMove(dotsState, {
                ...move,
                player: 'black'
              });
              if (!applied.accepted) {
                return;
              }

              setDotsState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => dotsBotMove(state)
                )
              );
            }}
          />
          <p>
            Scores - black: {dotsState.scores.black}, white: {dotsState.scores.white}
          </p>
          <button type="button" className="secondary" onClick={resetDots}>
            Reset Dots Training
          </button>
        </>
      ) : null}

      {game === 'hex' ? (
        <>
          <HexBoard
            state={hexState}
            disabled={hexState.status !== 'playing' || hexState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              const applied = applyHexMove(hexState, {
                x,
                y,
                player: 'black'
              });
              if (!applied.accepted) {
                return;
              }

              setHexState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => hexBotMove(state)
                )
              );
            }}
          />
          <button type="button" className="secondary" onClick={resetHex}>
            Reset Hex Training
          </button>
        </>
      ) : null}

      {game === 'quoridor' ? (
        <>
          <p>
            Remaining walls - black: {quoridorState.remainingWalls.black}, white:{' '}
            {quoridorState.remainingWalls.white}
          </p>
          <QuoridorBoard
            state={quoridorState}
            disabled={quoridorState.status !== 'playing' || quoridorState.nextPlayer !== 'black'}
            onPawnMove={(x, y) => {
              const move: QuoridorMove = {
                type: 'pawn',
                x,
                y,
                player: 'black'
              };
              const applied = applyQuoridorMove(quoridorState, move);
              if (!applied.accepted) {
                return;
              }

              setQuoridorState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => quoridorBotMove(state)
                )
              );
            }}
            onWallPlace={(orientation, x, y) => {
              const move: QuoridorMove = {
                type: 'wall',
                orientation,
                x,
                y,
                player: 'black'
              };
              const applied = applyQuoridorMove(quoridorState, move);
              if (!applied.accepted) {
                return;
              }

              setQuoridorState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => quoridorBotMove(state)
                )
              );
            }}
          />
          <button type="button" className="secondary" onClick={resetQuoridor}>
            Reset Quoridor Training
          </button>
        </>
      ) : null}

      {game === 'santorini' ? (
        <>
          <div className="button-row">
            <label>
              Worker{' '}
              <select
                value={santoriniWorker}
                onChange={(event) => setSantoriniWorker(event.target.value as SantoriniMoveInput['worker'])}
                disabled={santoriniState.nextPlayer !== 'black' || santoriniState.status === 'completed'}
              >
                <option value="a">A</option>
                <option value="b">B</option>
              </select>
            </label>
            {santoriniState.status === 'playing' ? (
              <span>
                {santoriniMoveTarget
                  ? 'Click a build cell.'
                  : santoriniSelection
                    ? 'Click destination cell.'
                    : 'Click one of your workers.'}
              </span>
            ) : (
              <span>Setup: select worker + click a placement cell.</span>
            )}
          </div>

          <SantoriniBoard
            state={santoriniState}
            selected={santoriniSelection}
            moveTarget={santoriniMoveTarget}
            disabled={santoriniState.status === 'completed' || santoriniState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              if (santoriniState.status === 'completed' || santoriniState.nextPlayer !== 'black') {
                return;
              }

              if (santoriniState.status === 'setup') {
                const move: SantoriniMove = {
                  type: 'place',
                  worker: santoriniWorker,
                  x,
                  y,
                  player: 'black'
                };
                const applied = applySantoriniMove(santoriniState, move);
                if (!applied.accepted) {
                  return;
                }

                setSantoriniState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status !== 'completed' && state.nextPlayer === 'white',
                    (state) => santoriniBotMove(state)
                  )
                );
                return;
              }

              if (!santoriniSelection) {
                const a = santoriniState.workers.black.a;
                const b = santoriniState.workers.black.b;
                if (a?.x === x && a.y === y) {
                  setSantoriniSelection({ worker: 'a', x, y });
                  setSantoriniMoveTarget(null);
                  return;
                }
                if (b?.x === x && b.y === y) {
                  setSantoriniSelection({ worker: 'b', x, y });
                  setSantoriniMoveTarget(null);
                }
                return;
              }

              if (!santoriniMoveTarget) {
                setSantoriniMoveTarget({ x, y });
                return;
              }

              const move: SantoriniMove = {
                type: 'turn',
                worker: santoriniSelection.worker,
                to: santoriniMoveTarget,
                build: { x, y },
                player: 'black'
              };

              setSantoriniSelection(null);
              setSantoriniMoveTarget(null);

              const applied = applySantoriniMove(santoriniState, move);
              if (!applied.accepted) {
                return;
              }

              setSantoriniState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status !== 'completed' && state.nextPlayer === 'white',
                  (state) => santoriniBotMove(state)
                )
              );
            }}
          />

          <button type="button" className="secondary" onClick={resetSantorini}>
            Reset Santorini Training
          </button>
        </>
      ) : null}

      {game === 'domination' ? (
        <>
          <p>
            Scores - black: {dominationState.scores.black}, white: {dominationState.scores.white}
          </p>
          <p>
            Pieces - black: {dominationState.pieceCounts.black}, white: {dominationState.pieceCounts.white}
          </p>
          <p>
            Control - black: {dominationState.controlCounts.black}, white:{' '}
            {dominationState.controlCounts.white}
          </p>
          <DominationBoard
            state={dominationState}
            disabled={dominationState.status !== 'playing' || dominationState.nextPlayer !== 'black'}
            onCellClick={(x, y) => {
              const applied = applyDominationMove(dominationState, {
                x,
                y,
                player: 'black'
              });
              if (!applied.accepted) {
                return;
              }

              setDominationState(
                runBotUntilHumanTurn(
                  applied.nextState,
                  (state) => state.status === 'playing' && state.nextPlayer === 'white',
                  (state) => dominationBotMove(state)
                )
              );
            }}
          />
          <button type="button" className="secondary" onClick={resetDomination}>
            Reset Domination Training
          </button>
        </>
      ) : null}

      {game === 'onitama' ? (
        <>
          <p>
            Black cards: {onitamaState.cards.black.join(', ')} | White cards:{' '}
            {onitamaState.cards.white.join(', ')} | Side: {onitamaState.cards.side}
          </p>
          <div className="button-row">
            <label>
              Card{' '}
              <select
                value={onitamaCard}
                onChange={(event) => setOnitamaCard(event.target.value as OnitamaMoveInput['card'])}
                disabled={onitamaState.status !== 'playing' || onitamaState.nextPlayer !== 'black'}
              >
                {onitamaState.cards.black.map((card) => (
                  <option key={`onitama-card-${card}`} value={card}>
                    {card}
                  </option>
                ))}
              </select>
            </label>
            <span>
              {onitamaSelection
                ? `Selected ${onitamaSelection.x},${onitamaSelection.y}`
                : 'Select one of your pieces'}
            </span>
          </div>

          <div
            className="onitama-grid"
            style={{
              gridTemplateColumns: `repeat(${onitamaState.boardSize}, minmax(2.25rem, 1fr))`
            }}
          >
            {onitamaState.board.map((row, y) =>
              row.map((cell, x) => {
                const selected = onitamaSelection?.x === x && onitamaSelection.y === y;
                return (
                  <button
                    key={`onitama-${x}-${y}`}
                    type="button"
                    className={`onitama-cell ${selected ? 'selected' : ''}`}
                    disabled={onitamaState.status !== 'playing' || onitamaState.nextPlayer !== 'black'}
                    onClick={() => {
                      if (onitamaState.status !== 'playing' || onitamaState.nextPlayer !== 'black') {
                        return;
                      }

                      if (!onitamaSelection) {
                        if (!cell || cell.player !== 'black') {
                          return;
                        }
                        setOnitamaSelection({ x, y });
                        return;
                      }

                      const move: OnitamaMove = {
                        from: onitamaSelection,
                        to: { x, y },
                        card: onitamaCard,
                        player: 'black'
                      };
                      setOnitamaSelection(null);

                      const applied = applyOnitamaMove(onitamaState, move);
                      if (!applied.accepted) {
                        return;
                      }

                      setOnitamaState(
                        runBotUntilHumanTurn(
                          applied.nextState,
                          (state) => state.status === 'playing' && state.nextPlayer === 'white',
                          (state) => onitamaBotMove(state, onitamaRandomRef.current)
                        )
                      );
                    }}
                  >
                    {onitamaPieceLabel(cell)}
                  </button>
                );
              })
            )}
          </div>

          <button type="button" className="secondary" onClick={resetOnitama}>
            Reset Onitama Sandbox
          </button>
        </>
      ) : null}

      {game === 'battleship' ? (
        <>
          <p>
            Phase: {battleshipPublic.phase}, sunk by black: {battleshipPublic.sunkShips.black}, sunk by white:{' '}
            {battleshipPublic.sunkShips.white}
          </p>
          <p>Your outgoing shots</p>
          <div
            className="training-grid-board"
            style={{
              gridTemplateColumns: `repeat(${battleshipPublic.boardSize}, minmax(1.9rem, 1fr))`
            }}
          >
            {battleshipPublic.shots.black.flatMap((row, y) =>
              row.map((shot, x) => (
                <button
                  key={`battleship-out-${x}-${y}`}
                  type="button"
                  className="secondary"
                  disabled={
                    battleshipPublic.status !== 'playing' ||
                    battleshipPublic.phase !== 'playing' ||
                    battleshipPublic.nextPlayer !== 'black' ||
                    shot !== 'unknown'
                  }
                  onClick={() => {
                    const move: BattleshipMove = {
                      type: 'fire',
                      x,
                      y,
                      player: 'black'
                    };
                    const applied = applyBattleshipMove(battleshipState, move);
                    if (!applied.accepted) {
                      return;
                    }

                    setBattleshipState(
                      runBotUntilHumanTurn(
                        applied.nextState,
                        (state) => state.status === 'playing' && state.nextPlayer === 'white',
                        (state) => battleshipBotMove(state, battleshipRandomRef.current)
                      )
                    );
                  }}
                >
                  {shot === 'hit' ? 'X' : shot === 'miss' ? 'o' : '·'}
                </button>
              ))
            )}
          </div>

          <p>Your fleet view</p>
          <div
            className="training-grid-board"
            style={{
              gridTemplateColumns: `repeat(${battleshipPublic.boardSize}, minmax(1.9rem, 1fr))`
            }}
          >
            {battleshipPublic.shots.white.flatMap((row, y) =>
              row.map((shot, x) => {
                const hasShip = battleshipPublic.ships.black?.some((ship) => {
                  for (let offset = 0; offset < ship.length; offset += 1) {
                    const sx = ship.x + (ship.orientation === 'h' ? offset : 0);
                    const sy = ship.y + (ship.orientation === 'v' ? offset : 0);
                    if (sx === x && sy === y) {
                      return true;
                    }
                  }
                  return false;
                });

                const marker = shot === 'hit' ? 'X' : shot === 'miss' ? 'o' : hasShip ? 'S' : '·';
                return (
                  <div key={`battleship-own-${x}-${y}`} className="training-grid-cell">
                    {marker}
                  </div>
                );
              })
            )}
          </div>

          <button type="button" className="secondary" onClick={resetBattleship}>
            Reset Battleship Sandbox
          </button>
        </>
      ) : null}

      {game === 'yahtzee' ? (
        <>
          <p>
            Rolls used: {yahtzeeState.rollsUsed} | totals black/white: {yahtzeeState.totals.black}/
            {yahtzeeState.totals.white}
          </p>
          <div className="button-row">
            {yahtzeeState.dice.map((die, index) => (
              <button
                key={`training-yahtzee-die-${index}`}
                type="button"
                className={yahtzeeHold[index] ? '' : 'secondary'}
                disabled={
                  yahtzeeState.status !== 'playing' ||
                  yahtzeeState.nextPlayer !== 'black' ||
                  yahtzeeState.rollsUsed === 0 ||
                  yahtzeeState.rollsUsed >= 3
                }
                onClick={() =>
                  setYahtzeeHold((current) =>
                    current.map((held, heldIndex) => (heldIndex === index ? !held : held))
                  )
                }
              >
                {die}
              </button>
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              disabled={
                yahtzeeState.status !== 'playing' ||
                yahtzeeState.nextPlayer !== 'black' ||
                yahtzeeState.rollsUsed >= 3
              }
              onClick={() => {
                const move: YahtzeeMove = {
                  type: 'roll',
                  player: 'black',
                  hold: yahtzeeState.rollsUsed > 0 ? yahtzeeHold : undefined
                };

                const applied = applyYahtzeeMove(yahtzeeState, move, () =>
                  yahtzeeRandomRef.current.nextDie()
                );
                if (!applied.accepted) {
                  return;
                }

                setYahtzeeState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => yahtzeeBotMove(state, yahtzeeRandomRef.current)
                  )
                );
              }}
            >
              Roll
            </button>
            <label>
              Category{' '}
              <select
                value={yahtzeeSelectedCategory}
                disabled={
                  yahtzeeState.status !== 'playing' ||
                  yahtzeeState.nextPlayer !== 'black' ||
                  yahtzeeAvailableCategories.length === 0
                }
                onChange={(event) => setYahtzeeCategory(event.target.value as YahtzeeCategory)}
              >
                {yahtzeeState.categories.map((category) => (
                  <option key={`training-yahtzee-category-${category}`} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                yahtzeeState.status !== 'playing' ||
                yahtzeeState.nextPlayer !== 'black' ||
                yahtzeeState.rollsUsed === 0 ||
                yahtzeeAvailableCategories.length === 0
              }
              onClick={() => {
                const move: YahtzeeMove = {
                  type: 'score',
                  category: yahtzeeSelectedCategory,
                  player: 'black'
                };
                const applied = applyYahtzeeMove(yahtzeeState, move, () =>
                  yahtzeeRandomRef.current.nextDie()
                );
                if (!applied.accepted) {
                  return;
                }

                setYahtzeeState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => yahtzeeBotMove(state, yahtzeeRandomRef.current)
                  )
                );
              }}
            >
              Score
            </button>
          </div>
          <button type="button" className="secondary" onClick={resetYahtzee}>
            Reset Yahtzee Sandbox
          </button>
        </>
      ) : null}

      {game === 'love_letter' ? (
        <>
          <p>
            Round {loveLetterPublic.round} / target {loveLetterPublic.tokenTarget} | tokens black/white:{' '}
            {loveLetterPublic.tokens.black}/{loveLetterPublic.tokens.white}
          </p>
          <p>Draw pile: {loveLetterPublic.drawPileCount}</p>
          <p>
            Hand counts black/white: {loveLetterPublic.handCounts.black}/{loveLetterPublic.handCounts.white}
          </p>
          <p>Your hand: {loveLetterPublic.hand?.join(', ') || '(hidden)'}</p>
          <div className="button-row">
            <label>
              Card{' '}
              <select
                value={loveLetterCard}
                disabled={loveLetterState.status !== 'playing' || loveLetterState.nextPlayer !== 'black'}
                onChange={(event) => setLoveLetterCard(event.target.value as LoveLetterCardName)}
              >
                {(loveLetterState.hands.black.length > 0 ? loveLetterState.hands.black : ['guard']).map(
                  (card, index) => (
                    <option key={`training-love-letter-card-${card}-${index}`} value={card}>
                      {card}
                    </option>
                  )
                )}
              </select>
            </label>
            <label>
              Target{' '}
              <select
                value={loveLetterTarget}
                disabled={loveLetterState.status !== 'playing' || loveLetterState.nextPlayer !== 'black'}
                onChange={(event) => setLoveLetterTarget(event.target.value as 'black' | 'white')}
              >
                <option value="black">black</option>
                <option value="white">white</option>
              </select>
            </label>
            <label>
              Guess{' '}
              <select
                value={loveLetterGuess}
                disabled={loveLetterState.status !== 'playing' || loveLetterState.nextPlayer !== 'black'}
                onChange={(event) => setLoveLetterGuess(event.target.value as LoveLetterCardName)}
              >
                {LOVE_LETTER_GUESS_OPTIONS.map((card) => (
                  <option key={`training-love-letter-guess-${card}`} value={card}>
                    {card}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loveLetterState.status !== 'playing' || loveLetterState.nextPlayer !== 'black'}
              onClick={() => {
                const move: LoveLetterMove = {
                  type: 'play',
                  player: 'black',
                  card: loveLetterCard,
                  target: loveLetterTarget,
                  guess: loveLetterCard === 'guard' ? loveLetterGuess : undefined
                };

                const applied = applyLoveLetterMove(loveLetterState, move, () =>
                  createTrainingLoveLetterDeck(loveLetterRandomRef.current)
                );
                if (!applied.accepted) {
                  return;
                }

                setLoveLetterState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => loveLetterBotMove(state, loveLetterRandomRef.current)
                  )
                );
              }}
            >
              Play
            </button>
          </div>
          <button type="button" className="secondary" onClick={resetLoveLetter}>
            Reset Love Letter Sandbox
          </button>
        </>
      ) : null}

      {game === 'codenames_duet' ? (
        <>
          <p>
            Turns left: {codenamesPublic.turnsRemaining} | targets found: {codenamesPublic.targetCounts.found}
            /{codenamesPublic.targetCounts.total}
          </p>
          <p>
            Phase: {codenamesPublic.phase}, cluer: {codenamesPublic.currentCluer}, guesser:{' '}
            {codenamesPublic.currentGuesser}
          </p>
          {codenamesPublic.activeClue ? (
            <p>
              Active clue: {codenamesPublic.activeClue.word} ({codenamesPublic.activeClue.count})
            </p>
          ) : null}
          <div
            className="training-grid-board"
            style={{
              gridTemplateColumns: 'repeat(5, minmax(4.2rem, 1fr))'
            }}
          >
            {codenamesPublic.words.map((word, index) => {
              const revealedRole = codenamesPublic.revealedRoles[index];
              const keyRole = codenamesPublic.key?.[index] ?? null;
              const keyMark =
                keyRole === 'agent' ? 'A' : keyRole === 'assassin' ? 'X' : keyRole === 'neutral' ? 'N' : '';
              const revealedMark =
                revealedRole === 'agent'
                  ? 'AGENT'
                  : revealedRole === 'assassin'
                    ? 'ASSASSIN'
                    : revealedRole === 'neutral'
                      ? 'NEUTRAL'
                      : '';
              const canGuess =
                codenamesPublic.status === 'playing' &&
                codenamesPublic.phase === 'guess' &&
                codenamesPublic.currentGuesser === 'black' &&
                !codenamesPublic.revealed[index];

              return (
                <button
                  key={`training-codenames-${index}`}
                  type="button"
                  className="secondary"
                  disabled={!canGuess}
                  onClick={() => {
                    const applied = applyCodenamesDuetMove(codenamesState, {
                      type: 'guess',
                      index,
                      player: 'black'
                    });
                    if (!applied.accepted) {
                      return;
                    }

                    setCodenamesState(
                      runBotUntilHumanTurn(
                        applied.nextState,
                        (state) => {
                          if (state.status !== 'playing') {
                            return false;
                          }
                          const guesser = state.currentCluer === 'black' ? 'white' : 'black';
                          return (
                            (state.phase === 'clue' && state.currentCluer === 'white') ||
                            (state.phase === 'guess' && guesser === 'white')
                          );
                        },
                        (state) => codenamesBotMove(state, codenamesRandomRef.current)
                      )
                    );
                  }}
                >
                  <strong>{word}</strong>
                  <br />
                  <small>{revealedMark || keyMark || ' '}</small>
                </button>
              );
            })}
          </div>

          {codenamesPublic.status === 'playing' &&
          codenamesPublic.phase === 'clue' &&
          codenamesPublic.currentCluer === 'black' ? (
            <div className="button-row">
              <label>
                Clue{' '}
                <input
                  value={codenamesClueWord}
                  onChange={(event) => setCodenamesClueWord(event.target.value)}
                />
              </label>
              <label>
                Count{' '}
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={codenamesClueCount}
                  onChange={(event) =>
                    setCodenamesClueCount(Math.max(1, Math.min(9, Number(event.target.value) || 1)))
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const applied = applyCodenamesDuetMove(codenamesState, {
                    type: 'clue',
                    word: codenamesClueWord,
                    count: codenamesClueCount,
                    player: 'black'
                  });
                  if (!applied.accepted) {
                    return;
                  }

                  setCodenamesState(
                    runBotUntilHumanTurn(
                      applied.nextState,
                      (state) => {
                        if (state.status !== 'playing') {
                          return false;
                        }
                        const guesser = state.currentCluer === 'black' ? 'white' : 'black';
                        return (
                          (state.phase === 'clue' && state.currentCluer === 'white') ||
                          (state.phase === 'guess' && guesser === 'white')
                        );
                      },
                      (state) => codenamesBotMove(state, codenamesRandomRef.current)
                    )
                  );
                }}
              >
                Submit clue
              </button>
            </div>
          ) : null}

          {codenamesPublic.status === 'playing' &&
          codenamesPublic.phase === 'guess' &&
          codenamesPublic.currentGuesser === 'black' ? (
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const applied = applyCodenamesDuetMove(codenamesState, {
                    type: 'end_guesses',
                    player: 'black'
                  });
                  if (!applied.accepted) {
                    return;
                  }

                  setCodenamesState(
                    runBotUntilHumanTurn(
                      applied.nextState,
                      (state) => {
                        if (state.status !== 'playing') {
                          return false;
                        }
                        const guesser = state.currentCluer === 'black' ? 'white' : 'black';
                        return (
                          (state.phase === 'clue' && state.currentCluer === 'white') ||
                          (state.phase === 'guess' && guesser === 'white')
                        );
                      },
                      (state) => codenamesBotMove(state, codenamesRandomRef.current)
                    )
                  );
                }}
              >
                End guesses
              </button>
            </div>
          ) : null}

          <button type="button" className="secondary" onClick={resetCodenames}>
            Reset Codenames Sandbox
          </button>
        </>
      ) : null}

      {game === 'cards' ? (
        <>
          <p>
            Top: {cardsPublic.topCard.rank}-{cardsPublic.topCard.suit} | active suit: {cardsPublic.activeSuit}
          </p>
          <p>
            Hand counts black/white: {cardsPublic.handCounts.black}/{cardsPublic.handCounts.white} | draw
            pile: {cardsPublic.drawPileCount}
          </p>
          {cardsPublic.hand ? (
            <div className="button-row">
              {cardsPublic.hand.map((card, index) => {
                const playable =
                  card.rank === '8' ||
                  card.suit === cardsPublic.activeSuit ||
                  card.rank === cardsPublic.topCard.rank;
                return (
                  <button
                    key={`training-cards-hand-${card.suit}-${card.rank}-${index}`}
                    type="button"
                    className="secondary"
                    disabled={
                      cardsPublic.status !== 'playing' || cardsPublic.nextPlayer !== 'black' || !playable
                    }
                    onClick={() => {
                      const move =
                        card.rank === '8'
                          ? {
                              type: 'play' as const,
                              player: 'black' as const,
                              card,
                              chosenSuit: cardsSuit
                            }
                          : {
                              type: 'play' as const,
                              player: 'black' as const,
                              card
                            };

                      const applied = applyCardsMove(cardsState, move);
                      if (!applied.accepted) {
                        return;
                      }

                      setCardsState(
                        runBotUntilHumanTurn(
                          applied.nextState,
                          (state) => state.status === 'playing' && state.nextPlayer === 'white',
                          (state) => cardsBotMove(state, cardsRandomRef.current)
                        )
                      );
                    }}
                  >
                    {card.rank}-{card.suit[0].toUpperCase()}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="button-row">
            <label>
              8 suit{' '}
              <select
                value={cardsSuit}
                onChange={(event) => setCardsSuit(event.target.value as (typeof CARD_SUITS)[number])}
              >
                {CARD_SUITS.map((suit) => (
                  <option key={`training-cards-suit-${suit}`} value={suit}>
                    {suit}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={cardsPublic.status !== 'playing' || cardsPublic.nextPlayer !== 'black'}
              onClick={() => {
                const applied = applyCardsMove(cardsState, {
                  type: 'draw',
                  player: 'black'
                });
                if (!applied.accepted) {
                  return;
                }

                setCardsState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => cardsBotMove(state, cardsRandomRef.current)
                  )
                );
              }}
            >
              Draw
            </button>
            <button
              type="button"
              className="secondary"
              disabled={
                cardsPublic.status !== 'playing' ||
                cardsPublic.nextPlayer !== 'black' ||
                !cardsPublic.pendingDrawPlay
              }
              onClick={() => {
                const applied = applyCardsMove(cardsState, {
                  type: 'end_turn',
                  player: 'black'
                });
                if (!applied.accepted) {
                  return;
                }

                setCardsState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => cardsBotMove(state, cardsRandomRef.current)
                  )
                );
              }}
            >
              End Turn
            </button>
          </div>

          <button type="button" className="secondary" onClick={resetCards}>
            Reset Cards Sandbox
          </button>
        </>
      ) : null}

      {game === 'liars_dice' ? (
        <>
          <p>
            Dice counts black/white: {liarsPublic.diceCounts.black}/{liarsPublic.diceCounts.white}
          </p>
          <p>Your dice: {liarsPublic.viewerDice?.join(', ') ?? '(hidden)'}</p>
          <p>
            Current bid:{' '}
            {liarsPublic.currentBid
              ? `${liarsPublic.currentBid.quantity} x ${liarsPublic.currentBid.face}`
              : 'none'}
          </p>
          {liarsPublic.lastRound ? (
            <p>
              Last round - called {liarsPublic.lastRound.calledBid.quantity}x
              {liarsPublic.lastRound.calledBid.face}, total {liarsPublic.lastRound.totalMatching}, loser{' '}
              {liarsPublic.lastRound.loser}
            </p>
          ) : null}
          <div className="button-row">
            <label>
              Quantity{' '}
              <input
                type="number"
                min={1}
                value={liarsBidQuantity}
                onChange={(event) => setLiarsBidQuantity(Math.max(1, Number(event.target.value) || 1))}
                disabled={liarsPublic.status !== 'playing' || liarsPublic.nextPlayer !== 'black'}
              />
            </label>
            <label>
              Face{' '}
              <input
                type="number"
                min={1}
                max={6}
                value={liarsBidFace}
                onChange={(event) => {
                  const next = Number(event.target.value) || 1;
                  setLiarsBidFace(Math.max(1, Math.min(6, next)));
                }}
                disabled={liarsPublic.status !== 'playing' || liarsPublic.nextPlayer !== 'black'}
              />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              disabled={liarsPublic.status !== 'playing' || liarsPublic.nextPlayer !== 'black'}
              onClick={() => {
                const applied = applyLiarsDiceMove(
                  liarsDiceState,
                  {
                    type: 'bid',
                    quantity: liarsBidQuantity,
                    face: liarsBidFace,
                    player: 'black'
                  },
                  () => liarsRandomRef.current.nextDie()
                );
                if (!applied.accepted) {
                  return;
                }

                setLiarsDiceState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => liarsDiceBotMove(state, liarsRandomRef.current)
                  )
                );
              }}
            >
              Bid
            </button>
            <button
              type="button"
              className="secondary"
              disabled={
                liarsPublic.status !== 'playing' ||
                liarsPublic.nextPlayer !== 'black' ||
                liarsPublic.currentBid === null
              }
              onClick={() => {
                const applied = applyLiarsDiceMove(
                  liarsDiceState,
                  {
                    type: 'call_liar',
                    player: 'black'
                  },
                  () => liarsRandomRef.current.nextDie()
                );
                if (!applied.accepted) {
                  return;
                }

                setLiarsDiceState(
                  runBotUntilHumanTurn(
                    applied.nextState,
                    (state) => state.status === 'playing' && state.nextPlayer === 'white',
                    (state) => liarsDiceBotMove(state, liarsRandomRef.current)
                  )
                );
              }}
            >
              Call Liar
            </button>
          </div>

          <button type="button" className="secondary" onClick={resetLiarsDice}>
            Reset Liar's Dice Sandbox
          </button>
        </>
      ) : null}

      {game === 'backgammon' ? (
        <>
          <p>
            Dice: {backgammonState.dice ? `${backgammonState.dice[0]}, ${backgammonState.dice[1]}` : 'n/a'} |
            Remaining: {backgammonState.remainingDice.join(', ') || 'none'}
          </p>
          <p>
            Bar W/B: {backgammonState.bar.white}/{backgammonState.bar.black} | Off W/B:{' '}
            {backgammonState.borneOff.white}/{backgammonState.borneOff.black}
          </p>
          <div className="backgammon-points-grid">
            {backgammonState.points.map((point, index) => (
              <div key={`backgammon-point-${index}`} className="backgammon-point">
                <strong>{index}</strong>
                <span>{formatBackgammonPoint(point)}</span>
              </div>
            ))}
          </div>

          <p>Legal moves ({backgammonLegalMoves.length}):</p>
          <div className="button-row">
            {backgammonLegalMoves.length > 0 ? (
              backgammonLegalMoves.map((move, index) => (
                <button
                  key={`backgammon-move-${move.from}-${move.to}-${move.die}-${index}`}
                  type="button"
                  className="secondary"
                  disabled={backgammonState.status !== 'playing' || backgammonState.nextPlayer !== 'white'}
                  onClick={() => {
                    const applied = applyBackgammonMove(backgammonState, move);
                    if (!applied.accepted) {
                      return;
                    }

                    const normalized = skipBackgammonBlockedTurn(
                      ensureBackgammonTurnDice(applied.nextState, backgammonRandomRef.current)
                    );
                    setBackgammonState(runBackgammonBots(normalized));
                  }}
                >
                  {`${move.from} -> ${move.to} (d${move.die})`}
                </button>
              ))
            ) : (
              <span>No legal move right now (auto-pass handles blocked turns).</span>
            )}
          </div>

          <button type="button" className="secondary" onClick={resetBackgammon}>
            Reset Backgammon Sandbox
          </button>
        </>
      ) : null}
    </main>
  );
}

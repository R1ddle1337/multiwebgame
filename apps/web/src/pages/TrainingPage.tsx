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
import { useI18n } from '../context/I18nContext';
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

export function TrainingPage() {
  const { t } = useI18n();
  const [game, setGame] = useState<TrainingGame>('gomoku');

  const withFallback = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const gameLabel = (type: TrainingGame) => t(`enum.game.${type}`);
  const colorLabel = (color: string) => withFallback(`enum.color.${color}`, color);
  const statusLabel = (status: string) => withFallback(`enum.status.${status}`, status);
  const suitLabel = (suit: string) => withFallback(`enum.suit.${suit}`, suit);
  const codenamesPhaseLabel = (phase: string) => withFallback(`training.codenames.phase.${phase}`, phase);
  const battleshipPhaseLabel = (phase: string) => withFallback(`training.battleship.phase.${phase}`, phase);
  const resetLabel = (type: TrainingGame, sandbox = false) =>
    t('training.reset', {
      game: gameLabel(type),
      scope: t(sandbox ? 'training.mode.sandbox' : 'training.mode.training')
    });
  const summarizeGame = (type: TrainingGame, status: string, nextPlayer: string, sandbox = false) =>
    t('training.summary', {
      mode: t(sandbox ? 'training.mode.sandbox' : 'training.mode.training'),
      game: gameLabel(type),
      status: statusLabel(status),
      next: colorLabel(nextPlayer)
    });

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

  const info = (() => {
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
  })();

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
      <h2>{t('training.title')}</h2>
      <p>{info}</p>
      {isPhase2Game(game) ? <p className="training-sandbox-note">{t('training.sandbox_note')}</p> : null}

      <h3>{t('training.phase1.title')}</h3>
      <div className="button-row training-tabs">
        {PHASE1_GAMES.map((entry) => (
          <button
            key={`phase1-${entry}`}
            type="button"
            className={game === entry ? '' : 'secondary'}
            onClick={() => setGame(entry)}
          >
            {gameLabel(entry)}
          </button>
        ))}
      </div>

      <h3>{t('training.phase2.title')}</h3>
      <div className="button-row training-tabs">
        {PHASE2_GAMES.map((entry) => (
          <button
            key={`phase2-${entry}`}
            type="button"
            className={game === entry ? '' : 'secondary'}
            onClick={() => setGame(entry)}
          >
            {gameLabel(entry)}
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
            {resetLabel('gomoku')}
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
              {t('room.pass')}
            </button>
            <button type="button" className="secondary" onClick={resetGo}>
              {resetLabel('go')}
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
            {resetLabel('xiangqi')}
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
            {resetLabel('connect4')}
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
            {t('room.reversi.counts', {
              black: reversiState.counts.black,
              white: reversiState.counts.white
            })}
          </p>
          <button type="button" className="secondary" onClick={resetReversi}>
            {resetLabel('reversi')}
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
            {t('room.dots.scores', {
              black: dotsState.scores.black,
              white: dotsState.scores.white
            })}
          </p>
          <button type="button" className="secondary" onClick={resetDots}>
            {resetLabel('dots')}
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
            {resetLabel('hex')}
          </button>
        </>
      ) : null}

      {game === 'quoridor' ? (
        <>
          <p>
            {t('room.quoridor.walls_remaining', {
              black: quoridorState.remainingWalls.black,
              white: quoridorState.remainingWalls.white
            })}
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
            {resetLabel('quoridor')}
          </button>
        </>
      ) : null}

      {game === 'santorini' ? (
        <>
          <div className="button-row">
            <label>
              {t('training.label.worker')}{' '}
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
                  ? t('training.santorini.prompt.build')
                  : santoriniSelection
                    ? t('training.santorini.prompt.destination')
                    : t('training.santorini.prompt.select_worker')}
              </span>
            ) : (
              <span>{t('training.santorini.prompt.setup')}</span>
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
            {resetLabel('santorini')}
          </button>
        </>
      ) : null}

      {game === 'domination' ? (
        <>
          <p>
            {t('room.domination.scores', {
              black: dominationState.scores.black,
              white: dominationState.scores.white
            })}
          </p>
          <p>
            {t('room.domination.pieces', {
              black: dominationState.pieceCounts.black,
              white: dominationState.pieceCounts.white
            })}
          </p>
          <p>
            {t('room.domination.controls', {
              black: dominationState.controlCounts.black,
              white: dominationState.controlCounts.white
            })}
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
            {resetLabel('domination')}
          </button>
        </>
      ) : null}

      {game === 'onitama' ? (
        <>
          <p>
            {t('training.onitama.cards', {
              blackLabel: colorLabel('black'),
              blackCards: onitamaState.cards.black.join(', '),
              whiteLabel: colorLabel('white'),
              whiteCards: onitamaState.cards.white.join(', '),
              sideLabel: t('training.label.side'),
              side: colorLabel(onitamaState.cards.side)
            })}
          </p>
          <div className="button-row">
            <label>
              {t('training.label.card')}{' '}
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
                ? t('training.onitama.selected', {
                    x: onitamaSelection.x,
                    y: onitamaSelection.y
                  })
                : t('training.onitama.select_piece')}
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
            {resetLabel('onitama', true)}
          </button>
        </>
      ) : null}

      {game === 'battleship' ? (
        <>
          <p>
            {t('training.battleship.status', {
              phaseLabel: t('training.label.phase'),
              phase: battleshipPhaseLabel(battleshipPublic.phase),
              blackLabel: colorLabel('black'),
              sunkBlack: battleshipPublic.sunkShips.black,
              whiteLabel: colorLabel('white'),
              sunkWhite: battleshipPublic.sunkShips.white
            })}
          </p>
          <p>{t('training.battleship.outgoing_shots')}</p>
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

          <p>{t('training.battleship.fleet_view')}</p>
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
            {resetLabel('battleship', true)}
          </button>
        </>
      ) : null}

      {game === 'yahtzee' ? (
        <>
          <p>
            {t('training.yahtzee.overview', {
              rollsUsed: yahtzeeState.rollsUsed,
              blackLabel: colorLabel('black'),
              totalBlack: yahtzeeState.totals.black,
              whiteLabel: colorLabel('white'),
              totalWhite: yahtzeeState.totals.white
            })}
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
              {t('room.yahtzee.roll')}
            </button>
            <label>
              {t('room.yahtzee.category')}{' '}
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
              {t('room.yahtzee.score')}
            </button>
          </div>
          <button type="button" className="secondary" onClick={resetYahtzee}>
            {resetLabel('yahtzee', true)}
          </button>
        </>
      ) : null}

      {game === 'love_letter' ? (
        <>
          <p>
            {t('room.love_letter.round', {
              current: loveLetterPublic.round,
              target: loveLetterPublic.tokenTarget
            })}
          </p>
          <p>
            {t('room.love_letter.tokens', {
              black: loveLetterPublic.tokens.black,
              white: loveLetterPublic.tokens.white
            })}
          </p>
          <p>{t('room.love_letter.draw_pile', { count: loveLetterPublic.drawPileCount })}</p>
          <p>
            {t('room.love_letter.hand_counts', {
              black: loveLetterPublic.handCounts.black,
              white: loveLetterPublic.handCounts.white
            })}
          </p>
          <p>
            {loveLetterPublic.hand
              ? t('room.love_letter.your_hand', {
                  cards: loveLetterPublic.hand.join(', ')
                })
              : t('room.love_letter.hidden_hand')}
          </p>
          <div className="button-row">
            <label>
              {t('training.label.card')}{' '}
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
              {t('training.label.target')}{' '}
              <select
                value={loveLetterTarget}
                disabled={loveLetterState.status !== 'playing' || loveLetterState.nextPlayer !== 'black'}
                onChange={(event) => setLoveLetterTarget(event.target.value as 'black' | 'white')}
              >
                <option value="black">{colorLabel('black')}</option>
                <option value="white">{colorLabel('white')}</option>
              </select>
            </label>
            <label>
              {t('training.label.guess')}{' '}
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
              {t('room.love_letter.play')}
            </button>
          </div>
          <button type="button" className="secondary" onClick={resetLoveLetter}>
            {resetLabel('love_letter', true)}
          </button>
        </>
      ) : null}

      {game === 'codenames_duet' ? (
        <>
          <p>
            {t('room.codenames.turns_remaining', {
              turns: codenamesPublic.turnsRemaining
            })}{' '}
            |{' '}
            {t('room.codenames.targets', {
              found: codenamesPublic.targetCounts.found,
              total: codenamesPublic.targetCounts.total
            })}
          </p>
          <p>
            {t('training.codenames.phase_status', {
              phaseLabel: t('training.label.phase'),
              phase: codenamesPhaseLabel(codenamesPublic.phase),
              cluerLabel: t('training.label.cluer'),
              cluer: colorLabel(codenamesPublic.currentCluer),
              guesserLabel: t('training.label.guesser'),
              guesser: colorLabel(codenamesPublic.currentGuesser)
            })}
          </p>
          {codenamesPublic.activeClue ? (
            <p>
              {t('training.codenames.active_clue', {
                word: codenamesPublic.activeClue.word,
                count: codenamesPublic.activeClue.count
              })}
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
                  ? t('training.codenames.mark.agent')
                  : revealedRole === 'assassin'
                    ? t('training.codenames.mark.assassin')
                    : revealedRole === 'neutral'
                      ? t('training.codenames.mark.neutral')
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
                {t('training.label.clue')}{' '}
                <input
                  value={codenamesClueWord}
                  onChange={(event) => setCodenamesClueWord(event.target.value)}
                />
              </label>
              <label>
                {t('training.label.count')}{' '}
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
                {t('room.codenames.submit_clue')}
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
                {t('room.codenames.end_guesses')}
              </button>
            </div>
          ) : null}

          <button type="button" className="secondary" onClick={resetCodenames}>
            {resetLabel('codenames_duet', true)}
          </button>
        </>
      ) : null}

      {game === 'cards' ? (
        <>
          <p>
            {t('room.cards.top', {
              card: `${cardsPublic.topCard.rank}-${suitLabel(cardsPublic.topCard.suit)}`
            })}{' '}
            | {t('room.cards.active_suit', { suit: suitLabel(cardsPublic.activeSuit) })}
          </p>
          <p>
            {t('room.cards.hand_counts', {
              black: cardsPublic.handCounts.black,
              white: cardsPublic.handCounts.white
            })}{' '}
            | {t('room.cards.draw_pile', { count: cardsPublic.drawPileCount ?? t('training.liars.none') })}
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
                    {card.rank}-{suitLabel(card.suit)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="button-row">
            <label>
              {t('training.cards.eight_suit')}{' '}
              <select
                value={cardsSuit}
                onChange={(event) => setCardsSuit(event.target.value as (typeof CARD_SUITS)[number])}
              >
                {CARD_SUITS.map((suit) => (
                  <option key={`training-cards-suit-${suit}`} value={suit}>
                    {suitLabel(suit)}
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
              {t('room.cards.draw')}
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
              {t('room.cards.end_turn')}
            </button>
          </div>

          <button type="button" className="secondary" onClick={resetCards}>
            {resetLabel('cards', true)}
          </button>
        </>
      ) : null}

      {game === 'liars_dice' ? (
        <>
          <p>
            {t('room.liars.dice_counts', {
              black: liarsPublic.diceCounts.black,
              white: liarsPublic.diceCounts.white
            })}
          </p>
          <p>
            {liarsPublic.viewerDice
              ? t('room.liars.your_dice', {
                  dice: liarsPublic.viewerDice.join(', ')
                })
              : t('room.liars.hidden_dice')}
          </p>
          <p>
            {t('training.liars.current_bid')}{' '}
            {liarsPublic.currentBid
              ? `${liarsPublic.currentBid.quantity} x ${liarsPublic.currentBid.face}`
              : t('training.liars.none')}
          </p>
          {liarsPublic.lastRound ? (
            <p>
              {t('room.liars.last_round', {
                quantity: liarsPublic.lastRound.calledBid.quantity,
                face: liarsPublic.lastRound.calledBid.face,
                total: liarsPublic.lastRound.totalMatching,
                loser: colorLabel(liarsPublic.lastRound.loser)
              })}
            </p>
          ) : null}
          <div className="button-row">
            <label>
              {t('training.label.quantity')}{' '}
              <input
                type="number"
                min={1}
                value={liarsBidQuantity}
                onChange={(event) => setLiarsBidQuantity(Math.max(1, Number(event.target.value) || 1))}
                disabled={liarsPublic.status !== 'playing' || liarsPublic.nextPlayer !== 'black'}
              />
            </label>
            <label>
              {t('room.liars.face')}{' '}
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
              {t('room.liars.bid_submit')}
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
              {t('room.liars.call_liar')}
            </button>
          </div>

          <button type="button" className="secondary" onClick={resetLiarsDice}>
            {resetLabel('liars_dice', true)}
          </button>
        </>
      ) : null}

      {game === 'backgammon' ? (
        <>
          <p>
            {t('training.backgammon.dice', {
              dice: backgammonState.dice
                ? `${backgammonState.dice[0]}, ${backgammonState.dice[1]}`
                : t('training.backgammon.na'),
              remaining: backgammonState.remainingDice.join(', ') || t('training.backgammon.none')
            })}
          </p>
          <p>
            {t('training.backgammon.bar_off', {
              barWhite: backgammonState.bar.white,
              barBlack: backgammonState.bar.black,
              offWhite: backgammonState.borneOff.white,
              offBlack: backgammonState.borneOff.black
            })}
          </p>
          <div className="backgammon-points-grid">
            {backgammonState.points.map((point, index) => (
              <div key={`backgammon-point-${index}`} className="backgammon-point">
                <strong>{index}</strong>
                <span>{formatBackgammonPoint(point)}</span>
              </div>
            ))}
          </div>

          <p>{t('training.backgammon.legal_moves', { count: backgammonLegalMoves.length })}</p>
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
              <span>{t('training.backgammon.no_legal_moves')}</span>
            )}
          </div>

          <button type="button" className="secondary" onClick={resetBackgammon}>
            {resetLabel('backgammon', true)}
          </button>
        </>
      ) : null}
    </main>
  );
}

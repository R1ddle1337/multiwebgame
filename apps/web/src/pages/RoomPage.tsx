import {
  createBattleshipState,
  createConnect4State,
  createDotsState,
  createHexState,
  createGoState,
  createGomokuState,
  createOnitamaState,
  createYahtzeeState,
  createSantoriniState,
  createQuoridorState,
  createReversiState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type {
  BattleshipMove,
  BattleshipMoveInput,
  BattleshipShipPlacement,
  BattleshipState,
  YahtzeeCategory,
  YahtzeeMove,
  YahtzeeMoveInput,
  YahtzeeState,
  CardsCard,
  CardsMoveInput,
  CardsState,
  CodenamesDuetMove,
  CodenamesDuetMoveInput,
  CodenamesDuetState,
  Connect4Move,
  Connect4State,
  DotsMove,
  DotsState,
  GoMove,
  GoState,
  GomokuMove,
  GomokuState,
  HexMove,
  HexState,
  LiarsDiceMoveInput,
  LiarsDiceState,
  LoveLetterMove,
  LoveLetterMoveInput,
  LoveLetterState,
  OnitamaMove,
  OnitamaMoveInput,
  OnitamaState,
  QuoridorMove,
  QuoridorMoveInput,
  QuoridorState,
  ReversiMove,
  ReversiState,
  RoomDTO,
  SantoriniMove,
  SantoriniMoveInput,
  SantoriniState,
  UserDTO,
  XiangqiColor,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Connect4Board } from '../components/Connect4Board';
import { DotsBoard } from '../components/DotsBoard';
import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { HexBoard } from '../components/HexBoard';
import { QuoridorBoard } from '../components/QuoridorBoard';
import { ReversiBoard } from '../components/ReversiBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';
import { describeLastMove, didTurnSwitchToCurrent, type LastMoveSummary } from '../lib/roomUx';

interface Props {
  api: ApiClient;
  user: UserDTO;
}

function playerSeat(room: RoomDTO | null, userId: string): number | null {
  if (!room) {
    return null;
  }

  return room.players.find((player) => player.userId === userId)?.seat ?? null;
}

function formatResultText(
  state:
    | BattleshipState
    | YahtzeeState
    | Connect4State
    | DotsState
    | GomokuState
    | GoState
    | HexState
    | LoveLetterState
    | OnitamaState
    | QuoridorState
    | ReversiState
    | XiangqiState,
  statusLabel: (status: 'open' | 'in_match' | 'closed' | 'playing' | 'completed' | 'draw') => string,
  colorLabel: (color: 'black' | 'white' | 'red' | 'yellow') => string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (state.status === 'playing') {
    return statusLabel('playing');
  }

  if (state.status === 'draw') {
    return t('room.result.draw');
  }

  if (state.winner) {
    return t('room.result.winner', { winner: colorLabel(state.winner) });
  }

  return t('room.result.draw');
}

function formatActionText(
  summary: LastMoveSummary,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (summary.action.kind === 'pass') {
    return t('room.last_move.action.pass');
  }

  if (summary.action.kind === 'place') {
    return t('room.last_move.action.place', { point: summary.action.point });
  }

  return t('room.last_move.action.move', {
    from: summary.action.from,
    to: summary.action.to
  });
}

const CARD_SUITS: CardsCard['suit'][] = ['clubs', 'diamonds', 'hearts', 'spades'];
const DEFAULT_BATTLESHIP_FLEET: BattleshipShipPlacement[] = [
  { x: 0, y: 0, orientation: 'h', length: 5 },
  { x: 0, y: 1, orientation: 'h', length: 4 },
  { x: 0, y: 2, orientation: 'h', length: 3 },
  { x: 0, y: 3, orientation: 'h', length: 3 },
  { x: 0, y: 4, orientation: 'h', length: 2 }
];
const DEFAULT_YAHTZEE_HOLD = [false, false, false, false, false];
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

function santoriniWorkerAt(state: SantoriniState, x: number, y: number): string | null {
  for (const player of ['black', 'white'] as const) {
    for (const worker of ['a', 'b'] as const) {
      const position = state.workers[player][worker];
      if (position && position.x === x && position.y === y) {
        return `${player === 'black' ? 'B' : 'W'}${worker.toUpperCase()}`;
      }
    }
  }

  return null;
}

function onitamaPieceAt(state: OnitamaState, x: number, y: number): string | null {
  const piece = state.board[y][x];
  if (!piece) {
    return null;
  }

  const prefix = piece.player === 'black' ? 'B' : 'W';
  const suffix = piece.kind === 'master' ? 'M' : 'S';
  return `${prefix}${suffix}`;
}

function battleshipShipAt(
  ships: BattleshipShipPlacement[] | null,
  x: number,
  y: number
): BattleshipShipPlacement | null {
  if (!ships) {
    return null;
  }

  for (const ship of ships) {
    for (let offset = 0; offset < ship.length; offset += 1) {
      const cellX = ship.x + (ship.orientation === 'h' ? offset : 0);
      const cellY = ship.y + (ship.orientation === 'v' ? offset : 0);
      if (cellX === x && cellY === y) {
        return ship;
      }
    }
  }

  return null;
}

function formatCardsCard(card: CardsCard): string {
  const suitInitial = card.suit.slice(0, 1).toUpperCase();
  return `${card.rank}${suitInitial}`;
}

export function RoomPage({ api, user }: Props) {
  const { t, translateError } = useI18n();
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const realtime = useRealtime();
  const send = realtime.send;

  const [fallbackRoom, setFallbackRoom] = useState<RoomDTO | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteLinkUrl, setInviteLinkUrl] = useState<string | null>(null);
  const [inviteLinkNotice, setInviteLinkNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);
  const [santoriniWorker, setSantoriniWorker] = useState<'a' | 'b'>('a');
  const [santoriniMoveX, setSantoriniMoveX] = useState(0);
  const [santoriniMoveY, setSantoriniMoveY] = useState(0);
  const [santoriniBuildX, setSantoriniBuildX] = useState(0);
  const [santoriniBuildY, setSantoriniBuildY] = useState(0);
  const [onitamaCard, setOnitamaCard] = useState<OnitamaMoveInput['card']>('tiger');
  const [onitamaFromX, setOnitamaFromX] = useState(2);
  const [onitamaFromY, setOnitamaFromY] = useState(4);
  const [onitamaToX, setOnitamaToX] = useState(2);
  const [onitamaToY, setOnitamaToY] = useState(2);
  const [battleshipFleet, setBattleshipFleet] = useState<BattleshipShipPlacement[]>(DEFAULT_BATTLESHIP_FLEET);
  const [battleshipShotX, setBattleshipShotX] = useState(0);
  const [battleshipShotY, setBattleshipShotY] = useState(0);
  const [yahtzeeHold, setYahtzeeHold] = useState<boolean[]>(DEFAULT_YAHTZEE_HOLD);
  const [yahtzeeCategory, setYahtzeeCategory] = useState<YahtzeeCategory>('chance');
  const [codenamesClueWord, setCodenamesClueWord] = useState('ocean');
  const [codenamesClueCount, setCodenamesClueCount] = useState(1);
  const [codenamesGuessIndex, setCodenamesGuessIndex] = useState(0);
  const [loveLetterCard, setLoveLetterCard] = useState<LoveLetterMoveInput['card']>('guard');
  const [loveLetterTarget, setLoveLetterTarget] = useState<LoveLetterMoveInput['target']>('white');
  const [loveLetterGuess, setLoveLetterGuess] = useState<LoveLetterMoveInput['guess']>('priest');
  const [liarsBidQuantity, setLiarsBidQuantity] = useState(1);
  const [liarsBidFace, setLiarsBidFace] = useState(1);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const gameLabel = (gameType: RoomDTO['gameType']) => t(`enum.game.${gameType}`);
  const roleLabel = (role: 'player' | 'spectator') => t(`enum.role.${role}`);
  const statusLabel = useCallback(
    (status: 'open' | 'in_match' | 'closed' | 'playing' | 'completed' | 'draw') => t(`enum.status.${status}`),
    [t]
  );
  const colorLabel = useCallback(
    (color: 'black' | 'white' | 'red' | 'yellow') => t(`enum.color.${color}`),
    [t]
  );
  const suitLabel = useCallback((suit: CardsCard['suit']) => t(`enum.suit.${suit}`), [t]);

  const watchMode = useMemo(
    () => new URLSearchParams(location.search).get('watch') === '1',
    [location.search]
  );

  const snapshot = realtime.roomStates[roomId];
  const room = snapshot?.room ?? fallbackRoom;
  const defaultBattleshipState = useMemo<BattleshipState>(
    () => ({
      ...createBattleshipState({
        boardSize: 10
      }),
      placementsSubmitted: {
        black: false,
        white: false
      }
    }),
    []
  );

  const gomokuState =
    snapshot?.gameType === 'gomoku' ? (snapshot.state as GomokuState) : createGomokuState(15);
  const santoriniState =
    snapshot?.gameType === 'santorini'
      ? (snapshot.state as SantoriniState)
      : createSantoriniState({ boardSize: 5 });
  const onitamaState =
    snapshot?.gameType === 'onitama'
      ? (snapshot.state as OnitamaState | null)
      : createOnitamaState({
          openingCards: ['tiger', 'dragon', 'frog', 'rabbit', 'crab']
        });
  const battleshipState =
    snapshot?.gameType === 'battleship' ? (snapshot.state as BattleshipState) : defaultBattleshipState;
  const yahtzeeState =
    snapshot?.gameType === 'yahtzee' ? (snapshot.state as YahtzeeState) : createYahtzeeState();
  const codenamesState =
    snapshot?.gameType === 'codenames_duet' ? (snapshot.state as CodenamesDuetState | null) : null;
  const connect4State =
    snapshot?.gameType === 'connect4' ? (snapshot.state as Connect4State) : createConnect4State();
  const goState = snapshot?.gameType === 'go' ? (snapshot.state as GoState) : createGoState(9);
  const hexState =
    snapshot?.gameType === 'hex'
      ? (snapshot.state as HexState)
      : createHexState({
          boardSize: 11
        });
  const liarsDiceState =
    snapshot?.gameType === 'liars_dice' ? (snapshot.state as LiarsDiceState | null) : null;
  const quoridorState =
    snapshot?.gameType === 'quoridor'
      ? (snapshot.state as QuoridorState)
      : createQuoridorState({
          boardSize: 9,
          wallsPerPlayer: 10
        });
  const reversiState =
    snapshot?.gameType === 'reversi' ? (snapshot.state as ReversiState) : createReversiState();
  const dotsState = snapshot?.gameType === 'dots' ? (snapshot.state as DotsState) : createDotsState();
  const xiangqiState =
    snapshot?.gameType === 'xiangqi' ? (snapshot.state as XiangqiState) : createXiangqiState();
  const cardsState = snapshot?.gameType === 'cards' ? (snapshot.state as CardsState | null) : null;
  const loveLetterState =
    snapshot?.gameType === 'love_letter' ? (snapshot.state as LoveLetterState | null) : null;

  const seat = useMemo(() => playerSeat(room, user.id), [room, user.id]);
  const viewerRole =
    snapshot?.viewerRole ?? room?.players.find((player) => player.userId === user.id)?.role ?? 'spectator';
  const activePlayerCount = room?.players.filter((player) => player.role === 'player').length ?? 0;
  const hasActiveMatch = room?.gameType !== 'single_2048' && room?.status === 'in_match';
  const waitingForOpponent = room?.gameType !== 'single_2048' && !hasActiveMatch && activePlayerCount < 2;

  const gomokuTurn =
    hasActiveMatch &&
    room?.gameType === 'gomoku' &&
    viewerRole === 'player' &&
    gomokuState.status === 'playing';
  const connect4Turn =
    hasActiveMatch &&
    room?.gameType === 'connect4' &&
    viewerRole === 'player' &&
    connect4State.status === 'playing';
  const santoriniTurn =
    hasActiveMatch &&
    room?.gameType === 'santorini' &&
    viewerRole === 'player' &&
    santoriniState.status !== 'completed';
  const onitamaTurn =
    hasActiveMatch &&
    room?.gameType === 'onitama' &&
    viewerRole === 'player' &&
    onitamaState?.status === 'playing';
  const battleshipTurn =
    hasActiveMatch &&
    room?.gameType === 'battleship' &&
    viewerRole === 'player' &&
    battleshipState.status === 'playing';
  const yahtzeeTurn =
    hasActiveMatch &&
    room?.gameType === 'yahtzee' &&
    viewerRole === 'player' &&
    yahtzeeState.status === 'playing';
  const codenamesTurn =
    hasActiveMatch &&
    room?.gameType === 'codenames_duet' &&
    viewerRole === 'player' &&
    codenamesState?.status === 'playing';
  const goTurn =
    hasActiveMatch && room?.gameType === 'go' && viewerRole === 'player' && goState.status === 'playing';
  const hexTurn =
    hasActiveMatch && room?.gameType === 'hex' && viewerRole === 'player' && hexState.status === 'playing';
  const liarsDiceTurn =
    hasActiveMatch &&
    room?.gameType === 'liars_dice' &&
    viewerRole === 'player' &&
    liarsDiceState?.status === 'playing';
  const quoridorTurn =
    hasActiveMatch &&
    room?.gameType === 'quoridor' &&
    viewerRole === 'player' &&
    quoridorState.status === 'playing';
  const reversiTurn =
    hasActiveMatch &&
    room?.gameType === 'reversi' &&
    viewerRole === 'player' &&
    reversiState.status === 'playing';
  const dotsTurn =
    hasActiveMatch && room?.gameType === 'dots' && viewerRole === 'player' && dotsState.status === 'playing';
  const xiangqiTurn =
    hasActiveMatch &&
    room?.gameType === 'xiangqi' &&
    viewerRole === 'player' &&
    xiangqiState.status === 'playing';
  const cardsTurn =
    hasActiveMatch &&
    room?.gameType === 'cards' &&
    viewerRole === 'player' &&
    cardsState?.status === 'playing';
  const loveLetterTurn =
    hasActiveMatch &&
    room?.gameType === 'love_letter' &&
    viewerRole === 'player' &&
    loveLetterState?.status === 'playing';

  const canPlayGomoku =
    gomokuTurn &&
    ((seat === 1 && gomokuState.nextPlayer === 'black') ||
      (seat === 2 && gomokuState.nextPlayer === 'white'));
  const canPlayConnect4 =
    connect4Turn &&
    ((seat === 1 && connect4State.nextPlayer === 'red') ||
      (seat === 2 && connect4State.nextPlayer === 'yellow'));
  const canPlaySantorini =
    santoriniTurn &&
    ((seat === 1 && santoriniState.nextPlayer === 'black') ||
      (seat === 2 && santoriniState.nextPlayer === 'white'));
  const canPlayOnitama =
    Boolean(onitamaTurn) &&
    ((seat === 1 && onitamaState?.nextPlayer === 'black') ||
      (seat === 2 && onitamaState?.nextPlayer === 'white'));
  const canPlayBattleship =
    battleshipTurn &&
    ((seat === 1 && battleshipState.nextPlayer === 'black') ||
      (seat === 2 && battleshipState.nextPlayer === 'white'));
  const canPlayYahtzee =
    yahtzeeTurn &&
    ((seat === 1 && yahtzeeState.nextPlayer === 'black') ||
      (seat === 2 && yahtzeeState.nextPlayer === 'white'));
  const codenamesSide = seat === 1 ? 'black' : seat === 2 ? 'white' : null;
  const canPlayCodenames =
    Boolean(codenamesTurn) &&
    Boolean(codenamesState) &&
    Boolean(codenamesSide) &&
    ((codenamesState?.phase === 'clue' && codenamesState.currentCluer === codenamesSide) ||
      (codenamesState?.phase === 'guess' && codenamesState.currentGuesser === codenamesSide));
  const canPlayGo =
    goTurn &&
    ((seat === 1 && goState.nextPlayer === 'black') || (seat === 2 && goState.nextPlayer === 'white'));
  const canPlayHex =
    hexTurn &&
    ((seat === 1 && hexState.nextPlayer === 'black') || (seat === 2 && hexState.nextPlayer === 'white'));
  const canPlayLiarsDice =
    Boolean(liarsDiceTurn) &&
    ((seat === 1 && liarsDiceState?.nextPlayer === 'black') ||
      (seat === 2 && liarsDiceState?.nextPlayer === 'white'));
  const canPlayQuoridor =
    quoridorTurn &&
    ((seat === 1 && quoridorState.nextPlayer === 'black') ||
      (seat === 2 && quoridorState.nextPlayer === 'white'));
  const canPlayReversi =
    reversiTurn &&
    ((seat === 1 && reversiState.nextPlayer === 'black') ||
      (seat === 2 && reversiState.nextPlayer === 'white'));
  const canPlayDots =
    dotsTurn &&
    ((seat === 1 && dotsState.nextPlayer === 'black') || (seat === 2 && dotsState.nextPlayer === 'white'));
  const canPlayXiangqi =
    xiangqiTurn &&
    ((seat === 1 && xiangqiState.nextPlayer === 'red') ||
      (seat === 2 && xiangqiState.nextPlayer === 'black'));
  const canPlayCards =
    Boolean(cardsTurn) &&
    ((seat === 1 && cardsState?.nextPlayer === 'black') ||
      (seat === 2 && cardsState?.nextPlayer === 'white'));
  const canPlayLoveLetter =
    Boolean(loveLetterTurn) &&
    ((seat === 1 && loveLetterState?.nextPlayer === 'black') ||
      (seat === 2 && loveLetterState?.nextPlayer === 'white'));
  const canPlayCurrentTurn =
    canPlayGomoku ||
    canPlaySantorini ||
    canPlayOnitama ||
    canPlayBattleship ||
    canPlayYahtzee ||
    canPlayCodenames ||
    canPlayConnect4 ||
    canPlayGo ||
    canPlayHex ||
    canPlayLiarsDice ||
    canPlayQuoridor ||
    canPlayReversi ||
    canPlayDots ||
    canPlayXiangqi ||
    canPlayCards ||
    canPlayLoveLetter;
  const loveLetterHand = loveLetterState?.hand ?? [];
  const loveLetterSelectedCard = loveLetterHand.includes(loveLetterCard)
    ? loveLetterCard
    : (loveLetterHand[0] ?? 'guard');
  const xiangqiPerspective: XiangqiColor = seat === 2 ? 'black' : 'red';
  const previousCanPlayRef = useRef(false);
  const battleshipSide = seat === 1 ? 'black' : seat === 2 ? 'white' : null;
  const battleshipMyShips = battleshipSide ? battleshipState.ships[battleshipSide] : null;
  const battleshipOpponent = battleshipSide ? (battleshipSide === 'black' ? 'white' : 'black') : null;
  const battleshipOutgoingShots = battleshipSide ? battleshipState.shots[battleshipSide] : null;
  const battleshipIncomingShots = battleshipOpponent ? battleshipState.shots[battleshipOpponent] : null;
  const yahtzeeSide = seat === 1 ? 'black' : seat === 2 ? 'white' : null;
  const yahtzeeAvailableCategories = yahtzeeSide
    ? YAHTZEE_CATEGORIES.filter((category) => typeof yahtzeeState.scores[yahtzeeSide][category] !== 'number')
    : YAHTZEE_CATEGORIES;
  const yahtzeeSelectedCategory = yahtzeeAvailableCategories.includes(yahtzeeCategory)
    ? yahtzeeCategory
    : (yahtzeeAvailableCategories[0] ?? 'chance');

  const latestMoveSummary = useMemo<LastMoveSummary | null>(() => {
    if (!room || room.gameType === 'single_2048') {
      return null;
    }

    if (!snapshot?.lastMove || snapshot.gameType !== room.gameType) {
      return null;
    }

    if (room.gameType === 'gomoku') {
      return describeLastMove('gomoku', snapshot.lastMove as GomokuMove);
    }

    if (room.gameType === 'connect4') {
      return describeLastMove('connect4', snapshot.lastMove as Connect4Move);
    }

    if (room.gameType === 'santorini') {
      return describeLastMove('santorini', snapshot.lastMove as SantoriniMove);
    }

    if (room.gameType === 'onitama') {
      return describeLastMove('onitama', snapshot.lastMove as OnitamaMove);
    }

    if (room.gameType === 'battleship') {
      return describeLastMove('battleship', snapshot.lastMove as BattleshipMove);
    }

    if (room.gameType === 'yahtzee') {
      return describeLastMove('yahtzee', snapshot.lastMove as YahtzeeMove);
    }

    if (room.gameType === 'codenames_duet') {
      return describeLastMove('codenames_duet', snapshot.lastMove as CodenamesDuetMove);
    }

    if (room.gameType === 'go') {
      return describeLastMove('go', snapshot.lastMove as GoMove);
    }

    if (room.gameType === 'reversi') {
      return describeLastMove('reversi', snapshot.lastMove as ReversiMove);
    }

    if (room.gameType === 'dots') {
      return describeLastMove('dots', snapshot.lastMove as DotsMove);
    }

    if (room.gameType === 'hex') {
      return describeLastMove('hex', snapshot.lastMove as HexMove);
    }

    if (room.gameType === 'liars_dice') {
      return null;
    }

    if (room.gameType === 'quoridor') {
      return describeLastMove('quoridor', snapshot.lastMove as QuoridorMove);
    }

    if (room.gameType === 'cards') {
      return null;
    }

    if (room.gameType === 'love_letter') {
      return describeLastMove('love_letter', snapshot.lastMove as LoveLetterMove);
    }

    return describeLastMove('xiangqi', snapshot.lastMove as XiangqiMove, xiangqiPerspective);
  }, [room, snapshot, xiangqiPerspective]);

  const latestMoveResult = useMemo(() => {
    if (!room || room.gameType === 'single_2048' || !latestMoveSummary) {
      return null;
    }

    if (room.gameType === 'gomoku') {
      return formatResultText(gomokuState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'connect4') {
      return formatResultText(connect4State, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'santorini') {
      if (santoriniState.status === 'setup') {
        return t('room.santorini.setup');
      }
      if (santoriniState.winner) {
        return t('room.result.winner', { winner: colorLabel(santoriniState.winner) });
      }
      return statusLabel('playing');
    }

    if (room.gameType === 'onitama') {
      return onitamaState ? formatResultText(onitamaState, statusLabel, colorLabel, t) : null;
    }

    if (room.gameType === 'battleship') {
      return formatResultText(battleshipState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'yahtzee') {
      return formatResultText(yahtzeeState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'codenames_duet') {
      if (!codenamesState) {
        return null;
      }
      if (codenamesState.status !== 'completed') {
        return statusLabel('playing');
      }
      if (codenamesState.outcome === 'success') {
        return t('room.codenames.outcome.success');
      }
      if (codenamesState.outcome === 'assassin') {
        return t('room.codenames.outcome.assassin');
      }
      return t('room.codenames.outcome.out_of_turns');
    }

    if (room.gameType === 'go') {
      return formatResultText(goState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'reversi') {
      return formatResultText(reversiState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'dots') {
      return formatResultText(dotsState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'hex') {
      return formatResultText(hexState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'liars_dice') {
      return null;
    }

    if (room.gameType === 'quoridor') {
      return formatResultText(quoridorState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'cards') {
      return null;
    }

    if (room.gameType === 'love_letter') {
      return loveLetterState ? formatResultText(loveLetterState, statusLabel, colorLabel, t) : null;
    }

    return formatResultText(xiangqiState, statusLabel, colorLabel, t);
  }, [
    room,
    latestMoveSummary,
    gomokuState,
    santoriniState,
    onitamaState,
    battleshipState,
    yahtzeeState,
    codenamesState,
    connect4State,
    goState,
    hexState,
    quoridorState,
    reversiState,
    dotsState,
    xiangqiState,
    loveLetterState,
    statusLabel,
    colorLabel,
    t
  ]);

  useEffect(() => {
    const justBecameCurrentTurn = didTurnSwitchToCurrent(previousCanPlayRef.current, canPlayCurrentTurn);
    previousCanPlayRef.current = canPlayCurrentTurn;

    if (!justBecameCurrentTurn) {
      return;
    }

    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return;
    }

    if (document.visibilityState !== 'hidden' || Notification.permission !== 'granted') {
      return;
    }

    const notice = new Notification(t('room.turn_alert.notification_title'), {
      body: t('room.turn_alert.notification_body')
    });
    const timer = window.setTimeout(() => {
      notice.close();
    }, 4_000);

    return () => {
      window.clearTimeout(timer);
      notice.close();
    };
  }, [canPlayCurrentTurn, t]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    let active = true;
    setError(null);
    setFallbackRoom(null);

    send({
      type: 'room.subscribe',
      payload: { roomId, asSpectator: watchMode }
    });

    api
      .getRoom(roomId)
      .then((result) => {
        if (!active) {
          return;
        }
        setFallbackRoom(result.room);
        if (watchMode) {
          api.joinRoom(roomId, true).catch(() => {
            // Spectator persistence is best effort.
          });
        }
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
      });

    return () => {
      active = false;
      send({
        type: 'room.unsubscribe',
        payload: { roomId }
      });
    };
  }, [api, loadAttempt, roomId, send, t, translateError, watchMode]);

  useEffect(() => {
    if (!realtime.lastError) {
      return;
    }

    const normalizedError = realtime.lastError.trim().toLowerCase();
    if (normalizedError.includes('no_active_match') && !hasActiveMatch) {
      realtime.clearLastError();
      return;
    }

    setError(translateError(realtime.lastError));
    realtime.clearLastError();
  }, [hasActiveMatch, realtime, translateError]);

  useEffect(() => {
    if (room?.gameType !== 'yahtzee') {
      return;
    }

    if (yahtzeeState.rollsUsed === 0) {
      setYahtzeeHold(DEFAULT_YAHTZEE_HOLD);
    }
  }, [room?.gameType, yahtzeeState.rollsUsed, yahtzeeState.moveCount]);

  const sendGomokuMove = (x: number, y: number) => {
    if (!canPlayGomoku) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'gomoku',
        x,
        y
      }
    });
  };

  const sendSantoriniMove = (move: SantoriniMoveInput) => {
    if (!canPlaySantorini) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'santorini',
        move
      }
    });
  };

  const sendOnitamaMove = (move: OnitamaMoveInput) => {
    if (!canPlayOnitama) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'onitama',
        move
      }
    });
  };

  const sendBattleshipMove = (move: BattleshipMoveInput) => {
    if (!canPlayBattleship) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'battleship',
        move
      }
    });
  };

  const sendYahtzeeMove = (move: YahtzeeMoveInput) => {
    if (!canPlayYahtzee) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'yahtzee',
        move
      }
    });
  };

  const sendCodenamesMove = (move: CodenamesDuetMoveInput) => {
    if (!canPlayCodenames) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'codenames_duet',
        move
      }
    });
  };

  const sendConnect4Move = (column: number) => {
    if (!canPlayConnect4) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'connect4',
        column
      }
    });
  };

  const sendGoMove = (move: GoMove) => {
    if (!canPlayGo) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'go',
        move
      }
    });
  };

  const sendHexMove = (x: number, y: number) => {
    if (!canPlayHex) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'hex',
        x,
        y
      }
    });
  };

  const sendQuoridorMove = (move: QuoridorMoveInput) => {
    if (!canPlayQuoridor) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'quoridor',
        move
      }
    });
  };

  const sendReversiMove = (x: number, y: number) => {
    if (!canPlayReversi) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'reversi',
        x,
        y
      }
    });
  };

  const sendDotsMove = (move: Pick<DotsMove, 'orientation' | 'x' | 'y'>) => {
    if (!canPlayDots) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'dots',
        move
      }
    });
  };

  const sendXiangqiMove = (move: XiangqiMove) => {
    if (!canPlayXiangqi) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'xiangqi',
        move
      }
    });
  };

  const sendCardsMove = (move: CardsMoveInput) => {
    if (!canPlayCards) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'cards',
        move
      }
    });
  };

  const sendLoveLetterMove = (move: LoveLetterMoveInput) => {
    if (!canPlayLoveLetter) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'love_letter',
        move
      }
    });
  };

  const sendLiarsDiceMove = (move: LiarsDiceMoveInput) => {
    if (!canPlayLiarsDice) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'liars_dice',
        move
      }
    });
  };

  const leaveCurrentRoom = async () => {
    try {
      send({
        type: 'room.unsubscribe',
        payload: { roomId }
      });
      await api.leaveRoom(roomId);
      navigate('/');
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
    }
  };

  if (!room) {
    return (
      <main className="panel">
        <p className={error ? 'error-text' : undefined}>{error ?? t('room.loading')}</p>
        {error ? (
          <div className="button-row">
            <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>
              {t('common.retry')}
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/')}>
              {t('shell.nav.lobby')}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="content-grid room-layout">
      <section className="panel">
        <h2>{t('room.title', { id: room.id.slice(0, 8) })}</h2>
        <p>
          {t('room.meta', {
            game: gameLabel(room.gameType),
            status: statusLabel(room.status),
            role: roleLabel(viewerRole)
          })}
        </p>

        <div className="button-row">
          <button type="button" className="secondary" onClick={leaveCurrentRoom}>
            {t('room.leave')}
          </button>
          {viewerRole !== 'spectator' ? null : (
            <button
              type="button"
              onClick={async () => {
                await api.joinRoom(room.id, false);
                send({ type: 'room.subscribe', payload: { roomId: room.id } });
              }}
            >
              {t('room.try_join_player')}
            </button>
          )}
        </div>

        <h3>
          {t('room.participants', {
            count: room.players.length,
            max: room.maxPlayers
          })}
        </h3>
        <ul className="simple-list">
          {room.players.map((player) => (
            <li key={player.id}>
              {roleLabel(player.role).toUpperCase()} {player.seat ? `Seat ${player.seat}` : ''}:{' '}
              {player.user.displayName} {player.userId === user.id ? '(You)' : ''}
              {player.userId === user.id ? null : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    api
                      .reportUser({
                        targetUserId: player.userId,
                        reason: 'in-room report'
                      })
                      .then(() => setError(t('lobby.report_submitted')))
                      .catch((err) =>
                        setError(
                          translateError(err instanceof Error ? err.message : t('common.error_generic'))
                        )
                      );
                  }}
                >
                  {t('common.report')}
                </button>
              )}
            </li>
          ))}
        </ul>

        <h3>{t('room.invite.title')}</h3>
        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api.createInvitation(room.id, inviteUserId.trim());
              setInviteUserId('');
              setError(null);
            } catch (err) {
              setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
            }
          }}
        >
          <input
            value={inviteUserId}
            onChange={(event) => setInviteUserId(event.target.value)}
            placeholder={t('room.invite.placeholder')}
          />
          <button type="submit">{t('room.invite.submit')}</button>
        </form>

        <h3>{t('room.invite_link.title')}</h3>
        <p>{t('room.invite_link.hint')}</p>
        <div className="button-row">
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await api.createInviteLink(room.id);
                setInviteLinkUrl(result.url);
                setInviteLinkNotice(null);
                setError(null);
              } catch (err) {
                setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
              }
            }}
          >
            {t('room.invite_link.generate')}
          </button>
          {inviteLinkUrl ? (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                try {
                  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                    setInviteLinkNotice(t('room.invite_link.copy_manual'));
                    return;
                  }
                  await navigator.clipboard.writeText(inviteLinkUrl);
                  setInviteLinkNotice(t('room.invite_link.copied'));
                } catch {
                  setInviteLinkNotice(t('room.invite_link.copy_manual'));
                }
              }}
            >
              {t('room.invite_link.copy')}
            </button>
          ) : null}
        </div>
        {inviteLinkUrl ? (
          <p>
            <code>{inviteLinkUrl}</code>
          </p>
        ) : null}
        {inviteLinkNotice ? <p>{inviteLinkNotice}</p> : null}

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>{t('room.game.title')}</h2>

        {waitingForOpponent ? (
          <p role="status" aria-live="polite">
            {t('room.waiting_for_opponent')}
          </p>
        ) : null}

        {room.gameType !== 'single_2048' && viewerRole === 'player' && hasActiveMatch ? (
          <div
            className={`room-turn-reminder ${canPlayCurrentTurn ? 'active' : ''}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {canPlayCurrentTurn ? t('room.turn_alert.your_turn') : t('room.turn_alert.waiting')}
            </strong>
            <span>
              {canPlayCurrentTurn ? t('room.turn_alert.your_turn_hint') : t('room.turn_alert.waiting_hint')}
            </span>
          </div>
        ) : null}

        {room.gameType !== 'single_2048' ? (
          <section className="room-last-move" aria-live="polite">
            <h3>{t('room.last_move.title')}</h3>
            {latestMoveSummary ? (
              <>
                <div className="room-last-move-grid">
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.player')}</span>
                    <strong className="room-last-move-value">{colorLabel(latestMoveSummary.actor)}</strong>
                  </p>
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.action')}</span>
                    <strong className="room-last-move-value">{formatActionText(latestMoveSummary, t)}</strong>
                  </p>
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.result')}</span>
                    <strong className="room-last-move-value">
                      {latestMoveResult ?? t('room.last_move.empty')}
                    </strong>
                  </p>
                </div>
                {room.gameType === 'xiangqi' && xiangqiPerspective === 'black' ? (
                  <p className="room-last-move-note">{t('room.last_move.black_perspective')}</p>
                ) : null}
              </>
            ) : (
              <p className="room-last-move-empty">{t('room.last_move.empty')}</p>
            )}
          </section>
        ) : null}

        {room.gameType === 'single_2048' ? (
          <p>
            {t('room.single_2048')}{' '}
            <button type="button" onClick={() => navigate('/game/2048')}>
              {t('room.open_2048')}
            </button>
            .
          </p>
        ) : null}

        {room.gameType === 'gomoku' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(gomokuState.nextPlayer),
                  status: statusLabel(gomokuState.status)
                })}
              </p>
            ) : null}
            <GomokuBoard state={gomokuState} disabled={!canPlayGomoku} onCellClick={sendGomokuMove} />
            {gomokuState.status === 'completed' || gomokuState.status === 'draw' ? (
              <p>
                {gomokuState.winner
                  ? t('room.result.winner', { winner: colorLabel(gomokuState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'santorini' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(santoriniState.nextPlayer),
                  status:
                    santoriniState.status === 'setup' ? t('room.santorini.setup') : statusLabel('playing')
                })}
              </p>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${santoriniState.boardSize}, minmax(2.3rem, 1fr))`,
                gap: '0.3rem',
                maxWidth: '24rem'
              }}
            >
              {santoriniState.levels.flatMap((row, y) =>
                row.map((level, x) => (
                  <div
                    key={`santorini-${x}-${y}`}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.35rem',
                      textAlign: 'center',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div>L{level}</div>
                    <div>{santoriniWorkerAt(santoriniState, x, y) ?? '·'}</div>
                  </div>
                ))
              )}
            </div>

            <div className="button-row">
              <label>
                Worker{' '}
                <select
                  value={santoriniWorker}
                  onChange={(event) => setSantoriniWorker(event.target.value as 'a' | 'b')}
                  disabled={!canPlaySantorini}
                >
                  <option value="a">A</option>
                  <option value="b">B</option>
                </select>
              </label>
            </div>

            {santoriniState.status === 'setup' ? (
              <div className="button-row">
                <label>
                  X{' '}
                  <input
                    type="number"
                    min={0}
                    max={santoriniState.boardSize - 1}
                    value={santoriniMoveX}
                    onChange={(event) => setSantoriniMoveX(Number(event.target.value) || 0)}
                    disabled={!canPlaySantorini}
                  />
                </label>
                <label>
                  Y{' '}
                  <input
                    type="number"
                    min={0}
                    max={santoriniState.boardSize - 1}
                    value={santoriniMoveY}
                    onChange={(event) => setSantoriniMoveY(Number(event.target.value) || 0)}
                    disabled={!canPlaySantorini}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    sendSantoriniMove({
                      type: 'place',
                      worker: santoriniWorker,
                      x: santoriniMoveX,
                      y: santoriniMoveY
                    })
                  }
                  disabled={!canPlaySantorini}
                >
                  {t('room.santorini.place')}
                </button>
              </div>
            ) : null}

            {santoriniState.status === 'playing' ? (
              <>
                <div className="button-row">
                  <label>
                    To X{' '}
                    <input
                      type="number"
                      min={0}
                      max={santoriniState.boardSize - 1}
                      value={santoriniMoveX}
                      onChange={(event) => setSantoriniMoveX(Number(event.target.value) || 0)}
                      disabled={!canPlaySantorini}
                    />
                  </label>
                  <label>
                    To Y{' '}
                    <input
                      type="number"
                      min={0}
                      max={santoriniState.boardSize - 1}
                      value={santoriniMoveY}
                      onChange={(event) => setSantoriniMoveY(Number(event.target.value) || 0)}
                      disabled={!canPlaySantorini}
                    />
                  </label>
                </div>
                <div className="button-row">
                  <label>
                    Build X{' '}
                    <input
                      type="number"
                      min={0}
                      max={santoriniState.boardSize - 1}
                      value={santoriniBuildX}
                      onChange={(event) => setSantoriniBuildX(Number(event.target.value) || 0)}
                      disabled={!canPlaySantorini}
                    />
                  </label>
                  <label>
                    Build Y{' '}
                    <input
                      type="number"
                      min={0}
                      max={santoriniState.boardSize - 1}
                      value={santoriniBuildY}
                      onChange={(event) => setSantoriniBuildY(Number(event.target.value) || 0)}
                      disabled={!canPlaySantorini}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      sendSantoriniMove({
                        type: 'turn',
                        worker: santoriniWorker,
                        to: {
                          x: santoriniMoveX,
                          y: santoriniMoveY
                        },
                        build: {
                          x: santoriniBuildX,
                          y: santoriniBuildY
                        }
                      })
                    }
                    disabled={!canPlaySantorini}
                  >
                    {t('room.santorini.move_build')}
                  </button>
                </div>
              </>
            ) : null}

            {santoriniState.status === 'completed' ? (
              <p>
                {santoriniState.winner
                  ? t('room.result.winner', { winner: colorLabel(santoriniState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'onitama' ? (
          <>
            {!onitamaState ? (
              <p>{t('room.onitama.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(onitamaState.nextPlayer),
                      status: statusLabel(onitamaState.status)
                    })}
                  </p>
                ) : null}
                <p>
                  Black: {onitamaState.cards.black.join(', ')} | White: {onitamaState.cards.white.join(', ')}{' '}
                  | Side: {onitamaState.cards.side}
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${onitamaState.boardSize}, minmax(2.3rem, 1fr))`,
                    gap: '0.3rem',
                    maxWidth: '24rem'
                  }}
                >
                  {onitamaState.board.flatMap((row, y) =>
                    row.map((_, x) => (
                      <div
                        key={`onitama-${x}-${y}`}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0.4rem',
                          textAlign: 'center',
                          fontSize: '0.82rem'
                        }}
                      >
                        {onitamaPieceAt(onitamaState, x, y) ?? '·'}
                      </div>
                    ))
                  )}
                </div>
                <div className="button-row">
                  <label>
                    Card{' '}
                    <select
                      value={onitamaCard}
                      onChange={(event) => setOnitamaCard(event.target.value as OnitamaMoveInput['card'])}
                      disabled={!canPlayOnitama}
                    >
                      {(seat === 1 ? onitamaState.cards.black : onitamaState.cards.white).map((card) => (
                        <option key={card} value={card}>
                          {card}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="button-row">
                  <label>
                    From X{' '}
                    <input
                      type="number"
                      min={0}
                      max={4}
                      value={onitamaFromX}
                      onChange={(event) => setOnitamaFromX(Number(event.target.value) || 0)}
                      disabled={!canPlayOnitama}
                    />
                  </label>
                  <label>
                    From Y{' '}
                    <input
                      type="number"
                      min={0}
                      max={4}
                      value={onitamaFromY}
                      onChange={(event) => setOnitamaFromY(Number(event.target.value) || 0)}
                      disabled={!canPlayOnitama}
                    />
                  </label>
                </div>
                <div className="button-row">
                  <label>
                    To X{' '}
                    <input
                      type="number"
                      min={0}
                      max={4}
                      value={onitamaToX}
                      onChange={(event) => setOnitamaToX(Number(event.target.value) || 0)}
                      disabled={!canPlayOnitama}
                    />
                  </label>
                  <label>
                    To Y{' '}
                    <input
                      type="number"
                      min={0}
                      max={4}
                      value={onitamaToY}
                      onChange={(event) => setOnitamaToY(Number(event.target.value) || 0)}
                      disabled={!canPlayOnitama}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      sendOnitamaMove({
                        from: { x: onitamaFromX, y: onitamaFromY },
                        to: { x: onitamaToX, y: onitamaToY },
                        card: onitamaCard
                      })
                    }
                    disabled={!canPlayOnitama}
                  >
                    {t('room.onitama.move')}
                  </button>
                </div>
                {onitamaState.status === 'completed' ? (
                  <p>
                    {onitamaState.winner
                      ? t('room.result.winner', { winner: colorLabel(onitamaState.winner) })
                      : t('room.result.draw')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'battleship' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(battleshipState.nextPlayer),
                  status: statusLabel(battleshipState.status)
                })}
              </p>
            ) : null}
            <p>
              {t('room.battleship.placement_status', {
                black: battleshipState.placementsSubmitted.black ? '✓' : '…',
                white: battleshipState.placementsSubmitted.white ? '✓' : '…'
              })}
            </p>

            {viewerRole === 'player' &&
            battleshipSide &&
            !battleshipState.placementsSubmitted[battleshipSide] ? (
              <div className="card">
                <div className="simple-list">
                  {battleshipFleet.map((ship, index) => (
                    <div key={`fleet-${ship.length}-${index}`} className="button-row">
                      <strong>L{ship.length}</strong>
                      <label>
                        X{' '}
                        <input
                          type="number"
                          min={0}
                          max={battleshipState.boardSize - 1}
                          value={ship.x}
                          onChange={(event) =>
                            setBattleshipFleet((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      x: Math.max(0, Number(event.target.value) || 0)
                                    }
                                  : entry
                              )
                            )
                          }
                          disabled={!canPlayBattleship}
                        />
                      </label>
                      <label>
                        Y{' '}
                        <input
                          type="number"
                          min={0}
                          max={battleshipState.boardSize - 1}
                          value={ship.y}
                          onChange={(event) =>
                            setBattleshipFleet((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      y: Math.max(0, Number(event.target.value) || 0)
                                    }
                                  : entry
                              )
                            )
                          }
                          disabled={!canPlayBattleship}
                        />
                      </label>
                      <label>
                        Dir{' '}
                        <select
                          value={ship.orientation}
                          onChange={(event) =>
                            setBattleshipFleet((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      orientation: event.target
                                        .value as BattleshipShipPlacement['orientation']
                                    }
                                  : entry
                              )
                            )
                          }
                          disabled={!canPlayBattleship}
                        >
                          <option value="h">h</option>
                          <option value="v">v</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() =>
                      sendBattleshipMove({
                        type: 'place_fleet',
                        ships: battleshipFleet
                      })
                    }
                    disabled={!canPlayBattleship}
                  >
                    {t('room.battleship.place_fleet')}
                  </button>
                </div>
              </div>
            ) : null}

            {battleshipOutgoingShots ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${battleshipState.boardSize}, minmax(1.8rem, 1fr))`,
                  gap: '0.2rem',
                  maxWidth: '26rem'
                }}
              >
                {battleshipOutgoingShots.flatMap((row, y) =>
                  row.map((cell, x) => (
                    <button
                      key={`battleship-shot-${x}-${y}`}
                      type="button"
                      className="secondary"
                      disabled={
                        !canPlayBattleship || battleshipState.phase !== 'playing' || cell !== 'unknown'
                      }
                      onClick={() =>
                        sendBattleshipMove({
                          type: 'fire',
                          x,
                          y
                        })
                      }
                      style={{ minHeight: '1.9rem', padding: '0.1rem' }}
                    >
                      {cell === 'hit' ? 'X' : cell === 'miss' ? 'o' : '·'}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {battleshipMyShips && battleshipIncomingShots ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${battleshipState.boardSize}, minmax(1.8rem, 1fr))`,
                  gap: '0.2rem',
                  maxWidth: '26rem',
                  marginTop: '0.6rem'
                }}
              >
                {battleshipIncomingShots.flatMap((row, y) =>
                  row.map((shot, x) => {
                    const ship = battleshipShipAt(battleshipMyShips, x, y);
                    const marker = shot === 'hit' ? 'X' : ship ? 'S' : shot === 'miss' ? 'o' : '·';

                    return (
                      <div
                        key={`battleship-own-${x}-${y}`}
                        style={{
                          minHeight: '1.9rem',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          textAlign: 'center',
                          lineHeight: '1.9rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        {marker}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <p>{t('room.battleship.hidden_enemy_ships')}</p>
            )}

            <div className="button-row">
              <label>
                X{' '}
                <input
                  type="number"
                  min={0}
                  max={battleshipState.boardSize - 1}
                  value={battleshipShotX}
                  onChange={(event) => setBattleshipShotX(Math.max(0, Number(event.target.value) || 0))}
                  disabled={!canPlayBattleship || battleshipState.phase !== 'playing'}
                />
              </label>
              <label>
                Y{' '}
                <input
                  type="number"
                  min={0}
                  max={battleshipState.boardSize - 1}
                  value={battleshipShotY}
                  onChange={(event) => setBattleshipShotY(Math.max(0, Number(event.target.value) || 0))}
                  disabled={!canPlayBattleship || battleshipState.phase !== 'playing'}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  sendBattleshipMove({
                    type: 'fire',
                    x: battleshipShotX,
                    y: battleshipShotY
                  })
                }
                disabled={!canPlayBattleship || battleshipState.phase !== 'playing'}
              >
                {t('room.battleship.fire')}
              </button>
            </div>

            {battleshipState.status === 'completed' ? (
              <p>
                {battleshipState.winner
                  ? t('room.result.winner', { winner: colorLabel(battleshipState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'yahtzee' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(yahtzeeState.nextPlayer),
                  status: statusLabel(yahtzeeState.status)
                })}
              </p>
            ) : null}
            <p>{t('room.yahtzee.rolls_used', { count: yahtzeeState.rollsUsed })}</p>
            <p>
              {t('room.yahtzee.totals', {
                black: yahtzeeState.totals.black,
                white: yahtzeeState.totals.white
              })}
            </p>
            <p>
              {t('enum.color.black')}: {yahtzeeState.completedCategories.black}/13 | {t('enum.color.white')}:{' '}
              {yahtzeeState.completedCategories.white}/13
            </p>

            <div className="button-row">
              {yahtzeeState.dice.map((die, index) => (
                <button
                  key={`yahtzee-die-${index}`}
                  type="button"
                  className={yahtzeeHold[index] ? '' : 'secondary'}
                  onClick={() =>
                    setYahtzeeHold((current) =>
                      current.map((held, heldIndex) => (heldIndex === index ? !held : held))
                    )
                  }
                  disabled={!canPlayYahtzee || yahtzeeState.rollsUsed === 0 || yahtzeeState.rollsUsed >= 3}
                >
                  {die}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button
                type="button"
                onClick={() =>
                  sendYahtzeeMove({
                    type: 'roll',
                    hold: yahtzeeState.rollsUsed > 0 ? yahtzeeHold : undefined
                  })
                }
                disabled={!canPlayYahtzee || yahtzeeState.rollsUsed >= 3}
              >
                {t('room.yahtzee.roll')}
              </button>
              <label>
                {t('room.yahtzee.category')}{' '}
                <select
                  value={yahtzeeSelectedCategory}
                  onChange={(event) => setYahtzeeCategory(event.target.value as YahtzeeCategory)}
                  disabled={!canPlayYahtzee || yahtzeeAvailableCategories.length === 0}
                >
                  {YAHTZEE_CATEGORIES.map((category) => (
                    <option key={`yahtzee-category-${category}`} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  sendYahtzeeMove({
                    type: 'score',
                    category: yahtzeeSelectedCategory
                  })
                }
                disabled={
                  !canPlayYahtzee || yahtzeeState.rollsUsed === 0 || yahtzeeAvailableCategories.length === 0
                }
              >
                {t('room.yahtzee.score')}
              </button>
            </div>

            {yahtzeeState.status === 'completed' ? (
              <p>
                {yahtzeeState.winner
                  ? t('room.result.winner', { winner: colorLabel(yahtzeeState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'codenames_duet' ? (
          <>
            {!codenamesState ? (
              <p>{t('room.codenames.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(
                        codenamesState.phase === 'clue'
                          ? codenamesState.currentCluer
                          : codenamesState.currentGuesser
                      ),
                      status: statusLabel(codenamesState.status)
                    })}
                  </p>
                ) : null}
                <p>{t('room.codenames.turns_remaining', { turns: codenamesState.turnsRemaining })}</p>
                <p>
                  {t('room.codenames.targets', {
                    found: codenamesState.targetCounts.found,
                    total: codenamesState.targetCounts.total
                  })}
                </p>
                <p>
                  {codenamesState.phase === 'clue'
                    ? t('room.codenames.phase_clue')
                    : t('room.codenames.phase_guess')}
                </p>
                {codenamesState.activeClue ? (
                  <p>
                    {codenamesState.activeClue.word} ({codenamesState.activeClue.count})
                  </p>
                ) : null}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, minmax(4.5rem, 1fr))',
                    gap: '0.35rem'
                  }}
                >
                  {codenamesState.words.map((word, index) => {
                    const revealedRole = codenamesState.revealedRoles[index];
                    const keyRole = codenamesState.key?.[index] ?? null;
                    const keyMark =
                      keyRole === 'agent'
                        ? 'A'
                        : keyRole === 'assassin'
                          ? 'X'
                          : keyRole === 'neutral'
                            ? 'N'
                            : '';
                    const revealedMark =
                      revealedRole === 'agent'
                        ? 'AGENT'
                        : revealedRole === 'assassin'
                          ? 'ASSASSIN'
                          : revealedRole === 'neutral'
                            ? 'NEUTRAL'
                            : '';
                    const canGuessCell =
                      canPlayCodenames &&
                      codenamesState.phase === 'guess' &&
                      !codenamesState.revealed[index] &&
                      codenamesState.status === 'playing';

                    return (
                      <button
                        key={`codenames-${index}-${word}`}
                        type="button"
                        className="secondary"
                        disabled={!canGuessCell}
                        onClick={() => sendCodenamesMove({ type: 'guess', index })}
                        style={{
                          minHeight: '4rem',
                          textAlign: 'left',
                          lineHeight: 1.25
                        }}
                      >
                        <strong>{word}</strong>
                        <br />
                        <small>{revealedMark || keyMark || ' '}</small>
                      </button>
                    );
                  })}
                </div>

                {canPlayCodenames && codenamesState.phase === 'clue' ? (
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
                      onClick={() =>
                        sendCodenamesMove({
                          type: 'clue',
                          word: codenamesClueWord,
                          count: codenamesClueCount
                        })
                      }
                    >
                      {t('room.codenames.submit_clue')}
                    </button>
                  </div>
                ) : null}

                {canPlayCodenames && codenamesState.phase === 'guess' ? (
                  <div className="button-row">
                    <label>
                      Index{' '}
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={codenamesGuessIndex}
                        onChange={(event) =>
                          setCodenamesGuessIndex(Math.max(0, Number(event.target.value) || 0))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => sendCodenamesMove({ type: 'guess', index: codenamesGuessIndex })}
                    >
                      {t('room.codenames.submit_guess')}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => sendCodenamesMove({ type: 'end_guesses' })}
                    >
                      {t('room.codenames.end_guesses')}
                    </button>
                  </div>
                ) : null}

                {codenamesState.status === 'completed' ? (
                  <p>
                    {codenamesState.outcome === 'success'
                      ? t('room.codenames.outcome.success')
                      : codenamesState.outcome === 'assassin'
                        ? t('room.codenames.outcome.assassin')
                        : t('room.codenames.outcome.out_of_turns')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'connect4' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(connect4State.nextPlayer),
                  status: statusLabel(connect4State.status)
                })}
              </p>
            ) : null}
            <Connect4Board
              state={connect4State}
              disabled={!canPlayConnect4}
              onColumnClick={sendConnect4Move}
            />
            {connect4State.status === 'completed' || connect4State.status === 'draw' ? (
              <p>
                {connect4State.winner
                  ? t('room.result.winner', { winner: colorLabel(connect4State.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'go' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(goState.nextPlayer),
                  status: statusLabel(goState.status)
                })}
              </p>
            ) : null}
            <GoBoard
              state={goState}
              disabled={!canPlayGo}
              onCellClick={(x, y) => sendGoMove({ type: 'place', x, y, player: 'black' })}
            />
            <div className="button-row">
              <button
                type="button"
                onClick={() => sendGoMove({ type: 'pass', player: 'black' })}
                disabled={!canPlayGo}
              >
                {t('room.pass')}
              </button>
            </div>
            {goState.scoring ? (
              <p>
                {t('room.go.scoring', {
                  black: goState.scoring.black.total,
                  white: goState.scoring.white.total,
                  komi: goState.scoring.komi,
                  winner: goState.scoring.winner ? colorLabel(goState.scoring.winner) : t('room.result.draw')
                })}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'hex' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(hexState.nextPlayer),
                  status: statusLabel(hexState.status)
                })}
              </p>
            ) : null}
            <HexBoard state={hexState} disabled={!canPlayHex} onCellClick={sendHexMove} />
            {hexState.status === 'completed' ? (
              <p>
                {hexState.winner
                  ? t('room.result.winner', { winner: colorLabel(hexState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'liars_dice' ? (
          <>
            {!liarsDiceState ? (
              <p>{t('room.liars.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(liarsDiceState.nextPlayer),
                      status: statusLabel(liarsDiceState.status)
                    })}
                  </p>
                ) : null}
                <p>
                  {t('room.liars.dice_counts', {
                    black: liarsDiceState.diceCounts.black,
                    white: liarsDiceState.diceCounts.white
                  })}
                </p>
                {liarsDiceState.viewerDice ? (
                  <p>{t('room.liars.your_dice', { dice: liarsDiceState.viewerDice.join(', ') })}</p>
                ) : (
                  <p>{t('room.liars.hidden_dice')}</p>
                )}
                {liarsDiceState.currentBid ? (
                  <p>
                    {t('room.liars.current_bid', {
                      quantity: liarsDiceState.currentBid.quantity,
                      face: liarsDiceState.currentBid.face
                    })}
                  </p>
                ) : (
                  <p>{t('room.liars.no_bid')}</p>
                )}
                <p>
                  {t('room.liars.bid_history', {
                    chain:
                      liarsDiceState.bidHistory.length > 0
                        ? liarsDiceState.bidHistory
                            .map((bid) => `${colorLabel(bid.player)}:${bid.quantity}x${bid.face}`)
                            .join(' -> ')
                        : '—'
                  })}
                </p>
                {liarsDiceState.lastRound ? (
                  <p>
                    {t('room.liars.last_round', {
                      quantity: liarsDiceState.lastRound.calledBid.quantity,
                      face: liarsDiceState.lastRound.calledBid.face,
                      total: liarsDiceState.lastRound.totalMatching,
                      loser: colorLabel(liarsDiceState.lastRound.loser)
                    })}
                  </p>
                ) : null}
                <div className="button-row">
                  <label>
                    {t('room.liars.bid_input')}{' '}
                    <input
                      type="number"
                      min={1}
                      value={liarsBidQuantity}
                      onChange={(event) => setLiarsBidQuantity(Math.max(1, Number(event.target.value) || 1))}
                      disabled={!canPlayLiarsDice}
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
                      disabled={!canPlayLiarsDice}
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() =>
                      sendLiarsDiceMove({
                        type: 'bid',
                        quantity: liarsBidQuantity,
                        face: liarsBidFace
                      })
                    }
                    disabled={!canPlayLiarsDice}
                  >
                    {t('room.liars.bid_submit')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      sendLiarsDiceMove({
                        type: 'call_liar'
                      })
                    }
                    disabled={!canPlayLiarsDice || !liarsDiceState.currentBid}
                  >
                    {t('room.liars.call_liar')}
                  </button>
                </div>
                {liarsDiceState.status === 'completed' ? (
                  <p>
                    {liarsDiceState.winner
                      ? t('room.result.winner', { winner: colorLabel(liarsDiceState.winner) })
                      : t('room.result.draw')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'quoridor' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(quoridorState.nextPlayer),
                  status: statusLabel(quoridorState.status)
                })}
              </p>
            ) : null}
            <p>
              {t('room.quoridor.walls_remaining', {
                black: quoridorState.remainingWalls.black,
                white: quoridorState.remainingWalls.white
              })}
            </p>
            <QuoridorBoard
              state={quoridorState}
              disabled={!canPlayQuoridor}
              onPawnMove={(x, y) =>
                sendQuoridorMove({
                  type: 'pawn',
                  x,
                  y
                })
              }
              onWallPlace={(orientation, x, y) =>
                sendQuoridorMove({
                  type: 'wall',
                  orientation,
                  x,
                  y
                })
              }
            />
            {quoridorState.status === 'completed' ? (
              <p>
                {quoridorState.winner
                  ? t('room.result.winner', { winner: colorLabel(quoridorState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'reversi' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(reversiState.nextPlayer),
                  status: statusLabel(reversiState.status)
                })}
              </p>
            ) : null}
            <ReversiBoard
              state={reversiState}
              disabled={!canPlayReversi}
              onCellClick={(x, y) => sendReversiMove(x, y)}
            />
            <p>
              {t('room.reversi.counts', {
                black: reversiState.counts.black,
                white: reversiState.counts.white
              })}
            </p>
            {reversiState.status === 'completed' || reversiState.status === 'draw' ? (
              <p>
                {reversiState.winner
                  ? t('room.result.winner', { winner: colorLabel(reversiState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'dots' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(dotsState.nextPlayer),
                  status: statusLabel(dotsState.status)
                })}
              </p>
            ) : null}
            <DotsBoard state={dotsState} disabled={!canPlayDots} onLineClick={(move) => sendDotsMove(move)} />
            <p>
              {t('room.dots.scores', {
                black: dotsState.scores.black,
                white: dotsState.scores.white
              })}
            </p>
            {dotsState.status === 'completed' || dotsState.status === 'draw' ? (
              <p>
                {dotsState.winner
                  ? t('room.result.winner', { winner: colorLabel(dotsState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'cards' ? (
          <>
            {!cardsState ? (
              <p>{t('room.cards.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(cardsState.nextPlayer),
                      status: statusLabel(cardsState.status)
                    })}
                  </p>
                ) : null}
                <p>{t('room.cards.top', { card: formatCardsCard(cardsState.topCard) })}</p>
                <p>{t('room.cards.active_suit', { suit: suitLabel(cardsState.activeSuit) })}</p>
                <p>
                  {t('room.cards.hand_counts', {
                    black: cardsState.handCounts.black,
                    white: cardsState.handCounts.white
                  })}
                </p>
                {typeof cardsState.drawPileCount === 'number' ? (
                  <p>{t('room.cards.draw_pile', { count: cardsState.drawPileCount })}</p>
                ) : null}
                <p>{t('room.cards.discard_pile', { count: cardsState.discardPileCount })}</p>

                {cardsState.hand ? (
                  <>
                    <p>{t('room.cards.your_hand')}</p>
                    <div className="button-row">
                      {cardsState.hand.map((card, index) => {
                        const playable =
                          card.rank === '8' ||
                          card.suit === cardsState.activeSuit ||
                          card.rank === cardsState.topCard.rank;
                        return (
                          <button
                            key={`${card.suit}-${card.rank}-${index}`}
                            type="button"
                            className="secondary"
                            disabled={!canPlayCards || !playable}
                            onClick={() => {
                              if (card.rank === '8') {
                                const picked = window.prompt(
                                  'suit: clubs | diamonds | hearts | spades',
                                  cardsState.activeSuit
                                );
                                if (!picked) {
                                  return;
                                }
                                const normalized = picked.trim().toLowerCase() as CardsCard['suit'];
                                if (!CARD_SUITS.includes(normalized)) {
                                  setError(t('error.invalid_move'));
                                  return;
                                }
                                sendCardsMove({
                                  type: 'play',
                                  card,
                                  chosenSuit: normalized
                                });
                                return;
                              }

                              sendCardsMove({
                                type: 'play',
                                card
                              });
                            }}
                          >
                            {formatCardsCard(card)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p>{t('room.cards.hidden_hand')}</p>
                )}

                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => sendCardsMove({ type: 'draw' })}
                    disabled={!canPlayCards}
                  >
                    {t('room.cards.draw')}
                  </button>
                  {cardsState.pendingDrawPlay ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => sendCardsMove({ type: 'end_turn' })}
                      disabled={!canPlayCards}
                    >
                      {t('room.cards.end_turn')}
                    </button>
                  ) : null}
                </div>
                {cardsState.pendingDrawPlay && canPlayCards ? (
                  <p>{t('room.cards.pending_draw_play')}</p>
                ) : null}
                {cardsState.status === 'completed' ? (
                  <p>
                    {cardsState.winner
                      ? t('room.result.winner', { winner: colorLabel(cardsState.winner) })
                      : t('room.result.draw')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'love_letter' ? (
          <>
            {!loveLetterState ? (
              <p>{t('room.love_letter.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(loveLetterState.nextPlayer),
                      status: statusLabel(loveLetterState.status)
                    })}
                  </p>
                ) : null}
                <p>{t('room.love_letter.draw_pile', { count: loveLetterState.drawPileCount })}</p>
                <p>
                  {t('room.love_letter.hand_counts', {
                    black: loveLetterState.handCounts.black,
                    white: loveLetterState.handCounts.white
                  })}
                </p>
                {loveLetterState.hand ? (
                  <p>{t('room.love_letter.your_hand', { cards: loveLetterState.hand.join(', ') })}</p>
                ) : (
                  <p>{t('room.love_letter.hidden_hand')}</p>
                )}

                {loveLetterState.hand ? (
                  <div className="button-row">
                    <label>
                      Card{' '}
                      <select
                        value={loveLetterCard}
                        onChange={(event) =>
                          setLoveLetterCard(event.target.value as LoveLetterMoveInput['card'])
                        }
                        disabled={!canPlayLoveLetter}
                      >
                        {loveLetterHand.map((card, index) => (
                          <option key={`love-letter-card-${card}-${index}`} value={card}>
                            {card}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Target{' '}
                      <select
                        value={loveLetterTarget}
                        onChange={(event) =>
                          setLoveLetterTarget(event.target.value as LoveLetterMoveInput['target'])
                        }
                        disabled={!canPlayLoveLetter}
                      >
                        <option value="black">black</option>
                        <option value="white">white</option>
                      </select>
                    </label>
                    <label>
                      Guess{' '}
                      <select
                        value={loveLetterGuess}
                        onChange={(event) =>
                          setLoveLetterGuess(event.target.value as LoveLetterMoveInput['guess'])
                        }
                        disabled={!canPlayLoveLetter}
                      >
                        <option value="priest">priest</option>
                        <option value="baron">baron</option>
                        <option value="handmaid">handmaid</option>
                        <option value="prince">prince</option>
                        <option value="king">king</option>
                        <option value="countess">countess</option>
                        <option value="princess">princess</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        sendLoveLetterMove({
                          type: 'play',
                          card: loveLetterSelectedCard,
                          target: loveLetterTarget,
                          guess: loveLetterSelectedCard === 'guard' ? loveLetterGuess : undefined
                        })
                      }
                      disabled={!canPlayLoveLetter || loveLetterHand.length === 0}
                    >
                      {t('room.love_letter.play')}
                    </button>
                  </div>
                ) : null}

                {loveLetterState.status === 'completed' ? (
                  <p>
                    {loveLetterState.winner
                      ? t('room.result.winner', { winner: colorLabel(loveLetterState.winner) })
                      : t('room.result.draw')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'xiangqi' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(xiangqiState.nextPlayer),
                  status: statusLabel(xiangqiState.status)
                })}
              </p>
            ) : null}
            <XiangqiBoard
              state={xiangqiState}
              selected={xiangqiSelection}
              disabled={!canPlayXiangqi}
              onCellClick={(x, y) => {
                const piece = xiangqiState.board[y][x];

                if (!xiangqiSelection) {
                  if (!piece) {
                    return;
                  }

                  const mine =
                    (seat === 1 && piece.color === 'red') || (seat === 2 && piece.color === 'black');
                  if (!mine) {
                    return;
                  }

                  setXiangqiSelection({ x, y });
                  return;
                }

                sendXiangqiMove({
                  from: xiangqiSelection,
                  to: { x, y },
                  player: seat === 1 ? 'red' : 'black'
                });
                setXiangqiSelection(null);
              }}
            />
            {xiangqiState.status === 'completed' ? (
              <p>
                {xiangqiState.winner
                  ? t('room.result.winner', { winner: colorLabel(xiangqiState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

export type GameType =
  | 'single_2048'
  | 'gomoku'
  | 'santorini'
  | 'onitama'
  | 'battleship'
  | 'love_letter'
  | 'codenames_duet'
  | 'xiangqi'
  | 'go'
  | 'connect4'
  | 'reversi'
  | 'dots'
  | 'backgammon'
  | 'cards'
  | 'quoridor'
  | 'hex'
  | 'liars_dice';
export type BoardGameType =
  | 'gomoku'
  | 'santorini'
  | 'onitama'
  | 'battleship'
  | 'love_letter'
  | 'codenames_duet'
  | 'xiangqi'
  | 'go'
  | 'connect4'
  | 'reversi'
  | 'dots'
  | 'backgammon'
  | 'cards'
  | 'quoridor'
  | 'hex'
  | 'liars_dice';

export interface UserDTO {
  id: string;
  displayName: string;
  isGuest: boolean;
  isAdmin: boolean;
  rating: number;
  ratings: Partial<Record<GameType, number>>;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type RoomPlayerRole = 'player' | 'spectator';

export interface RoomPlayerDTO {
  id: string;
  roomId: string;
  userId: string;
  role: RoomPlayerRole;
  seat: number | null;
  joinedAt: string;
  leftAt: string | null;
  user: UserDTO;
}

export interface RoomDTO {
  id: string;
  hostUserId: string;
  gameType: GameType;
  status: 'open' | 'in_match' | 'closed';
  maxPlayers: number;
  createdAt: string;
  players: RoomPlayerDTO[];
}

export interface InvitationDTO {
  id: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  respondedAt: string | null;
}

export interface InviteLinkDTO {
  id: string;
  roomId: string;
  token: string;
  createdByUserId: string | null;
  matchId: string | null;
  createdAt: string;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
}

export interface MatchMoveDTO {
  id: string;
  matchId: string;
  moveIndex: number;
  actorUserId: string;
  moveType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MatchDTO {
  id: string;
  roomId: string;
  gameType: GameType;
  status: 'active' | 'completed' | 'abandoned';
  winnerUserId: string | null;
  resultPayload: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
  moves: MatchMoveDTO[];
}

export interface RatingDTO {
  gameType: GameType;
  rating: number;
  updatedAt: string;
}

export interface RatingFormulaDTO {
  gameType: GameType;
  system: 'elo';
  initialRating: number;
  kFactor: number;
  expectedScore: '1 / (1 + 10^((opponent - player) / 400))';
}

export interface BlockDTO {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  reporterUserId: string;
  targetUserId: string | null;
  matchId: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
  session: SessionDTO;
}

export type GomokuMark = 'black' | 'white';
export type GomokuRuleset = 'freestyle' | 'renju';
export type GomokuForbiddenMoveReason = 'overline' | 'double_three' | 'double_four';

export interface GomokuMove {
  x: number;
  y: number;
  player: GomokuMark;
}

export interface GomokuState {
  boardSize: number;
  board: (GomokuMark | null)[][];
  nextPlayer: GomokuMark;
  winner: GomokuMark | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
  ruleset: GomokuRuleset;
  forbiddenMove: GomokuForbiddenMoveReason | null;
}

export type SantoriniPlayer = 'black' | 'white';
export type SantoriniWorkerId = 'a' | 'b';

export interface SantoriniPosition {
  x: number;
  y: number;
}

export type SantoriniMoveInput =
  | {
      type: 'place';
      worker: SantoriniWorkerId;
      x: number;
      y: number;
    }
  | {
      type: 'turn';
      worker: SantoriniWorkerId;
      to: SantoriniPosition;
      build: SantoriniPosition;
    };

export type SantoriniMove =
  | {
      type: 'place';
      worker: SantoriniWorkerId;
      x: number;
      y: number;
      player: SantoriniPlayer;
    }
  | {
      type: 'turn';
      worker: SantoriniWorkerId;
      to: SantoriniPosition;
      build: SantoriniPosition;
      player: SantoriniPlayer;
    };

export interface SantoriniState {
  boardSize: number;
  levels: number[][];
  workers: {
    black: Record<SantoriniWorkerId, SantoriniPosition | null>;
    white: Record<SantoriniWorkerId, SantoriniPosition | null>;
  };
  nextPlayer: SantoriniPlayer;
  status: 'setup' | 'playing' | 'completed';
  winner: SantoriniPlayer | null;
  loserReason: 'no_legal_move' | null;
  moveCount: number;
}

export type OnitamaPlayer = 'black' | 'white';
export type OnitamaCardName =
  | 'tiger'
  | 'dragon'
  | 'frog'
  | 'rabbit'
  | 'crab'
  | 'elephant'
  | 'goose'
  | 'rooster';

export interface OnitamaPosition {
  x: number;
  y: number;
}

export interface OnitamaCardVector {
  dx: number;
  dy: number;
}

export interface OnitamaCard {
  name: OnitamaCardName;
  vectors: OnitamaCardVector[];
}

export type OnitamaPieceKind = 'master' | 'student';

export interface OnitamaPiece {
  player: OnitamaPlayer;
  kind: OnitamaPieceKind;
}

export interface OnitamaMoveInput {
  from: OnitamaPosition;
  to: OnitamaPosition;
  card: OnitamaCardName;
}

export interface OnitamaMove {
  from: OnitamaPosition;
  to: OnitamaPosition;
  card: OnitamaCardName;
  player: OnitamaPlayer;
}

export interface OnitamaState {
  boardSize: number;
  board: (OnitamaPiece | null)[][];
  cards: {
    black: OnitamaCardName[];
    white: OnitamaCardName[];
    side: OnitamaCardName;
  };
  nextPlayer: OnitamaPlayer;
  status: 'playing' | 'completed';
  winner: OnitamaPlayer | null;
  moveCount: number;
}

export type CodenamesDuetPlayer = 'black' | 'white';
export type CodenamesDuetCellRole = 'agent' | 'neutral' | 'assassin';

export interface CodenamesDuetClue {
  word: string;
  count: number;
  by: CodenamesDuetPlayer;
  remainingGuesses: number;
}

export type CodenamesDuetMoveInput =
  | {
      type: 'clue';
      word: string;
      count: number;
    }
  | {
      type: 'guess';
      index: number;
    }
  | {
      type: 'end_guesses';
    };

export type CodenamesDuetMove =
  | {
      type: 'clue';
      word: string;
      count: number;
      player: CodenamesDuetPlayer;
    }
  | {
      type: 'guess';
      index: number;
      player: CodenamesDuetPlayer;
    }
  | {
      type: 'end_guesses';
      player: CodenamesDuetPlayer;
    };

export interface CodenamesDuetState {
  boardSize: number;
  words: string[];
  revealed: boolean[];
  revealedRoles: (CodenamesDuetCellRole | null)[];
  turnsRemaining: number;
  currentCluer: CodenamesDuetPlayer;
  currentGuesser: CodenamesDuetPlayer;
  phase: 'clue' | 'guess';
  activeClue: CodenamesDuetClue | null;
  status: 'playing' | 'completed';
  outcome: 'success' | 'assassin' | 'out_of_turns' | null;
  moveCount: number;
  key: CodenamesDuetCellRole[] | null;
  keyBlack: CodenamesDuetCellRole[] | null;
  keyWhite: CodenamesDuetCellRole[] | null;
  targetCounts: {
    total: number;
    found: number;
  };
}

export type LoveLetterPlayer = 'black' | 'white';
export type LoveLetterCardName =
  | 'guard'
  | 'priest'
  | 'baron'
  | 'handmaid'
  | 'prince'
  | 'king'
  | 'countess'
  | 'princess';

export interface LoveLetterMoveInput {
  type: 'play';
  card: LoveLetterCardName;
  target?: LoveLetterPlayer;
  guess?: LoveLetterCardName;
}

export interface LoveLetterMove {
  type: 'play';
  card: LoveLetterCardName;
  target?: LoveLetterPlayer;
  guess?: LoveLetterCardName;
  player: LoveLetterPlayer;
}

export interface LoveLetterState {
  nextPlayer: LoveLetterPlayer;
  status: 'playing' | 'completed';
  winner: LoveLetterPlayer | null;
  moveCount: number;
  turnCount: number;
  drawPileCount: number;
  handCounts: {
    black: number;
    white: number;
  };
  hand: LoveLetterCardName[] | null;
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
}

export type BattleshipPlayer = 'black' | 'white';
export type BattleshipShipOrientation = 'h' | 'v';
export type BattleshipShotCell = 'unknown' | 'miss' | 'hit';

export interface BattleshipShipPlacement {
  x: number;
  y: number;
  orientation: BattleshipShipOrientation;
  length: number;
}

export type BattleshipMoveInput =
  | {
      type: 'place_fleet';
      ships: BattleshipShipPlacement[];
    }
  | {
      type: 'fire';
      x: number;
      y: number;
    };

export type BattleshipMove =
  | {
      type: 'place_fleet';
      ships: BattleshipShipPlacement[];
      player: BattleshipPlayer;
    }
  | {
      type: 'fire';
      x: number;
      y: number;
      player: BattleshipPlayer;
    };

export interface BattleshipState {
  boardSize: number;
  shipLengths: number[];
  phase: 'placement' | 'playing' | 'completed';
  nextPlayer: BattleshipPlayer;
  status: 'playing' | 'completed';
  winner: BattleshipPlayer | null;
  moveCount: number;
  placementsSubmitted: {
    black: boolean;
    white: boolean;
  };
  ships: {
    black: BattleshipShipPlacement[] | null;
    white: BattleshipShipPlacement[] | null;
  };
  shots: {
    black: BattleshipShotCell[][];
    white: BattleshipShotCell[][];
  };
  sunkShips: {
    black: number;
    white: number;
  };
  lastShot: {
    x: number;
    y: number;
    player: BattleshipPlayer;
    result: 'miss' | 'hit' | 'sunk';
  } | null;
}

export type Connect4Disc = 'red' | 'yellow';

export interface Connect4Move {
  column: number;
  player: Connect4Disc;
}

export interface Connect4State {
  columns: number;
  rows: number;
  board: (Connect4Disc | null)[][];
  nextPlayer: Connect4Disc;
  winner: Connect4Disc | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
}

export type HexPlayer = 'black' | 'white';

export interface HexMove {
  x: number;
  y: number;
  player: HexPlayer;
}

export interface HexState {
  boardSize: number;
  board: (HexPlayer | null)[][];
  nextPlayer: HexPlayer;
  winner: HexPlayer | null;
  status: 'playing' | 'completed';
  moveCount: number;
}

export type ReversiDisc = 'black' | 'white';

export interface ReversiMove {
  x: number;
  y: number;
  player: ReversiDisc;
}

export interface ReversiState {
  boardSize: number;
  board: (ReversiDisc | null)[][];
  nextPlayer: ReversiDisc;
  winner: ReversiDisc | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
  counts: {
    black: number;
    white: number;
  };
}

export type DotsPlayer = 'black' | 'white';
export type DotsLineOrientation = 'h' | 'v';

export interface DotsMove {
  orientation: DotsLineOrientation;
  x: number;
  y: number;
  player: DotsPlayer;
}

export interface DotsState {
  dotsX: number;
  dotsY: number;
  horizontal: boolean[][];
  vertical: boolean[][];
  boxes: (DotsPlayer | null)[][];
  nextPlayer: DotsPlayer;
  winner: DotsPlayer | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
  scores: {
    black: number;
    white: number;
  };
}

export type GoStone = 'black' | 'white';
export type GoRuleset = 'chinese';

export interface GoPoint {
  x: number;
  y: number;
}

export type GoMove =
  | {
      type: 'place';
      x: number;
      y: number;
      player: GoStone;
    }
  | {
      type: 'pass';
      player: GoStone;
    };

export interface GoScoreBreakdown {
  ruleset: GoRuleset;
  komi: number;
  black: {
    stones: number;
    territory: number;
    captures: number;
    total: number;
  };
  white: {
    stones: number;
    territory: number;
    captures: number;
    komi: number;
    total: number;
  };
  winner: GoStone | null;
  margin: number;
}

export interface GoState {
  boardSize: number;
  board: (GoStone | null)[][];
  nextPlayer: GoStone;
  status: 'playing' | 'completed';
  winner: GoStone | null;
  moveCount: number;
  consecutivePasses: number;
  koPoint: GoPoint | null;
  ruleset: GoRuleset;
  komi: number;
  captures: {
    black: number;
    white: number;
  };
  scoring: GoScoreBreakdown | null;
}

export type XiangqiColor = 'red' | 'black';

export type XiangqiPieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'chariot'
  | 'cannon'
  | 'soldier';

export interface XiangqiPiece {
  type: XiangqiPieceType;
  color: XiangqiColor;
}

export interface XiangqiPosition {
  x: number;
  y: number;
}

export interface XiangqiMove {
  from: XiangqiPosition;
  to: XiangqiPosition;
  player: XiangqiColor;
}

export type XiangqiOutcomeReason =
  | 'capture_general'
  | 'checkmate'
  | 'stalemate'
  | 'perpetual_check_violation'
  | 'draw_repetition';

export interface XiangqiState {
  board: (XiangqiPiece | null)[][];
  nextPlayer: XiangqiColor;
  status: 'playing' | 'completed';
  winner: XiangqiColor | null;
  outcomeReason: XiangqiOutcomeReason | null;
  moveCount: number;
  positionHistory: string[];
}

export type QuoridorPlayer = 'black' | 'white';
export type QuoridorWallOrientation = 'h' | 'v';

export type QuoridorMove =
  | {
      type: 'pawn';
      x: number;
      y: number;
      player: QuoridorPlayer;
    }
  | {
      type: 'wall';
      orientation: QuoridorWallOrientation;
      x: number;
      y: number;
      player: QuoridorPlayer;
    };

export type QuoridorMoveInput =
  | {
      type: 'pawn';
      x: number;
      y: number;
    }
  | {
      type: 'wall';
      orientation: QuoridorWallOrientation;
      x: number;
      y: number;
    };

export interface QuoridorState {
  boardSize: number;
  wallsPerPlayer: number;
  pawns: {
    black: {
      x: number;
      y: number;
    };
    white: {
      x: number;
      y: number;
    };
  };
  walls: {
    horizontal: boolean[][];
    vertical: boolean[][];
  };
  remainingWalls: {
    black: number;
    white: number;
  };
  nextPlayer: QuoridorPlayer;
  status: 'playing' | 'completed';
  winner: QuoridorPlayer | null;
  moveCount: number;
}

export type BackgammonColor = 'white' | 'black';
export type BackgammonFrom = number | 'bar';
export type BackgammonTo = number | 'off';

export interface BackgammonMove {
  from: BackgammonFrom;
  to: BackgammonTo;
  die: number;
  player: BackgammonColor;
}

export interface BackgammonState {
  points: number[];
  bar: {
    white: number;
    black: number;
  };
  borneOff: {
    white: number;
    black: number;
  };
  nextPlayer: BackgammonColor;
  status: 'playing' | 'completed';
  winner: BackgammonColor | null;
  moveCount: number;
  turnCount: number;
  rollCount: number;
  dice: [number, number] | null;
  remainingDice: number[];
}

export type CardsSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type CardsRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type CardsPlayer = 'black' | 'white';

export interface CardsCard {
  suit: CardsSuit;
  rank: CardsRank;
}

export type CardsMoveInput =
  | {
      type: 'play';
      card: CardsCard;
      chosenSuit?: CardsSuit;
    }
  | {
      type: 'draw';
    }
  | {
      type: 'end_turn';
    };

export type CardsMove =
  | {
      type: 'play';
      player: CardsPlayer;
      card: CardsCard;
      chosenSuit?: CardsSuit;
    }
  | {
      type: 'draw';
      player: CardsPlayer;
    }
  | {
      type: 'end_turn';
      player: CardsPlayer;
    };

export interface CardsState {
  nextPlayer: CardsPlayer;
  status: 'playing' | 'completed';
  winner: CardsPlayer | null;
  topCard: CardsCard;
  activeSuit: CardsSuit;
  moveCount: number;
  handCounts: {
    black: number;
    white: number;
  };
  hand: CardsCard[] | null;
  drawPileCount: number | null;
  discardPileCount: number;
  pendingDrawPlay: boolean;
}

export type LiarsDicePlayer = 'black' | 'white';

export interface LiarsDiceBid {
  quantity: number;
  face: number;
  player: LiarsDicePlayer;
}

export type LiarsDiceMoveInput =
  | {
      type: 'bid';
      quantity: number;
      face: number;
    }
  | {
      type: 'call_liar';
    };

export type LiarsDiceMove =
  | {
      type: 'bid';
      quantity: number;
      face: number;
      player: LiarsDicePlayer;
    }
  | {
      type: 'call_liar';
      player: LiarsDicePlayer;
    };

export interface LiarsDiceRoundResolution {
  round: number;
  starter: LiarsDicePlayer;
  bids: LiarsDiceBid[];
  caller: LiarsDicePlayer;
  calledBid: LiarsDiceBid;
  totalMatching: number;
  wasLiar: boolean;
  loser: LiarsDicePlayer;
}

export interface LiarsDiceState {
  dicePerPlayer: number;
  currentRound: number;
  nextPlayer: LiarsDicePlayer;
  status: 'playing' | 'completed';
  winner: LiarsDicePlayer | null;
  moveCount: number;
  diceCounts: {
    black: number;
    white: number;
  };
  currentBid: LiarsDiceBid | null;
  bidHistory: LiarsDiceBid[];
  viewerDice: number[] | null;
  lastRound: LiarsDiceRoundResolution | null;
}

export type Direction2048 = 'up' | 'down' | 'left' | 'right';

export interface Game2048State {
  board: number[][];
  score: number;
  status: 'playing' | 'won' | 'lost';
}

export interface WsEnvelope<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export type VerifiableRngPhase = 'awaiting_commits' | 'awaiting_reveals' | 'ready';

export interface VerifiableRngPublicState {
  roomId: string;
  phase: VerifiableRngPhase;
  serverSeedCommit: string;
  commits: Record<string, string | null>;
  revealedUsers: string[];
  revealDeadlineAt: number | null;
  rngSeed: string | null;
}

export type RoomStatePayload =
  | {
      room: RoomDTO;
      gameType: 'gomoku';
      state: GomokuState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'santorini';
      state: SantoriniState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'onitama';
      state: OnitamaState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'battleship';
      state: BattleshipState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'codenames_duet';
      state: CodenamesDuetState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'love_letter';
      state: LoveLetterState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'connect4';
      state: Connect4State | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'reversi';
      state: ReversiState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'dots';
      state: DotsState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'go';
      state: GoState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'xiangqi';
      state: XiangqiState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'backgammon';
      state: BackgammonState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'cards';
      state: CardsState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'quoridor';
      state: QuoridorState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'hex';
      state: HexState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'liars_dice';
      state: LiarsDiceState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'single_2048';
      state: null;
      viewerRole: RoomPlayerRole;
    };

export type MatchMoveAppliedPayload =
  | {
      roomId: string;
      gameType: 'gomoku';
      state: GomokuState;
      lastMove: GomokuMove;
    }
  | {
      roomId: string;
      gameType: 'santorini';
      state: SantoriniState;
      lastMove: SantoriniMove;
    }
  | {
      roomId: string;
      gameType: 'onitama';
      state: OnitamaState;
      lastMove: OnitamaMove;
    }
  | {
      roomId: string;
      gameType: 'battleship';
      state: BattleshipState;
      lastMove: BattleshipMove;
    }
  | {
      roomId: string;
      gameType: 'codenames_duet';
      state: CodenamesDuetState;
      lastMove: CodenamesDuetMove;
    }
  | {
      roomId: string;
      gameType: 'love_letter';
      state: LoveLetterState;
      lastMove: LoveLetterMove;
    }
  | {
      roomId: string;
      gameType: 'connect4';
      state: Connect4State;
      lastMove: Connect4Move;
    }
  | {
      roomId: string;
      gameType: 'reversi';
      state: ReversiState;
      lastMove: ReversiMove;
    }
  | {
      roomId: string;
      gameType: 'dots';
      state: DotsState;
      lastMove: DotsMove;
    }
  | {
      roomId: string;
      gameType: 'go';
      state: GoState;
      lastMove: GoMove;
    }
  | {
      roomId: string;
      gameType: 'xiangqi';
      state: XiangqiState;
      lastMove: XiangqiMove;
    }
  | {
      roomId: string;
      gameType: 'backgammon';
      state: BackgammonState;
      lastMove: BackgammonMove;
    }
  | {
      roomId: string;
      gameType: 'cards';
      state: CardsState;
      lastMove: CardsMove;
    }
  | {
      roomId: string;
      gameType: 'quoridor';
      state: QuoridorState;
      lastMove: QuoridorMove;
    }
  | {
      roomId: string;
      gameType: 'hex';
      state: HexState;
      lastMove: HexMove;
    }
  | {
      roomId: string;
      gameType: 'liars_dice';
      state: LiarsDiceState;
      lastMove: LiarsDiceMove;
    };

export type ClientToServerMessage =
  | WsEnvelope<'auth', { token: string; reconnectKey?: string }>
  | WsEnvelope<'lobby.subscribe', Record<string, never>>
  | WsEnvelope<'room.subscribe', { roomId: string; asSpectator?: boolean }>
  | WsEnvelope<'room.unsubscribe', { roomId: string }>
  | WsEnvelope<'room.rng.commit', { roomId: string; commit: string }>
  | WsEnvelope<'room.rng.reveal', { roomId: string; nonce: string }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'gomoku'; x: number; y: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'santorini'; move: SantoriniMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'onitama'; move: OnitamaMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'battleship'; move: BattleshipMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'love_letter'; move: LoveLetterMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'codenames_duet'; move: CodenamesDuetMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'connect4'; column: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'reversi'; x: number; y: number }>
  | WsEnvelope<
      'room.move',
      { roomId: string; gameType: 'dots'; move: Pick<DotsMove, 'orientation' | 'x' | 'y'> }
    >
  | WsEnvelope<'room.move', { roomId: string; gameType: 'go'; move: GoMove }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'xiangqi'; move: XiangqiMove }>
  | WsEnvelope<
      'room.move',
      { roomId: string; gameType: 'backgammon'; move: Pick<BackgammonMove, 'from' | 'to' | 'die'> }
    >
  | WsEnvelope<'room.move', { roomId: string; gameType: 'cards'; move: CardsMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'quoridor'; move: QuoridorMoveInput }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'hex'; x: number; y: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'liars_dice'; move: LiarsDiceMoveInput }>
  | WsEnvelope<'matchmaking.join', { gameType: BoardGameType }>
  | WsEnvelope<'matchmaking.leave', Record<string, never>>
  | WsEnvelope<'invite.respond', { invitationId: string; action: 'accept' | 'decline' }>
  | WsEnvelope<'ping', { ts: number }>;

export type ServerToClientMessage =
  | WsEnvelope<'auth.ok', { connectionId: string; reconnectKey: string; user: UserDTO }>
  | WsEnvelope<'auth.error', { reason: string }>
  | WsEnvelope<'lobby.presence', { onlineUsers: Array<{ userId: string; displayName: string }> }>
  | WsEnvelope<'room.state', RoomStatePayload>
  | WsEnvelope<'room.player_joined', { roomId: string; user: UserDTO; role: RoomPlayerRole }>
  | WsEnvelope<'room.player_left', { roomId: string; userId: string }>
  | WsEnvelope<'room.rng.updated', VerifiableRngPublicState>
  | WsEnvelope<'invite.received', { invitation: InvitationDTO }>
  | WsEnvelope<'invite.updated', { invitationId: string; status: InvitationDTO['status'] }>
  | WsEnvelope<'matchmaking.queued', { gameType: BoardGameType; queueSize: number }>
  | WsEnvelope<'matchmaking.timeout', { gameType: BoardGameType }>
  | WsEnvelope<'matchmaking.matched', { room: RoomDTO; matchId: string }>
  | WsEnvelope<'match.move_applied', MatchMoveAppliedPayload>
  | WsEnvelope<
      'match.completed',
      {
        roomId: string;
        matchId: string;
        winnerUserId: string | null;
        resultPayload?: Record<string, unknown> | null;
      }
    >
  | WsEnvelope<'error', { reason: string }>
  | WsEnvelope<'pong', { ts: number }>;

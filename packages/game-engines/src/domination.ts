import type {
  DominationMove,
  DominationMoveInput,
  DominationPlayer,
  DominationState
} from '@multiwebgame/shared-types';

const DEFAULT_BOARD_SIZE = 9;
const ORTHOGONAL_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 }
];

function otherPlayer(player: DominationPlayer): DominationPlayer {
  return player === 'black' ? 'white' : 'black';
}

function isInBounds(boardSize: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function cloneBoard(board: (DominationPlayer | null)[][]): (DominationPlayer | null)[][] {
  return board.map((row) => row.map((cell) => cell));
}

function evaluateBoard(board: (DominationPlayer | null)[][]): {
  pieceCounts: DominationState['pieceCounts'];
  controlCounts: DominationState['controlCounts'];
  scores: DominationState['scores'];
} {
  const boardSize = board.length;
  const pieceCounts = {
    black: 0,
    white: 0
  };
  const controlCounts = {
    black: 0,
    white: 0
  };

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const occupant = board[y][x];
      if (occupant) {
        pieceCounts[occupant] += 1;
        continue;
      }

      let blackInfluence = 0;
      let whiteInfluence = 0;
      for (const direction of ORTHOGONAL_DIRECTIONS) {
        const nx = x + direction.dx;
        const ny = y + direction.dy;
        if (!isInBounds(boardSize, nx, ny)) {
          continue;
        }
        const neighbor = board[ny][nx];
        if (neighbor === 'black') {
          blackInfluence += 1;
        } else if (neighbor === 'white') {
          whiteInfluence += 1;
        }
      }

      if (blackInfluence > whiteInfluence && blackInfluence > 0) {
        controlCounts.black += 1;
      } else if (whiteInfluence > blackInfluence && whiteInfluence > 0) {
        controlCounts.white += 1;
      }
    }
  }

  return {
    pieceCounts,
    controlCounts,
    scores: {
      black: pieceCounts.black + controlCounts.black,
      white: pieceCounts.white + controlCounts.white
    }
  };
}

export type DominationRuntimeState = DominationState;

export interface CreateDominationStateOptions {
  boardSize?: number;
  startingPlayer?: DominationPlayer;
}

export interface ApplyDominationMoveResult {
  accepted: boolean;
  nextState: DominationRuntimeState;
  reason?: string;
}

export function createDominationState(options: CreateDominationStateOptions = {}): DominationRuntimeState {
  const boardSize = options.boardSize ?? DEFAULT_BOARD_SIZE;
  if (!Number.isInteger(boardSize) || boardSize < 3 || boardSize > 19) {
    throw new Error('invalid_domination_board_size');
  }

  return {
    boardSize,
    board: Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => null)),
    nextPlayer: options.startingPlayer ?? 'black',
    status: 'playing',
    winner: null,
    moveCount: 0,
    pieceCounts: {
      black: 0,
      white: 0
    },
    controlCounts: {
      black: 0,
      white: 0
    },
    scores: {
      black: 0,
      white: 0
    }
  };
}

export function normalizeDominationMove(
  input: DominationMoveInput,
  player: DominationPlayer
): DominationMove {
  return {
    x: input.x,
    y: input.y,
    player
  };
}

export function applyDominationMove(
  state: DominationRuntimeState,
  move: DominationMove
): ApplyDominationMoveResult {
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

  if (!isInBounds(state.boardSize, move.x, move.y)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_bounds'
    };
  }

  if (state.board[move.y][move.x] !== null) {
    return {
      accepted: false,
      nextState: state,
      reason: 'occupied_cell'
    };
  }

  const board = cloneBoard(state.board);
  board[move.y][move.x] = move.player;
  const moveCount = state.moveCount + 1;
  const stats = evaluateBoard(board);
  const completed = moveCount >= state.boardSize * state.boardSize;
  const winner = !completed
    ? null
    : stats.scores.black > stats.scores.white
      ? ('black' as const)
      : stats.scores.white > stats.scores.black
        ? ('white' as const)
        : null;

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      nextPlayer: otherPlayer(move.player),
      status: completed ? 'completed' : 'playing',
      winner,
      moveCount,
      pieceCounts: stats.pieceCounts,
      controlCounts: stats.controlCounts,
      scores: stats.scores
    }
  };
}

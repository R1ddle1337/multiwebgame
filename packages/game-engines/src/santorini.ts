import type {
  SantoriniMove,
  SantoriniMoveInput,
  SantoriniPlayer,
  SantoriniPosition,
  SantoriniState,
  SantoriniWorkerId
} from '@multiwebgame/shared-types';

function otherPlayer(player: SantoriniPlayer): SantoriniPlayer {
  return player === 'black' ? 'white' : 'black';
}

function cloneLevels(levels: number[][]): number[][] {
  return levels.map((row) => [...row]);
}

function clonePosition(position: SantoriniPosition): SantoriniPosition {
  return { x: position.x, y: position.y };
}

function cloneWorkers(workers: SantoriniState['workers']): SantoriniState['workers'] {
  return {
    black: {
      a: workers.black.a ? clonePosition(workers.black.a) : null,
      b: workers.black.b ? clonePosition(workers.black.b) : null
    },
    white: {
      a: workers.white.a ? clonePosition(workers.white.a) : null,
      b: workers.white.b ? clonePosition(workers.white.b) : null
    }
  };
}

function inBounds(state: SantoriniState, position: SantoriniPosition): boolean {
  return (
    Number.isInteger(position.x) &&
    Number.isInteger(position.y) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < state.boardSize &&
    position.y < state.boardSize
  );
}

function hasWorkerAt(state: SantoriniState, position: SantoriniPosition): boolean {
  for (const player of ['black', 'white'] as const) {
    for (const worker of ['a', 'b'] as const) {
      const existing = state.workers[player][worker];
      if (existing && existing.x === position.x && existing.y === position.y) {
        return true;
      }
    }
  }

  return false;
}

function isAdjacent(from: SantoriniPosition, to: SantoriniPosition): boolean {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return (dx > 0 || dy > 0) && dx <= 1 && dy <= 1;
}

function allWorkersPlaced(state: SantoriniState): boolean {
  return Boolean(
    state.workers.black.a && state.workers.black.b && state.workers.white.a && state.workers.white.b
  );
}

function hasLegalTurnMoveForWorker(
  state: SantoriniState,
  player: SantoriniPlayer,
  workerId: SantoriniWorkerId
): boolean {
  const worker = state.workers[player][workerId];
  if (!worker) {
    return false;
  }

  const fromLevel = state.levels[worker.y][worker.x];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const to: SantoriniPosition = {
        x: worker.x + dx,
        y: worker.y + dy
      };
      if (!inBounds(state, to) || hasWorkerAt(state, to)) {
        continue;
      }

      const toLevel = state.levels[to.y][to.x];
      if (toLevel >= 4 || toLevel - fromLevel > 1) {
        continue;
      }

      for (let buildDy = -1; buildDy <= 1; buildDy += 1) {
        for (let buildDx = -1; buildDx <= 1; buildDx += 1) {
          if (buildDx === 0 && buildDy === 0) {
            continue;
          }

          const build: SantoriniPosition = {
            x: to.x + buildDx,
            y: to.y + buildDy
          };
          if (!inBounds(state, build)) {
            continue;
          }

          const occupiedByOtherWorker =
            hasWorkerAt(state, build) && !(build.x === worker.x && build.y === worker.y);
          if (occupiedByOtherWorker) {
            continue;
          }

          if (state.levels[build.y][build.x] >= 4) {
            continue;
          }

          return true;
        }
      }
    }
  }

  return false;
}

function hasAnyLegalTurnMove(state: SantoriniState, player: SantoriniPlayer): boolean {
  return hasLegalTurnMoveForWorker(state, player, 'a') || hasLegalTurnMoveForWorker(state, player, 'b');
}

export interface CreateSantoriniStateOptions {
  boardSize?: number;
}

export interface ApplySantoriniMoveResult {
  accepted: boolean;
  nextState: SantoriniState;
  reason?: string;
}

export function createSantoriniState(options: CreateSantoriniStateOptions = {}): SantoriniState {
  const boardSize = options.boardSize ?? 5;
  if (!Number.isInteger(boardSize) || boardSize < 3 || boardSize > 9) {
    throw new Error('invalid_board_size');
  }

  return {
    boardSize,
    levels: Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => 0)),
    workers: {
      black: {
        a: null,
        b: null
      },
      white: {
        a: null,
        b: null
      }
    },
    nextPlayer: 'black',
    status: 'setup',
    winner: null,
    loserReason: null,
    moveCount: 0
  };
}

export function normalizeSantoriniMove(input: SantoriniMoveInput, player: SantoriniPlayer): SantoriniMove {
  if (input.type === 'place') {
    return {
      type: 'place',
      worker: input.worker,
      x: input.x,
      y: input.y,
      player
    };
  }

  return {
    type: 'turn',
    worker: input.worker,
    to: clonePosition(input.to),
    build: clonePosition(input.build),
    player
  };
}

export function applySantoriniMove(state: SantoriniState, move: SantoriniMove): ApplySantoriniMoveResult {
  if (state.status === 'completed') {
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

  if (move.type === 'place') {
    if (state.status !== 'setup') {
      return {
        accepted: false,
        nextState: state,
        reason: 'setup_already_completed'
      };
    }

    const target: SantoriniPosition = {
      x: move.x,
      y: move.y
    };
    if (!inBounds(state, target)) {
      return {
        accepted: false,
        nextState: state,
        reason: 'out_of_bounds'
      };
    }

    if (move.worker !== 'a' && move.worker !== 'b') {
      return {
        accepted: false,
        nextState: state,
        reason: 'unknown_worker'
      };
    }

    if (state.workers[move.player][move.worker]) {
      return {
        accepted: false,
        nextState: state,
        reason: 'worker_already_placed'
      };
    }

    if (hasWorkerAt(state, target)) {
      return {
        accepted: false,
        nextState: state,
        reason: 'occupied_cell'
      };
    }

    const nextWorkers = cloneWorkers(state.workers);
    nextWorkers[move.player][move.worker] = clonePosition(target);
    const nextState: SantoriniState = {
      ...state,
      workers: nextWorkers,
      moveCount: state.moveCount + 1,
      nextPlayer: otherPlayer(move.player)
    };

    if (allWorkersPlaced(nextState)) {
      nextState.status = 'playing';
      nextState.nextPlayer = 'black';
    }

    return {
      accepted: true,
      nextState
    };
  }

  if (state.status !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'setup_incomplete'
    };
  }

  const from = state.workers[move.player][move.worker];
  if (!from) {
    return {
      accepted: false,
      nextState: state,
      reason: 'worker_not_placed'
    };
  }

  if (!inBounds(state, move.to) || !inBounds(state, move.build)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_bounds'
    };
  }

  if (!isAdjacent(from, move.to)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'move_not_adjacent'
    };
  }

  if (hasWorkerAt(state, move.to)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'occupied_cell'
    };
  }

  const fromLevel = state.levels[from.y][from.x];
  const toLevel = state.levels[move.to.y][move.to.x];
  if (toLevel >= 4) {
    return {
      accepted: false,
      nextState: state,
      reason: 'target_has_dome'
    };
  }

  if (toLevel - fromLevel > 1) {
    return {
      accepted: false,
      nextState: state,
      reason: 'climb_too_high'
    };
  }

  if (!isAdjacent(move.to, move.build)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'build_not_adjacent'
    };
  }

  const buildOnMovedWorker = move.build.x === move.to.x && move.build.y === move.to.y;
  if (buildOnMovedWorker) {
    return {
      accepted: false,
      nextState: state,
      reason: 'cannot_build_on_worker'
    };
  }

  const buildBlockedByOtherWorker =
    hasWorkerAt(state, move.build) && !(move.build.x === from.x && move.build.y === from.y);
  if (buildBlockedByOtherWorker) {
    return {
      accepted: false,
      nextState: state,
      reason: 'cannot_build_on_worker'
    };
  }

  const buildLevel = state.levels[move.build.y][move.build.x];
  if (buildLevel >= 4) {
    return {
      accepted: false,
      nextState: state,
      reason: 'build_on_dome'
    };
  }

  const nextLevels = cloneLevels(state.levels);
  nextLevels[move.build.y][move.build.x] = Math.min(4, nextLevels[move.build.y][move.build.x] + 1);
  const nextWorkers = cloneWorkers(state.workers);
  nextWorkers[move.player][move.worker] = clonePosition(move.to);

  const nextPlayer = otherPlayer(move.player);
  const nextState: SantoriniState = {
    ...state,
    levels: nextLevels,
    workers: nextWorkers,
    moveCount: state.moveCount + 1,
    nextPlayer,
    status: 'playing',
    winner: null,
    loserReason: null
  };

  if (toLevel === 3) {
    nextState.status = 'completed';
    nextState.winner = move.player;
    return {
      accepted: true,
      nextState
    };
  }

  if (!hasAnyLegalTurnMove(nextState, nextPlayer)) {
    nextState.status = 'completed';
    nextState.winner = move.player;
    nextState.loserReason = 'no_legal_move';
  }

  return {
    accepted: true,
    nextState
  };
}

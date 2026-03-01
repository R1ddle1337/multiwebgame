import type {
  BattleshipMove,
  BattleshipMoveInput,
  BattleshipPlayer,
  BattleshipShipPlacement,
  BattleshipShotCell,
  BattleshipState
} from '@multiwebgame/shared-types';

const DEFAULT_BOARD_SIZE = 10;
const DEFAULT_SHIP_LENGTHS = [5, 4, 3, 3, 2] as const;

function otherPlayer(player: BattleshipPlayer): BattleshipPlayer {
  return player === 'black' ? 'white' : 'black';
}

function cloneShip(ship: BattleshipShipPlacement): BattleshipShipPlacement {
  return {
    x: ship.x,
    y: ship.y,
    orientation: ship.orientation,
    length: ship.length
  };
}

function cloneFleet(ships: BattleshipShipPlacement[] | null): BattleshipShipPlacement[] | null {
  if (!ships) {
    return null;
  }

  return ships.map((ship) => cloneShip(ship));
}

function cloneShots(shots: BattleshipShotCell[][]): BattleshipShotCell[][] {
  return shots.map((row) => row.map((cell) => cell));
}

function createEmptyShots(boardSize: number): BattleshipShotCell[][] {
  return Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => 'unknown' as const));
}

function isInBounds(boardSize: number, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function shipCells(ship: BattleshipShipPlacement): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let offset = 0; offset < ship.length; offset += 1) {
    cells.push({
      x: ship.x + (ship.orientation === 'h' ? offset : 0),
      y: ship.y + (ship.orientation === 'v' ? offset : 0)
    });
  }
  return cells;
}

function isValidShipPlacement(ship: BattleshipShipPlacement): boolean {
  return (
    Number.isInteger(ship.x) &&
    Number.isInteger(ship.y) &&
    Number.isInteger(ship.length) &&
    ship.length > 0 &&
    (ship.orientation === 'h' || ship.orientation === 'v')
  );
}

function validateFleet(
  boardSize: number,
  shipLengths: number[],
  ships: BattleshipShipPlacement[]
): { valid: boolean; reason?: string } {
  if (!Array.isArray(ships) || ships.length !== shipLengths.length) {
    return {
      valid: false,
      reason: 'invalid_fleet_size'
    };
  }

  const expected = [...shipLengths].sort((a, b) => a - b);
  const actual = ships.map((ship) => ship.length).sort((a, b) => a - b);
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== actual[index]) {
      return {
        valid: false,
        reason: 'invalid_ship_lengths'
      };
    }
  }

  const occupied = new Set<string>();
  for (const ship of ships) {
    if (!isValidShipPlacement(ship)) {
      return {
        valid: false,
        reason: 'invalid_ship'
      };
    }

    for (const cell of shipCells(ship)) {
      if (!isInBounds(boardSize, cell.x, cell.y)) {
        return {
          valid: false,
          reason: 'ship_out_of_bounds'
        };
      }

      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) {
        return {
          valid: false,
          reason: 'ship_overlap'
        };
      }
      occupied.add(key);
    }
  }

  return { valid: true };
}

function shipAt(ships: BattleshipShipPlacement[], x: number, y: number): BattleshipShipPlacement | null {
  for (const ship of ships) {
    if (shipCells(ship).some((cell) => cell.x === x && cell.y === y)) {
      return ship;
    }
  }

  return null;
}

function isShipSunk(shots: BattleshipShotCell[][], ship: BattleshipShipPlacement): boolean {
  return shipCells(ship).every((cell) => shots[cell.y][cell.x] === 'hit');
}

function countSunkShips(shots: BattleshipShotCell[][], ships: BattleshipShipPlacement[]): number {
  let sunk = 0;
  for (const ship of ships) {
    if (isShipSunk(shots, ship)) {
      sunk += 1;
    }
  }
  return sunk;
}

export interface BattleshipRuntimeState {
  boardSize: number;
  shipLengths: number[];
  phase: 'placement' | 'playing' | 'completed';
  nextPlayer: BattleshipPlayer;
  status: 'playing' | 'completed';
  winner: BattleshipPlayer | null;
  moveCount: number;
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

export interface ApplyBattleshipMoveResult {
  accepted: boolean;
  nextState: BattleshipRuntimeState;
  reason?: string;
}

export interface CreateBattleshipStateOptions {
  boardSize?: number;
  shipLengths?: number[];
  startingPlayer?: BattleshipPlayer;
}

export function createBattleshipState(options: CreateBattleshipStateOptions = {}): BattleshipRuntimeState {
  const boardSize = options.boardSize ?? DEFAULT_BOARD_SIZE;
  const shipLengths = options.shipLengths ?? [...DEFAULT_SHIP_LENGTHS];

  if (!Number.isInteger(boardSize) || boardSize < 5 || boardSize > 20) {
    throw new Error('invalid_battleship_board_size');
  }

  if (
    !Array.isArray(shipLengths) ||
    shipLengths.length === 0 ||
    shipLengths.some((len) => !Number.isInteger(len) || len < 2 || len > boardSize)
  ) {
    throw new Error('invalid_battleship_ship_lengths');
  }

  return {
    boardSize,
    shipLengths: [...shipLengths],
    phase: 'placement',
    nextPlayer: options.startingPlayer ?? 'black',
    status: 'playing',
    winner: null,
    moveCount: 0,
    ships: {
      black: null,
      white: null
    },
    shots: {
      black: createEmptyShots(boardSize),
      white: createEmptyShots(boardSize)
    },
    sunkShips: {
      black: 0,
      white: 0
    },
    lastShot: null
  };
}

export function normalizeBattleshipMove(
  input: BattleshipMoveInput,
  player: BattleshipPlayer
): BattleshipMove {
  if (input.type === 'place_fleet') {
    return {
      type: 'place_fleet',
      ships: input.ships.map((ship) => cloneShip(ship)),
      player
    };
  }

  return {
    type: 'fire',
    x: input.x,
    y: input.y,
    player
  };
}

export function toBattleshipPublicState(
  state: BattleshipRuntimeState,
  viewer: BattleshipPlayer | null,
  revealAll = false
): BattleshipState {
  const canRevealBlack = revealAll || viewer === 'black';
  const canRevealWhite = revealAll || viewer === 'white';

  return {
    boardSize: state.boardSize,
    shipLengths: [...state.shipLengths],
    phase: state.phase,
    nextPlayer: state.nextPlayer,
    status: state.status,
    winner: state.winner,
    moveCount: state.moveCount,
    placementsSubmitted: {
      black: Boolean(state.ships.black),
      white: Boolean(state.ships.white)
    },
    ships: {
      black: canRevealBlack ? cloneFleet(state.ships.black) : null,
      white: canRevealWhite ? cloneFleet(state.ships.white) : null
    },
    shots: {
      black: cloneShots(state.shots.black),
      white: cloneShots(state.shots.white)
    },
    sunkShips: {
      black: state.sunkShips.black,
      white: state.sunkShips.white
    },
    lastShot: state.lastShot
      ? {
          x: state.lastShot.x,
          y: state.lastShot.y,
          player: state.lastShot.player,
          result: state.lastShot.result
        }
      : null
  };
}

export function applyBattleshipMove(
  state: BattleshipRuntimeState,
  move: BattleshipMove
): ApplyBattleshipMoveResult {
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

  if (move.type === 'place_fleet') {
    if (state.phase !== 'placement') {
      return {
        accepted: false,
        nextState: state,
        reason: 'placement_phase_ended'
      };
    }

    if (state.ships[move.player]) {
      return {
        accepted: false,
        nextState: state,
        reason: 'fleet_already_submitted'
      };
    }

    const fleetValidation = validateFleet(state.boardSize, state.shipLengths, move.ships);
    if (!fleetValidation.valid) {
      return {
        accepted: false,
        nextState: state,
        reason: fleetValidation.reason ?? 'invalid_fleet'
      };
    }

    const next: BattleshipRuntimeState = {
      ...state,
      moveCount: state.moveCount + 1,
      ships: {
        black: cloneFleet(state.ships.black),
        white: cloneFleet(state.ships.white)
      },
      shots: {
        black: cloneShots(state.shots.black),
        white: cloneShots(state.shots.white)
      },
      sunkShips: {
        black: state.sunkShips.black,
        white: state.sunkShips.white
      },
      lastShot: state.lastShot
    };

    next.ships[move.player] = move.ships.map((ship) => cloneShip(ship));

    if (next.ships.black && next.ships.white) {
      next.phase = 'playing';
      next.nextPlayer = 'black';
    } else {
      next.nextPlayer = otherPlayer(move.player);
    }

    return {
      accepted: true,
      nextState: next
    };
  }

  if (state.phase !== 'playing') {
    return {
      accepted: false,
      nextState: state,
      reason: 'placement_not_finished'
    };
  }

  if (!isInBounds(state.boardSize, move.x, move.y)) {
    return {
      accepted: false,
      nextState: state,
      reason: 'out_of_bounds'
    };
  }

  const opponent = otherPlayer(move.player);
  const attackerShots = state.shots[move.player];
  if (attackerShots[move.y][move.x] !== 'unknown') {
    return {
      accepted: false,
      nextState: state,
      reason: 'cell_already_targeted'
    };
  }

  const opponentShips = state.ships[opponent];
  if (!opponentShips) {
    return {
      accepted: false,
      nextState: state,
      reason: 'opponent_fleet_missing'
    };
  }

  const hitShip = shipAt(opponentShips, move.x, move.y);
  const resultCell: BattleshipShotCell = hitShip ? 'hit' : 'miss';

  const nextShots = {
    black: cloneShots(state.shots.black),
    white: cloneShots(state.shots.white)
  };
  nextShots[move.player][move.y][move.x] = resultCell;

  const nextSunkShips = {
    black: state.sunkShips.black,
    white: state.sunkShips.white
  };
  const sunkCount = countSunkShips(nextShots[move.player], opponentShips);
  nextSunkShips[move.player] = sunkCount;

  const allSunk = sunkCount >= opponentShips.length;
  const shotResult: 'miss' | 'hit' | 'sunk' =
    hitShip && isShipSunk(nextShots[move.player], hitShip) ? 'sunk' : hitShip ? 'hit' : 'miss';

  const next: BattleshipRuntimeState = {
    ...state,
    moveCount: state.moveCount + 1,
    phase: allSunk ? 'completed' : 'playing',
    status: allSunk ? 'completed' : 'playing',
    winner: allSunk ? move.player : null,
    nextPlayer: allSunk ? move.player : opponent,
    ships: {
      black: cloneFleet(state.ships.black),
      white: cloneFleet(state.ships.white)
    },
    shots: nextShots,
    sunkShips: nextSunkShips,
    lastShot: {
      x: move.x,
      y: move.y,
      player: move.player,
      result: shotResult
    }
  };

  return {
    accepted: true,
    nextState: next
  };
}

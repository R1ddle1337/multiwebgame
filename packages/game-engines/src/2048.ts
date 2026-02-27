import type { Direction2048, Game2048State } from '@multiwebgame/shared-types';

const BOARD_SIZE = 4;

export interface TileSpawn {
  row: number;
  col: number;
  value: number;
}

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
}

function randomEmptyCell(board: number[][], random: () => number): [number, number] | null {
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === 0) {
        cells.push([row, col]);
      }
    }
  }

  if (cells.length === 0) {
    return null;
  }

  const idx = Math.floor(random() * cells.length);
  return cells[idx] ?? null;
}

function spawnTile(
  board: number[][],
  random: () => number,
  forcedSpawn?: TileSpawn | null
): { board: number[][]; spawnedTile: TileSpawn | null } {
  const result = board.map((row) => [...row]);

  if (forcedSpawn) {
    if (
      forcedSpawn.row >= 0 &&
      forcedSpawn.row < BOARD_SIZE &&
      forcedSpawn.col >= 0 &&
      forcedSpawn.col < BOARD_SIZE &&
      result[forcedSpawn.row][forcedSpawn.col] === 0
    ) {
      result[forcedSpawn.row][forcedSpawn.col] = forcedSpawn.value;
      return { board: result, spawnedTile: forcedSpawn };
    }

    return { board: result, spawnedTile: null };
  }

  const target = randomEmptyCell(result, random);
  if (!target) {
    return { board: result, spawnedTile: null };
  }

  const [row, col] = target;
  const value = random() < 0.9 ? 2 : 4;
  result[row][col] = value;

  return {
    board: result,
    spawnedTile: {
      row,
      col,
      value
    }
  };
}

function compressLine(line: number[]): { line: number[]; scoreGain: number; moved: boolean } {
  const nonZero = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let scoreGain = 0;

  for (let i = 0; i < nonZero.length; i += 1) {
    if (nonZero[i] !== 0 && nonZero[i] === nonZero[i + 1]) {
      const value = nonZero[i] * 2;
      merged.push(value);
      scoreGain += value;
      i += 1;
    } else {
      merged.push(nonZero[i]);
    }
  }

  while (merged.length < BOARD_SIZE) {
    merged.push(0);
  }

  const moved = merged.some((value, idx) => value !== line[idx]);
  return { line: merged, scoreGain, moved };
}

function transpose(board: number[][]): number[][] {
  return board[0].map((_, col) => board.map((row) => row[col]));
}

function reverseRows(board: number[][]): number[][] {
  return board.map((row) => [...row].reverse());
}

function canMove(board: number[][]): boolean {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const current = board[row][col];
      if (current === 0) {
        return true;
      }
      if (row + 1 < BOARD_SIZE && board[row + 1][col] === current) {
        return true;
      }
      if (col + 1 < BOARD_SIZE && board[row][col + 1] === current) {
        return true;
      }
    }
  }

  return false;
}

function normalizeDirectionBoard(board: number[][], direction: Direction2048): number[][] {
  if (direction === 'left') {
    return board.map((row) => [...row]);
  }
  if (direction === 'right') {
    return reverseRows(board);
  }
  if (direction === 'up') {
    return transpose(board);
  }
  return reverseRows(transpose(board));
}

function denormalizeDirectionBoard(board: number[][], direction: Direction2048): number[][] {
  if (direction === 'left') {
    return board;
  }
  if (direction === 'right') {
    return reverseRows(board);
  }
  if (direction === 'up') {
    return transpose(board);
  }
  return transpose(reverseRows(board));
}

function inferStatus(board: number[][]): Game2048State['status'] {
  const bestTile = Math.max(...board.flat());
  if (bestTile >= 2048) {
    return 'won';
  }

  return canMove(board) ? 'playing' : 'lost';
}

export function create2048State(random: () => number = Math.random): Game2048State {
  let board = createEmptyBoard();
  board = spawnTile(board, random).board;
  board = spawnTile(board, random).board;
  return {
    board,
    score: 0,
    status: inferStatus(board)
  };
}

export function apply2048Move(
  state: Game2048State,
  direction: Direction2048,
  random: () => number = Math.random,
  forcedSpawn?: TileSpawn | null
): { state: Game2048State; moved: boolean; scoreGain: number; spawnedTile: TileSpawn | null } {
  if (state.status !== 'playing') {
    return {
      state,
      moved: false,
      scoreGain: 0,
      spawnedTile: null
    };
  }

  const normalized = normalizeDirectionBoard(state.board, direction);
  const nextBoard: number[][] = [];
  let moved = false;
  let scoreGain = 0;

  for (const row of normalized) {
    const compressed = compressLine(row);
    nextBoard.push(compressed.line);
    moved = moved || compressed.moved;
    scoreGain += compressed.scoreGain;
  }

  let denormalized = denormalizeDirectionBoard(nextBoard, direction);
  let spawnedTile: TileSpawn | null = null;

  if (moved) {
    const spawned = spawnTile(denormalized, random, forcedSpawn);
    denormalized = spawned.board;
    spawnedTile = spawned.spawnedTile;
  }

  const status = inferStatus(denormalized);

  return {
    moved,
    scoreGain,
    spawnedTile,
    state: {
      board: denormalized,
      score: state.score + scoreGain,
      status
    }
  };
}

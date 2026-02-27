import type {
  GoMove,
  GoPoint,
  GoRuleset,
  GoScoreBreakdown,
  GoState,
  GoStone
} from '@multiwebgame/shared-types';

type GroupInfo = {
  stones: GoPoint[];
  liberties: Set<string>;
};

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

export interface GoStateOptions {
  boardSize?: number;
  ruleset?: GoRuleset;
  komi?: number;
}

function normalizeOptions(input?: number | GoStateOptions): Required<GoStateOptions> {
  if (typeof input === 'number') {
    return {
      boardSize: input,
      ruleset: 'chinese',
      komi: 7.5
    };
  }

  return {
    boardSize: input?.boardSize ?? 19,
    ruleset: input?.ruleset ?? 'chinese',
    komi: input?.komi ?? 7.5
  };
}

function createBoard(boardSize: number): (GoStone | null)[][] {
  return Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => null));
}

function cloneBoard(board: (GoStone | null)[][]): (GoStone | null)[][] {
  return board.map((row) => [...row]);
}

function inBounds(boardSize: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < boardSize && y < boardSize;
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

function otherPlayer(player: GoStone): GoStone {
  return player === 'black' ? 'white' : 'black';
}

function collectGroup(board: (GoStone | null)[][], startX: number, startY: number): GroupInfo {
  const color = board[startY][startX];
  if (color === null) {
    return {
      stones: [],
      liberties: new Set<string>()
    };
  }

  const visited = new Set<string>();
  const stones: GoPoint[] = [];
  const liberties = new Set<string>();
  const stack: Array<[number, number]> = [[startX, startY]];
  const boardSize = board.length;

  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    const key = pointKey(x, y);
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    stones.push({ x, y });

    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;

      if (!inBounds(boardSize, nx, ny)) {
        continue;
      }

      const cell = board[ny][nx];
      if (cell === null) {
        liberties.add(pointKey(nx, ny));
        continue;
      }

      if (cell === color && !visited.has(pointKey(nx, ny))) {
        stack.push([nx, ny]);
      }
    }
  }

  return { stones, liberties };
}

function computeTerritory(board: (GoStone | null)[][]): { black: number; white: number } {
  const boardSize = board.length;
  const visited = new Set<string>();
  let black = 0;
  let white = 0;

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      if (board[y][x] !== null) {
        continue;
      }

      const key = pointKey(x, y);
      if (visited.has(key)) {
        continue;
      }

      const queue: Array<[number, number]> = [[x, y]];
      const region: Array<[number, number]> = [];
      const bordering = new Set<GoStone>();

      while (queue.length > 0) {
        const [cx, cy] = queue.pop() as [number, number];
        const currentKey = pointKey(cx, cy);
        if (visited.has(currentKey)) {
          continue;
        }

        visited.add(currentKey);
        region.push([cx, cy]);

        for (const [dx, dy] of DIRECTIONS) {
          const nx = cx + dx;
          const ny = cy + dy;

          if (!inBounds(boardSize, nx, ny)) {
            continue;
          }

          const cell = board[ny][nx];
          if (cell === null) {
            if (!visited.has(pointKey(nx, ny))) {
              queue.push([nx, ny]);
            }
            continue;
          }

          bordering.add(cell);
        }
      }

      if (bordering.size === 1) {
        const owner = Array.from(bordering)[0];
        if (owner === 'black') {
          black += region.length;
        } else {
          white += region.length;
        }
      }
    }
  }

  return { black, white };
}

function countStones(board: (GoStone | null)[][]): { black: number; white: number } {
  let black = 0;
  let white = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') {
        black += 1;
      } else if (cell === 'white') {
        white += 1;
      }
    }
  }

  return { black, white };
}

export function calculateGoScore(
  state: Pick<GoState, 'board' | 'komi' | 'captures' | 'ruleset'>
): GoScoreBreakdown {
  const stones = countStones(state.board);
  const territory = computeTerritory(state.board);

  const blackTotal = stones.black + territory.black;
  const whiteTotal = stones.white + territory.white + state.komi;

  let winner: GoStone | null = null;
  if (blackTotal > whiteTotal) {
    winner = 'black';
  } else if (whiteTotal > blackTotal) {
    winner = 'white';
  }

  return {
    ruleset: state.ruleset,
    komi: state.komi,
    black: {
      stones: stones.black,
      territory: territory.black,
      captures: state.captures.black,
      total: blackTotal
    },
    white: {
      stones: stones.white,
      territory: territory.white,
      captures: state.captures.white,
      komi: state.komi,
      total: whiteTotal
    },
    winner,
    margin: Number(Math.abs(blackTotal - whiteTotal).toFixed(1))
  };
}

export function createGoState(input?: number | GoStateOptions): GoState {
  const options = normalizeOptions(input);
  return {
    boardSize: options.boardSize,
    board: createBoard(options.boardSize),
    nextPlayer: 'black',
    status: 'playing',
    winner: null,
    moveCount: 0,
    consecutivePasses: 0,
    koPoint: null,
    ruleset: options.ruleset,
    komi: options.komi,
    captures: {
      black: 0,
      white: 0
    },
    scoring: null
  };
}

export function applyGoMove(
  state: GoState,
  move: GoMove
): { nextState: GoState; accepted: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { nextState: state, accepted: false, reason: 'match_is_not_active' };
  }

  if (move.player !== state.nextPlayer) {
    return { nextState: state, accepted: false, reason: 'out_of_turn' };
  }

  if (move.type === 'pass') {
    const consecutivePasses = state.consecutivePasses + 1;
    const completed = consecutivePasses >= 2;
    const scoring = completed ? calculateGoScore(state) : null;

    return {
      accepted: true,
      nextState: {
        ...state,
        nextPlayer: otherPlayer(move.player),
        status: completed ? 'completed' : 'playing',
        winner: scoring?.winner ?? null,
        moveCount: state.moveCount + 1,
        consecutivePasses,
        koPoint: null,
        scoring
      }
    };
  }

  if (!inBounds(state.boardSize, move.x, move.y)) {
    return { nextState: state, accepted: false, reason: 'out_of_bounds' };
  }

  if (state.board[move.y][move.x] !== null) {
    return { nextState: state, accepted: false, reason: 'occupied_cell' };
  }

  if (state.koPoint && state.koPoint.x === move.x && state.koPoint.y === move.y) {
    return { nextState: state, accepted: false, reason: 'ko_violation' };
  }

  const board = cloneBoard(state.board);
  board[move.y][move.x] = move.player;

  const opponent = otherPlayer(move.player);
  const capturedStones: GoPoint[] = [];
  const checkedOpponentStones = new Set<string>();

  for (const [dx, dy] of DIRECTIONS) {
    const nx = move.x + dx;
    const ny = move.y + dy;

    if (!inBounds(state.boardSize, nx, ny)) {
      continue;
    }

    if (board[ny][nx] !== opponent) {
      continue;
    }

    const neighborKey = pointKey(nx, ny);
    if (checkedOpponentStones.has(neighborKey)) {
      continue;
    }

    const group = collectGroup(board, nx, ny);
    for (const stone of group.stones) {
      checkedOpponentStones.add(pointKey(stone.x, stone.y));
    }

    if (group.liberties.size === 0) {
      for (const stone of group.stones) {
        board[stone.y][stone.x] = null;
        capturedStones.push(stone);
      }
    }
  }

  const ownGroup = collectGroup(board, move.x, move.y);
  if (ownGroup.liberties.size === 0) {
    return { nextState: state, accepted: false, reason: 'suicide_move' };
  }

  let koPoint: GoPoint | null = null;
  if (capturedStones.length === 1 && ownGroup.stones.length === 1 && ownGroup.liberties.size === 1) {
    const captured = capturedStones[0];
    koPoint = { x: captured.x, y: captured.y };
  }

  const captures = {
    ...state.captures,
    [move.player]: state.captures[move.player] + capturedStones.length
  };

  return {
    accepted: true,
    nextState: {
      ...state,
      board,
      nextPlayer: opponent,
      status: 'playing',
      winner: null,
      moveCount: state.moveCount + 1,
      consecutivePasses: 0,
      koPoint,
      captures,
      scoring: null
    }
  };
}

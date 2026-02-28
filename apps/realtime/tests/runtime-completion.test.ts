import {
  createConnect4State,
  createDotsState,
  createGoState,
  createGomokuState,
  createReversiState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import { describe, expect, it } from 'vitest';

import { deriveRuntimeCompletion } from '../src/runtime-completion.js';

describe('deriveRuntimeCompletion', () => {
  it('returns null when match is still playing', () => {
    const completion = deriveRuntimeCompletion({
      gameType: 'gomoku',
      state: createGomokuState(15),
      players: {
        black: 'u1',
        white: 'u2'
      }
    });

    expect(completion).toBeNull();
  });

  it('maps gomoku completion to winner and payload', () => {
    const completion = deriveRuntimeCompletion({
      gameType: 'gomoku',
      state: {
        ...createGomokuState(15),
        status: 'completed',
        winner: 'black',
        moveCount: 31
      },
      players: {
        black: 'u1',
        white: 'u2'
      }
    });

    expect(completion).toEqual({
      winnerUserId: 'u1',
      status: 'completed',
      resultPayload: {
        gomoku: {
          ruleset: 'freestyle',
          winner: 'black',
          status: 'completed',
          moveCount: 31
        }
      }
    });
  });

  it('maps go and xiangqi completion to winner and payload', () => {
    const goCompletion = deriveRuntimeCompletion({
      gameType: 'go',
      state: {
        ...createGoState(9),
        status: 'completed',
        winner: 'white',
        moveCount: 80,
        scoring: {
          ruleset: 'chinese',
          komi: 6.5,
          black: {
            stones: 25,
            territory: 20,
            captures: 4,
            total: 49
          },
          white: {
            stones: 24,
            territory: 23,
            captures: 3,
            komi: 6.5,
            total: 56.5
          },
          winner: 'white',
          margin: 7.5
        }
      },
      players: {
        black: 'u1',
        white: 'u2'
      }
    });

    expect(goCompletion).toEqual({
      winnerUserId: 'u2',
      status: 'completed',
      resultPayload: {
        go: {
          ruleset: 'chinese',
          komi: 6.5,
          black: {
            stones: 25,
            territory: 20,
            captures: 4,
            total: 49
          },
          white: {
            stones: 24,
            territory: 23,
            captures: 3,
            komi: 6.5,
            total: 56.5
          },
          winner: 'white',
          margin: 7.5
        }
      }
    });

    const xiangqiCompletion = deriveRuntimeCompletion({
      gameType: 'xiangqi',
      state: {
        ...createXiangqiState(),
        status: 'completed',
        winner: 'red',
        outcomeReason: 'checkmate',
        moveCount: 42
      },
      players: {
        red: 'u3',
        black: 'u4'
      }
    });

    expect(xiangqiCompletion).toEqual({
      winnerUserId: 'u3',
      status: 'completed',
      resultPayload: {
        xiangqi: {
          winner: 'red',
          outcomeReason: 'checkmate',
          moveCount: 42
        }
      }
    });
  });

  it('maps connect4 completion to winner and payload', () => {
    const connect4Completion = deriveRuntimeCompletion({
      gameType: 'connect4',
      state: {
        ...createConnect4State(),
        status: 'completed',
        winner: 'yellow',
        moveCount: 23
      },
      players: {
        red: 'u5',
        yellow: 'u6'
      }
    });

    expect(connect4Completion).toEqual({
      winnerUserId: 'u6',
      status: 'completed',
      resultPayload: {
        connect4: {
          winner: 'yellow',
          status: 'completed',
          moveCount: 23,
          rows: 6,
          columns: 7
        }
      }
    });
  });

  it('maps reversi completion to winner and payload', () => {
    const reversiCompletion = deriveRuntimeCompletion({
      gameType: 'reversi',
      state: {
        ...createReversiState(),
        status: 'completed',
        winner: 'black',
        moveCount: 60,
        counts: {
          black: 40,
          white: 24
        }
      },
      players: {
        black: 'u7',
        white: 'u8'
      }
    });

    expect(reversiCompletion).toEqual({
      winnerUserId: 'u7',
      status: 'completed',
      resultPayload: {
        reversi: {
          winner: 'black',
          status: 'completed',
          moveCount: 60,
          boardSize: 8,
          counts: {
            black: 40,
            white: 24
          }
        }
      }
    });
  });

  it('maps dots completion to winner and payload', () => {
    const dotsCompletion = deriveRuntimeCompletion({
      gameType: 'dots',
      state: {
        ...createDotsState(),
        status: 'completed',
        winner: 'white',
        moveCount: 40,
        scores: {
          black: 6,
          white: 10
        }
      },
      players: {
        black: 'u9',
        white: 'u10'
      }
    });

    expect(dotsCompletion).toEqual({
      winnerUserId: 'u10',
      status: 'completed',
      resultPayload: {
        dots: {
          winner: 'white',
          status: 'completed',
          moveCount: 40,
          dotsX: 5,
          dotsY: 5,
          scores: {
            black: 6,
            white: 10
          }
        }
      }
    });
  });
});

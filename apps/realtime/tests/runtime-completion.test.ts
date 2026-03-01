import {
  assignBackgammonTurnDice,
  createCardsDeck,
  createCardsState,
  createCodenamesDuetRolePool,
  createCodenamesDuetState,
  createCodenamesDuetWordPool,
  createConnect4State,
  createDotsState,
  createHexState,
  createLiarsDiceState,
  createOnitamaState,
  createGoState,
  createBackgammonState,
  createGomokuState,
  createSantoriniState,
  createQuoridorState,
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

  it('maps backgammon completion to winner and payload', () => {
    const completedState = {
      ...assignBackgammonTurnDice(createBackgammonState(), [6, 3]),
      status: 'completed' as const,
      winner: 'white' as const,
      moveCount: 88,
      turnCount: 45,
      rollCount: 45,
      borneOff: {
        white: 15,
        black: 10
      }
    };

    const completion = deriveRuntimeCompletion({
      gameType: 'backgammon',
      state: completedState,
      players: {
        white: 'u11',
        black: 'u12'
      }
    });

    expect(completion).toEqual({
      winnerUserId: 'u11',
      status: 'completed',
      resultPayload: {
        backgammon: {
          winner: 'white',
          moveCount: 88,
          turnCount: 45,
          rollCount: 45,
          borneOff: {
            white: 15,
            black: 10
          }
        }
      }
    });
  });

  it('maps cards completion to winner and payload', () => {
    const completed = createCardsState({
      deck: createCardsDeck()
    });
    completed.status = 'completed';
    completed.winner = 'white';
    completed.moveCount = 27;
    completed.activeSuit = 'spades';

    const completion = deriveRuntimeCompletion({
      gameType: 'cards',
      state: completed,
      players: {
        black: 'u21',
        white: 'u22'
      }
    });

    expect(completion).toEqual({
      winnerUserId: 'u22',
      status: 'completed',
      resultPayload: {
        cards: {
          winner: 'white',
          moveCount: 27,
          handCounts: {
            black: completed.hands.black.length,
            white: completed.hands.white.length
          },
          drawPileCount: completed.drawPile.length,
          discardPileCount: completed.discardPile.length,
          activeSuit: 'spades',
          topCard: completed.discardPile[completed.discardPile.length - 1]
        }
      }
    });
  });

  it('maps codenames duet completion to cooperative payload', () => {
    const state = createCodenamesDuetState({
      words: createCodenamesDuetWordPool().slice(0, 25),
      keyBlack: createCodenamesDuetRolePool(),
      keyWhite: createCodenamesDuetRolePool()
    });
    state.status = 'completed';
    state.outcome = 'success';
    state.moveCount = 18;
    state.turnsRemaining = 2;
    state.revealed = state.revealed.map((_value, index) => index < 9);

    const completion = deriveRuntimeCompletion({
      gameType: 'codenames_duet',
      state,
      players: {
        black: 'u101',
        white: 'u102'
      }
    });

    expect(completion).toEqual({
      winnerUserId: null,
      status: 'completed',
      resultPayload: {
        codenames_duet: {
          outcome: 'success',
          moveCount: 18,
          turnsRemaining: 2,
          targetCounts: {
            total: 9,
            found: 9
          }
        }
      }
    });
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

  it('maps santorini completion to winner and payload', () => {
    const completion = deriveRuntimeCompletion({
      gameType: 'santorini',
      state: {
        ...createSantoriniState(),
        status: 'completed',
        winner: 'white',
        moveCount: 22,
        loserReason: 'no_legal_move'
      },
      players: {
        black: 'u201',
        white: 'u202'
      }
    });

    expect(completion).toEqual({
      winnerUserId: 'u202',
      status: 'completed',
      resultPayload: {
        santorini: {
          winner: 'white',
          moveCount: 22,
          loserReason: 'no_legal_move'
        }
      }
    });
  });

  it('maps onitama completion to winner and payload', () => {
    const base = createOnitamaState({
      openingCards: ['tiger', 'dragon', 'frog', 'rabbit', 'crab']
    });
    const completion = deriveRuntimeCompletion({
      gameType: 'onitama',
      state: {
        ...base,
        status: 'completed',
        winner: 'black',
        moveCount: 19
      },
      players: {
        black: 'u301',
        white: 'u302'
      }
    });

    expect(completion).toEqual({
      winnerUserId: 'u301',
      status: 'completed',
      resultPayload: {
        onitama: {
          winner: 'black',
          moveCount: 19,
          sideCard: 'crab'
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

  it('maps quoridor completion to winner and payload', () => {
    const quoridorCompletion = deriveRuntimeCompletion({
      gameType: 'quoridor',
      state: {
        ...createQuoridorState({
          boardSize: 9,
          wallsPerPlayer: 10
        }),
        status: 'completed',
        winner: 'black',
        moveCount: 51,
        remainingWalls: {
          black: 2,
          white: 1
        }
      },
      players: {
        black: 'u31',
        white: 'u32'
      }
    });

    expect(quoridorCompletion).toEqual({
      winnerUserId: 'u31',
      status: 'completed',
      resultPayload: {
        quoridor: {
          winner: 'black',
          moveCount: 51,
          boardSize: 9,
          remainingWalls: {
            black: 2,
            white: 1
          }
        }
      }
    });
  });

  it('maps hex completion to winner and payload', () => {
    const hexCompletion = deriveRuntimeCompletion({
      gameType: 'hex',
      state: {
        ...createHexState({
          boardSize: 11
        }),
        status: 'completed',
        winner: 'white',
        moveCount: 74
      },
      players: {
        black: 'u41',
        white: 'u42'
      }
    });

    expect(hexCompletion).toEqual({
      winnerUserId: 'u42',
      status: 'completed',
      resultPayload: {
        hex: {
          winner: 'white',
          moveCount: 74,
          boardSize: 11
        }
      }
    });
  });

  it('maps liars_dice completion to winner and payload', () => {
    const liarsDiceState = {
      ...createLiarsDiceState({
        dicePerPlayer: 5,
        rollDie: () => 1
      }),
      status: 'completed' as const,
      winner: 'black' as const,
      moveCount: 18,
      diceCounts: {
        black: 1,
        white: 0
      },
      roundHistory: [
        {
          round: 1,
          starter: 'black' as const,
          bids: [
            {
              quantity: 3,
              face: 2,
              player: 'black' as const
            }
          ],
          caller: 'white' as const,
          calledBid: {
            quantity: 3,
            face: 2,
            player: 'black' as const
          },
          totalMatching: 2,
          wasLiar: true,
          loser: 'black' as const,
          dice: {
            black: [1, 2, 3, 4, 5],
            white: [1, 1, 1, 2, 2]
          }
        }
      ]
    };

    const liarsCompletion = deriveRuntimeCompletion({
      gameType: 'liars_dice',
      state: liarsDiceState,
      players: {
        black: 'u51',
        white: 'u52'
      }
    });

    expect(liarsCompletion).toEqual({
      winnerUserId: 'u51',
      status: 'completed',
      resultPayload: {
        liars_dice: {
          winner: 'black',
          moveCount: 18,
          diceCounts: {
            black: 1,
            white: 0
          },
          rounds: liarsDiceState.roundHistory
        }
      }
    });
  });
});

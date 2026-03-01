import type { CardsRuntimeState, LiarsDiceRuntimeState } from '@multiwebgame/game-engines';
import type {
  BackgammonState,
  Connect4State,
  DotsState,
  HexState,
  GoState,
  GomokuState,
  QuoridorState,
  ReversiState,
  XiangqiState
} from '@multiwebgame/shared-types';

export type RuntimeCompletionSnapshot =
  | {
      gameType: 'backgammon';
      state: BackgammonState;
      players: {
        white: string;
        black: string;
      };
    }
  | {
      gameType: 'cards';
      state: CardsRuntimeState | null;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'gomoku';
      state: GomokuState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'connect4';
      state: Connect4State;
      players: {
        red: string;
        yellow: string;
      };
    }
  | {
      gameType: 'reversi';
      state: ReversiState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'dots';
      state: DotsState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'go';
      state: GoState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'quoridor';
      state: QuoridorState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'hex';
      state: HexState;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'liars_dice';
      state: LiarsDiceRuntimeState | null;
      players: {
        black: string;
        white: string;
      };
    }
  | {
      gameType: 'xiangqi';
      state: XiangqiState;
      players: {
        red: string;
        black: string;
      };
    };

export interface RuntimeCompletion {
  winnerUserId: string | null;
  status: 'completed';
  resultPayload: Record<string, unknown> | null;
}

export function deriveRuntimeCompletion(runtime: RuntimeCompletionSnapshot): RuntimeCompletion | null {
  if (runtime.gameType === 'backgammon') {
    if (runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'white'
        ? runtime.players.white
        : runtime.state.winner === 'black'
          ? runtime.players.black
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        backgammon: {
          winner: runtime.state.winner,
          moveCount: runtime.state.moveCount,
          turnCount: runtime.state.turnCount,
          rollCount: runtime.state.rollCount,
          borneOff: runtime.state.borneOff
        }
      }
    };
  }

  if (runtime.gameType === 'cards') {
    if (!runtime.state || runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    const topCard = runtime.state.discardPile[runtime.state.discardPile.length - 1] ?? null;
    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        cards: {
          winner: runtime.state.winner,
          moveCount: runtime.state.moveCount,
          handCounts: {
            black: runtime.state.hands.black.length,
            white: runtime.state.hands.white.length
          },
          drawPileCount: runtime.state.drawPile.length,
          discardPileCount: runtime.state.discardPile.length,
          activeSuit: runtime.state.activeSuit,
          topCard
        }
      }
    };
  }

  if (runtime.gameType === 'gomoku') {
    if (runtime.state.status !== 'completed' && runtime.state.status !== 'draw') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        gomoku: {
          ruleset: runtime.state.ruleset,
          winner: runtime.state.winner,
          status: runtime.state.status,
          moveCount: runtime.state.moveCount
        }
      }
    };
  }

  if (runtime.gameType === 'go') {
    if (runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: runtime.state.scoring ? { go: runtime.state.scoring } : null
    };
  }

  if (runtime.gameType === 'connect4') {
    if (runtime.state.status !== 'completed' && runtime.state.status !== 'draw') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'red'
        ? runtime.players.red
        : runtime.state.winner === 'yellow'
          ? runtime.players.yellow
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        connect4: {
          winner: runtime.state.winner,
          status: runtime.state.status,
          moveCount: runtime.state.moveCount,
          rows: runtime.state.rows,
          columns: runtime.state.columns
        }
      }
    };
  }

  if (runtime.gameType === 'reversi') {
    if (runtime.state.status !== 'completed' && runtime.state.status !== 'draw') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        reversi: {
          winner: runtime.state.winner,
          status: runtime.state.status,
          moveCount: runtime.state.moveCount,
          boardSize: runtime.state.boardSize,
          counts: runtime.state.counts
        }
      }
    };
  }

  if (runtime.gameType === 'dots') {
    if (runtime.state.status !== 'completed' && runtime.state.status !== 'draw') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        dots: {
          winner: runtime.state.winner,
          status: runtime.state.status,
          moveCount: runtime.state.moveCount,
          dotsX: runtime.state.dotsX,
          dotsY: runtime.state.dotsY,
          scores: runtime.state.scores
        }
      }
    };
  }

  if (runtime.gameType === 'quoridor') {
    if (runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        quoridor: {
          winner: runtime.state.winner,
          moveCount: runtime.state.moveCount,
          boardSize: runtime.state.boardSize,
          remainingWalls: runtime.state.remainingWalls
        }
      }
    };
  }

  if (runtime.gameType === 'hex') {
    if (runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        hex: {
          winner: runtime.state.winner,
          moveCount: runtime.state.moveCount,
          boardSize: runtime.state.boardSize
        }
      }
    };
  }

  if (runtime.gameType === 'liars_dice') {
    if (!runtime.state || runtime.state.status !== 'completed') {
      return null;
    }

    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    return {
      winnerUserId,
      status: 'completed',
      resultPayload: {
        liars_dice: {
          winner: runtime.state.winner,
          moveCount: runtime.state.moveCount,
          diceCounts: runtime.state.diceCounts,
          rounds: runtime.state.roundHistory
        }
      }
    };
  }

  if (runtime.state.status !== 'completed') {
    return null;
  }

  const winnerUserId =
    runtime.state.winner === 'red'
      ? runtime.players.red
      : runtime.state.winner === 'black'
        ? runtime.players.black
        : null;

  return {
    winnerUserId,
    status: 'completed',
    resultPayload: {
      xiangqi: {
        winner: runtime.state.winner,
        outcomeReason: runtime.state.outcomeReason,
        moveCount: runtime.state.moveCount
      }
    }
  };
}

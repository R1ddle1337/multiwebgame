import type {
  Connect4State,
  GoState,
  GomokuState,
  ReversiState,
  XiangqiState
} from '@multiwebgame/shared-types';

export type RuntimeCompletionSnapshot =
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
      gameType: 'go';
      state: GoState;
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

import type {
  Connect4Move,
  DotsMove,
  GoMove,
  GomokuMove,
  HexMove,
  QuoridorMove,
  ReversiMove,
  XiangqiMove,
  XiangqiPosition
} from '@multiwebgame/shared-types';

export type XiangqiPerspective = 'red' | 'black';

export type LastMoveActor = 'black' | 'white' | 'red' | 'yellow';

export type LastMoveAction =
  | {
      kind: 'place';
      point: string;
    }
  | {
      kind: 'pass';
    }
  | {
      kind: 'move';
      from: string;
      to: string;
    };

export interface LastMoveSummary {
  actor: LastMoveActor;
  action: LastMoveAction;
}

export function didTurnSwitchToCurrent(previousCanPlay: boolean, nextCanPlay: boolean): boolean {
  return !previousCanPlay && nextCanPlay;
}

function formatBoardPoint(x: number, y: number): string {
  return `${x + 1},${y + 1}`;
}

export function orientXiangqiPosition(
  position: XiangqiPosition,
  perspective: XiangqiPerspective
): XiangqiPosition {
  if (perspective === 'black') {
    return {
      x: 8 - position.x,
      y: 9 - position.y
    };
  }

  return position;
}

function formatXiangqiPoint(position: XiangqiPosition, perspective: XiangqiPerspective): string {
  const oriented = orientXiangqiPosition(position, perspective);
  return formatBoardPoint(oriented.x, oriented.y);
}

export function describeLastMove(
  gameType: 'gomoku',
  move: GomokuMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'connect4',
  move: Connect4Move,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'go',
  move: GoMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'reversi',
  move: ReversiMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'dots',
  move: DotsMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'hex',
  move: HexMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'quoridor',
  move: QuoridorMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'xiangqi',
  move: XiangqiMove,
  xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'gomoku' | 'connect4' | 'go' | 'reversi' | 'dots' | 'hex' | 'quoridor' | 'xiangqi',
  move: GomokuMove | Connect4Move | GoMove | ReversiMove | DotsMove | HexMove | QuoridorMove | XiangqiMove,
  xiangqiPerspective: XiangqiPerspective = 'red'
): LastMoveSummary {
  if (gameType === 'gomoku') {
    const gomokuMove = move as GomokuMove;
    return {
      actor: gomokuMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(gomokuMove.x, gomokuMove.y)
      }
    };
  }

  if (gameType === 'connect4') {
    const connect4Move = move as Connect4Move;
    return {
      actor: connect4Move.player,
      action: {
        kind: 'place',
        point: `C${connect4Move.column + 1}`
      }
    };
  }

  if (gameType === 'go') {
    const goMove = move as GoMove;
    if (goMove.type === 'pass') {
      return {
        actor: goMove.player,
        action: { kind: 'pass' }
      };
    }

    return {
      actor: goMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(goMove.x, goMove.y)
      }
    };
  }

  if (gameType === 'reversi') {
    const reversiMove = move as ReversiMove;
    return {
      actor: reversiMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(reversiMove.x, reversiMove.y)
      }
    };
  }

  if (gameType === 'dots') {
    const dotsMove = move as DotsMove;
    const from =
      dotsMove.orientation === 'h'
        ? formatBoardPoint(dotsMove.x, dotsMove.y)
        : formatBoardPoint(dotsMove.x, dotsMove.y);
    const to =
      dotsMove.orientation === 'h'
        ? formatBoardPoint(dotsMove.x + 1, dotsMove.y)
        : formatBoardPoint(dotsMove.x, dotsMove.y + 1);

    return {
      actor: dotsMove.player,
      action: {
        kind: 'move',
        from,
        to
      }
    };
  }

  if (gameType === 'hex') {
    const hexMove = move as HexMove;
    return {
      actor: hexMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(hexMove.x, hexMove.y)
      }
    };
  }

  if (gameType === 'quoridor') {
    const quoridorMove = move as QuoridorMove;
    if (quoridorMove.type === 'pawn') {
      return {
        actor: quoridorMove.player,
        action: {
          kind: 'place',
          point: formatBoardPoint(quoridorMove.x, quoridorMove.y)
        }
      };
    }

    const from =
      quoridorMove.orientation === 'h'
        ? formatBoardPoint(quoridorMove.x, quoridorMove.y)
        : formatBoardPoint(quoridorMove.x, quoridorMove.y);
    const to =
      quoridorMove.orientation === 'h'
        ? formatBoardPoint(quoridorMove.x + 1, quoridorMove.y)
        : formatBoardPoint(quoridorMove.x, quoridorMove.y + 1);

    return {
      actor: quoridorMove.player,
      action: {
        kind: 'move',
        from,
        to
      }
    };
  }

  const xiangqiMove = move as XiangqiMove;
  return {
    actor: xiangqiMove.player,
    action: {
      kind: 'move',
      from: formatXiangqiPoint(xiangqiMove.from, xiangqiPerspective),
      to: formatXiangqiPoint(xiangqiMove.to, xiangqiPerspective)
    }
  };
}

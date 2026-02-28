import type { GoMove, GomokuMove, XiangqiMove, XiangqiPosition } from '@multiwebgame/shared-types';

export type XiangqiPerspective = 'red' | 'black';

export type LastMoveActor = 'black' | 'white' | 'red';

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
  gameType: 'go',
  move: GoMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'xiangqi',
  move: XiangqiMove,
  xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'gomoku' | 'go' | 'xiangqi',
  move: GomokuMove | GoMove | XiangqiMove,
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

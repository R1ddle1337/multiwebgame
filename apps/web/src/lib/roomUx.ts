import type {
  BattleshipMove,
  CodenamesDuetMove,
  Connect4Move,
  DominationMove,
  DotsMove,
  GoMove,
  GomokuMove,
  HexMove,
  LoveLetterMove,
  OnitamaMove,
  SantoriniMove,
  QuoridorMove,
  ReversiMove,
  YahtzeeMove,
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
  gameType: 'santorini',
  move: SantoriniMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'onitama',
  move: OnitamaMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'battleship',
  move: BattleshipMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'yahtzee',
  move: YahtzeeMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'domination',
  move: DominationMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'love_letter',
  move: LoveLetterMove,
  _xiangqiPerspective?: XiangqiPerspective
): LastMoveSummary;
export function describeLastMove(
  gameType: 'codenames_duet',
  move: CodenamesDuetMove,
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
  gameType:
    | 'gomoku'
    | 'connect4'
    | 'santorini'
    | 'onitama'
    | 'battleship'
    | 'yahtzee'
    | 'domination'
    | 'love_letter'
    | 'codenames_duet'
    | 'go'
    | 'reversi'
    | 'dots'
    | 'hex'
    | 'quoridor'
    | 'xiangqi',
  move:
    | GomokuMove
    | Connect4Move
    | SantoriniMove
    | OnitamaMove
    | BattleshipMove
    | YahtzeeMove
    | DominationMove
    | LoveLetterMove
    | CodenamesDuetMove
    | GoMove
    | ReversiMove
    | DotsMove
    | HexMove
    | QuoridorMove
    | XiangqiMove,
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

  if (gameType === 'santorini') {
    const santoriniMove = move as SantoriniMove;
    if (santoriniMove.type === 'place') {
      return {
        actor: santoriniMove.player,
        action: {
          kind: 'place',
          point: formatBoardPoint(santoriniMove.x, santoriniMove.y)
        }
      };
    }

    const from = `${santoriniMove.worker.toUpperCase()}:${formatBoardPoint(
      santoriniMove.to.x,
      santoriniMove.to.y
    )}`;
    const to = `B:${formatBoardPoint(santoriniMove.build.x, santoriniMove.build.y)}`;
    return {
      actor: santoriniMove.player,
      action: {
        kind: 'move',
        from,
        to
      }
    };
  }

  if (gameType === 'onitama') {
    const onitamaMove = move as OnitamaMove;
    return {
      actor: onitamaMove.player,
      action: {
        kind: 'move',
        from: formatBoardPoint(onitamaMove.from.x, onitamaMove.from.y),
        to: formatBoardPoint(onitamaMove.to.x, onitamaMove.to.y)
      }
    };
  }

  if (gameType === 'battleship') {
    const battleshipMove = move as BattleshipMove;
    if (battleshipMove.type === 'place_fleet') {
      return {
        actor: battleshipMove.player,
        action: {
          kind: 'move',
          from: 'fleet',
          to: String(battleshipMove.ships.length)
        }
      };
    }

    return {
      actor: battleshipMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(battleshipMove.x, battleshipMove.y)
      }
    };
  }

  if (gameType === 'yahtzee') {
    const yahtzeeMove = move as YahtzeeMove;
    if (yahtzeeMove.type === 'roll') {
      return {
        actor: yahtzeeMove.player,
        action: {
          kind: 'move',
          from: 'roll',
          to: yahtzeeMove.hold ? String(yahtzeeMove.hold.filter(Boolean).length) : '0'
        }
      };
    }

    return {
      actor: yahtzeeMove.player,
      action: {
        kind: 'move',
        from: 'score',
        to: yahtzeeMove.category
      }
    };
  }

  if (gameType === 'domination') {
    const dominationMove = move as DominationMove;
    return {
      actor: dominationMove.player,
      action: {
        kind: 'place',
        point: formatBoardPoint(dominationMove.x, dominationMove.y)
      }
    };
  }

  if (gameType === 'love_letter') {
    const loveLetterMove = move as LoveLetterMove;
    return {
      actor: loveLetterMove.player,
      action: {
        kind: 'move',
        from: loveLetterMove.card,
        to: loveLetterMove.target ?? '-'
      }
    };
  }

  if (gameType === 'codenames_duet') {
    const codenamesMove = move as CodenamesDuetMove;
    if (codenamesMove.type === 'clue') {
      return {
        actor: codenamesMove.player,
        action: {
          kind: 'move',
          from: codenamesMove.word,
          to: String(codenamesMove.count)
        }
      };
    }

    if (codenamesMove.type === 'guess') {
      return {
        actor: codenamesMove.player,
        action: {
          kind: 'place',
          point: `#${codenamesMove.index + 1}`
        }
      };
    }

    return {
      actor: codenamesMove.player,
      action: { kind: 'pass' }
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

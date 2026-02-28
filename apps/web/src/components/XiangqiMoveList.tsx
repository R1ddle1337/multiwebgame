import type { XiangqiColor, XiangqiMove } from '@multiwebgame/shared-types';
import React, { useMemo } from 'react';

export interface XiangqiReplayMoveLogEntry {
  ply: number;
  player: XiangqiColor;
  move: XiangqiMove;
  notation: string;
}

interface XiangqiMoveRound {
  round: number;
  red?: XiangqiReplayMoveLogEntry;
  black?: XiangqiReplayMoveLogEntry;
}

interface XiangqiMoveListLabels {
  title: string;
  round: string;
  red: string;
  black: string;
  empty: string;
}

interface Props {
  entries: XiangqiReplayMoveLogEntry[];
  currentPly: number;
  labels: XiangqiMoveListLabels;
  onSelectPly?: (ply: number) => void;
}

function toRounds(entries: XiangqiReplayMoveLogEntry[]): XiangqiMoveRound[] {
  const rounds = new Map<number, XiangqiMoveRound>();

  for (const entry of entries) {
    const round = Math.floor((entry.ply - 1) / 2) + 1;
    const current = rounds.get(round) ?? { round };
    if (entry.player === 'red') {
      current.red = entry;
    } else {
      current.black = entry;
    }
    rounds.set(round, current);
  }

  return Array.from(rounds.values()).sort((a, b) => a.round - b.round);
}

function entryStateClass(entry: XiangqiReplayMoveLogEntry | undefined, currentPly: number): string {
  if (!entry) {
    return 'empty';
  }
  if (entry.ply === currentPly) {
    return 'current';
  }
  return entry.ply < currentPly ? 'played' : 'pending';
}

function MoveCell({
  entry,
  currentPly,
  onSelectPly,
  emptyLabel
}: {
  entry?: XiangqiReplayMoveLogEntry;
  currentPly: number;
  onSelectPly?: (ply: number) => void;
  emptyLabel: string;
}) {
  const stateClass = entryStateClass(entry, currentPly);

  if (!entry) {
    return <span className={`xiangqi-move-chip ${stateClass}`}>{emptyLabel}</span>;
  }

  if (!onSelectPly) {
    return <span className={`xiangqi-move-chip ${stateClass}`}>{entry.notation}</span>;
  }

  return (
    <button
      type="button"
      className={`xiangqi-move-chip ${stateClass}`}
      onClick={() => {
        onSelectPly(entry.ply);
      }}
    >
      {entry.notation}
    </button>
  );
}

export function XiangqiMoveList({ entries, currentPly, labels, onSelectPly }: Props) {
  const rounds = useMemo(() => toRounds(entries), [entries]);

  return (
    <section className="xiangqi-move-log">
      <h3>{labels.title}</h3>
      <table>
        <thead>
          <tr>
            <th>{labels.round}</th>
            <th>{labels.red}</th>
            <th>{labels.black}</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((round) => (
            <tr key={round.round}>
              <td className="round-number">{round.round}</td>
              <td>
                <MoveCell
                  entry={round.red}
                  currentPly={currentPly}
                  onSelectPly={onSelectPly}
                  emptyLabel={labels.empty}
                />
              </td>
              <td>
                <MoveCell
                  entry={round.black}
                  currentPly={currentPly}
                  onSelectPly={onSelectPly}
                  emptyLabel={labels.empty}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

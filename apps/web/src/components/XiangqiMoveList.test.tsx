import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { XiangqiMoveList, type XiangqiReplayMoveLogEntry } from './XiangqiMoveList';

describe('XiangqiMoveList', () => {
  it('renders paired red/black rounds and highlights current ply', () => {
    const entries: XiangqiReplayMoveLogEntry[] = [
      {
        ply: 1,
        player: 'red',
        notation: '炮二平五',
        move: {
          from: { x: 7, y: 7 },
          to: { x: 4, y: 7 },
          player: 'red'
        }
      },
      {
        ply: 2,
        player: 'black',
        notation: '马８进７',
        move: {
          from: { x: 7, y: 0 },
          to: { x: 6, y: 2 },
          player: 'black'
        }
      },
      {
        ply: 3,
        player: 'red',
        notation: '车九进一',
        move: {
          from: { x: 0, y: 9 },
          to: { x: 0, y: 8 },
          player: 'red'
        }
      }
    ];

    const html = renderToStaticMarkup(
      <XiangqiMoveList
        entries={entries}
        currentPly={2}
        labels={{
          title: '着法列表',
          round: '回合',
          red: '红方',
          black: '黑方',
          empty: '—'
        }}
      />
    );

    expect(html).toMatchInlineSnapshot(
      `"<section class="xiangqi-move-log"><h3>着法列表</h3><table><thead><tr><th>回合</th><th>红方</th><th>黑方</th></tr></thead><tbody><tr><td class="round-number">1</td><td><span class="xiangqi-move-chip played">炮二平五</span></td><td><span class="xiangqi-move-chip current">马８进７</span></td></tr><tr><td class="round-number">2</td><td><span class="xiangqi-move-chip pending">车九进一</span></td><td><span class="xiangqi-move-chip empty">—</span></td></tr></tbody></table></section>"`
    );
  });
});

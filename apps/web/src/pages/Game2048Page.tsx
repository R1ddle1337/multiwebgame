import { apply2048Move, create2048State } from '@multiwebgame/game-engines';
import type { Direction2048, Game2048State } from '@multiwebgame/shared-types';
import React, { useEffect, useState } from 'react';

const controls: Array<{ key: string; direction: Direction2048 }> = [
  { key: 'ArrowUp', direction: 'up' },
  { key: 'ArrowDown', direction: 'down' },
  { key: 'ArrowLeft', direction: 'left' },
  { key: 'ArrowRight', direction: 'right' }
];

export function Game2048Page() {
  const [state, setState] = useState<Game2048State>(() => create2048State());

  const move = (direction: Direction2048) => {
    setState((current) => {
      const next = apply2048Move(current, direction);
      return next.moved ? next.state : current;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const control = controls.find((item) => item.key === event.key);
      if (!control) {
        return;
      }
      event.preventDefault();
      move(control.direction);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="panel game-2048">
      <h2>2048</h2>
      <p>
        Use arrow keys or buttons. Score: <strong>{state.score}</strong> • Status: <strong>{state.status}</strong>
      </p>

      <div className="tile-grid">
        {state.board.flat().map((cell, index) => (
          <div key={index} className={`tile tile-${cell || 'empty'}`}>
            {cell || ''}
          </div>
        ))}
      </div>

      <div className="controls-grid">
        <button type="button" onClick={() => move('up')}>
          Up
        </button>
        <button type="button" onClick={() => move('left')}>
          Left
        </button>
        <button type="button" onClick={() => move('right')}>
          Right
        </button>
        <button type="button" onClick={() => move('down')}>
          Down
        </button>
        <button type="button" className="secondary" onClick={() => setState(create2048State())}>
          Restart
        </button>
      </div>
    </main>
  );
}

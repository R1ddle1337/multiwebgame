import { applyGomokuMove, createGomokuState } from '@multiwebgame/game-engines';
import type { GomokuMark, GomokuState } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { GomokuBoard } from '../components/GomokuBoard';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
}

export function ReplayPage({ api }: Props) {
  const { matchId = '' } = useParams();
  const [states, setStates] = useState<GomokuState[]>([createGomokuState(15)]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api
      .getMatch(matchId)
      .then((result) => {
        if (!active) {
          return;
        }

        let current = createGomokuState(15);
        const snapshots: GomokuState[] = [current];

        for (const move of result.match.moves) {
          const payload = move.payload as { x?: number; y?: number; player?: GomokuMark };
          if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
            continue;
          }

          const applied = applyGomokuMove(current, {
            x: payload.x,
            y: payload.y,
            player: payload.player ?? current.nextPlayer
          });

          current = applied.nextState;
          snapshots.push(current);
        }

        setStates(snapshots);
        setStep(snapshots.length - 1);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load replay');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, matchId]);

  const current = useMemo(() => states[Math.min(step, states.length - 1)] ?? createGomokuState(15), [states, step]);

  if (loading) {
    return <main className="panel">Loading replay...</main>;
  }

  if (error) {
    return <main className="panel error-text">{error}</main>;
  }

  return (
    <main className="panel">
      <h2>Replay {matchId.slice(0, 8)}</h2>
      <p>
        Step {step}/{Math.max(0, states.length - 1)}
      </p>
      <input
        type="range"
        min={0}
        max={Math.max(0, states.length - 1)}
        value={step}
        onChange={(event) => setStep(Number(event.target.value))}
      />
      <GomokuBoard state={current} disabled />
    </main>
  );
}

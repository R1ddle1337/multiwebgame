import type { UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { ApiClient, storage } from './lib/api';
import { Game2048Page } from './pages/Game2048Page';
import { LobbyPage } from './pages/LobbyPage';
import { ReplayPage } from './pages/ReplayPage';
import { RoomPage } from './pages/RoomPage';

function AuthGate({ onAuth }: { onAuth: (token: string, user: UserDTO) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => new ApiClient(null), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const result = await api.authGuest(displayName.trim() || undefined);
      onAuth(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <h1>Multi Web Game</h1>
        <p>Start instantly with a guest account. You can invite, queue, and play in under a minute.</p>
        <form onSubmit={submit}>
          <label htmlFor="display-name">Display Name</label>
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Guest-Name"
            maxLength={24}
          />
          <button type="submit">Enter Lobby</button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}

function Shell({ user, token, onLogout }: { user: UserDTO; token: string; onLogout: () => void }) {
  const api = useMemo(() => new ApiClient(token), [token]);
  const navigate = useNavigate();
  const realtime = useRealtime();

  useEffect(() => {
    if (realtime.matchedRoom) {
      navigate(`/rooms/${realtime.matchedRoom.room.id}`);
      realtime.clearMatchedRoom();
    }
  }, [navigate, realtime]);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <strong>{user.displayName}</strong>
          <span className="status-pill">Rating {user.rating}</span>
          <span className={`status-pill ${realtime.status}`}>{realtime.status}</span>
        </div>
        <nav>
          <Link to="/">Lobby</Link>
          <Link to="/game/2048">2048</Link>
          <button type="button" className="ghost" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<LobbyPage api={api} user={user} />} />
        <Route path="/rooms/:roomId" element={<RoomPage api={api} user={user} />} />
        <Route path="/game/2048" element={<Game2048Page />} />
        <Route path="/matches/:matchId/replay" element={<ReplayPage api={api} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let active = true;
    const api = new ApiClient(token);

    api
      .me()
      .then((result) => {
        if (!active) {
          return;
        }
        setUser(result.user);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        storage.setToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!token || !user) {
    if (loading) {
      return <main className="auth-gate">Loading session...</main>;
    }

    return (
      <AuthGate
        onAuth={(nextToken, nextUser) => {
          storage.setToken(nextToken);
          setToken(nextToken);
          setUser(nextUser);
        }}
      />
    );
  }

  return (
    <RealtimeProvider token={token} user={user}>
      <Shell
        user={user}
        token={token}
        onLogout={() => {
          storage.setToken(null);
          storage.setReconnectKey(null);
          setToken(null);
          setUser(null);
        }}
      />
    </RealtimeProvider>
  );
}

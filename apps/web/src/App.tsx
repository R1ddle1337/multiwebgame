import type { UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { ApiClient, storage } from './lib/api';
import { Game2048Page } from './pages/Game2048Page';
import { LobbyPage } from './pages/LobbyPage';
import { ReplayPage } from './pages/ReplayPage';
import { RoomPage } from './pages/RoomPage';
import { TrainingPage } from './pages/TrainingPage';

function AuthGate({ onAuth }: { onAuth: (token: string, user: UserDTO) => void }) {
  const [mode, setMode] = useState<'guest' | 'login' | 'register'>('guest');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => new ApiClient(null), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === 'guest') {
        const result = await api.authGuest(displayName.trim() || undefined);
        onAuth(result.token, result.user);
        return;
      }

      if (mode === 'login') {
        const result = await api.authLogin({
          email: email.trim(),
          password
        });
        onAuth(result.token, result.user);
        return;
      }

      const result = await api.authRegister({
        displayName: displayName.trim(),
        email: email.trim(),
        password
      });
      onAuth(result.token, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <h1>Multi Web Game</h1>
        <p>Guest entry, optional credentials, realtime rooms, spectators, and training mode.</p>

        <div className="button-row">
          <button
            type="button"
            className={mode === 'guest' ? '' : 'secondary'}
            onClick={() => setMode('guest')}
          >
            Guest
          </button>
          <button
            type="button"
            className={mode === 'login' ? '' : 'secondary'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? '' : 'secondary'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit}>
          {mode !== 'login' ? (
            <>
              <label htmlFor="display-name">Display Name</label>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Player Name"
                maxLength={24}
              />
            </>
          ) : null}

          {mode !== 'guest' ? (
            <>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
              />
            </>
          ) : null}

          <button type="submit">
            {mode === 'guest' ? 'Enter Lobby' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}

function Shell({
  user,
  token,
  onLogout,
  onUserUpdate
}: {
  user: UserDTO;
  token: string;
  onLogout: () => void;
  onUserUpdate: (user: UserDTO) => void;
}) {
  const api = useMemo(() => new ApiClient(token), [token]);
  const navigate = useNavigate();
  const realtime = useRealtime();
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
          <span className="status-pill">Gomoku {user.ratings.gomoku ?? 1200}</span>
          <span className="status-pill">Go {user.ratings.go ?? 1200}</span>
          <span className="status-pill">Xiangqi {user.ratings.xiangqi ?? 1200}</span>
          <span className={`status-pill ${realtime.status}`}>{realtime.status}</span>
        </div>
        <nav>
          <Link to="/">Lobby</Link>
          <Link to="/training">Training</Link>
          <Link to="/game/2048">2048</Link>
          <button type="button" className="ghost" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </header>

      {user.isGuest ? (
        <section className="panel upgrade-panel">
          <h3>Upgrade Guest Account</h3>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              setUpgradeError(null);
              setUpgrading(true);

              api
                .upgradeGuest({
                  displayName: displayName.trim(),
                  email: email.trim(),
                  password
                })
                .then((result) => {
                  onUserUpdate(result.user);
                  setEmail('');
                  setPassword('');
                })
                .catch((err) => setUpgradeError(err instanceof Error ? err.message : 'Upgrade failed'))
                .finally(() => setUpgrading(false));
            }}
          >
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
            <button type="submit" disabled={upgrading}>
              {upgrading ? 'Upgrading...' : 'Upgrade'}
            </button>
          </form>
          {upgradeError ? <p className="error-text">{upgradeError}</p> : null}
        </section>
      ) : null}

      <Routes>
        <Route path="/" element={<LobbyPage api={api} user={user} />} />
        <Route path="/rooms/:roomId" element={<RoomPage api={api} user={user} />} />
        <Route path="/training" element={<TrainingPage />} />
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
        onUserUpdate={(nextUser) => setUser(nextUser)}
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

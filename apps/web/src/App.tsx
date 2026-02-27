import type { UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { LanguageSwitcher, useI18n } from './context/I18nContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { ApiClient, storage } from './lib/api';
import { Game2048Page } from './pages/Game2048Page';
import { LobbyPage } from './pages/LobbyPage';
import { ReplayPage } from './pages/ReplayPage';
import { RoomPage } from './pages/RoomPage';
import { TrainingPage } from './pages/TrainingPage';

function AuthGate({ onAuth }: { onAuth: (token: string, user: UserDTO) => void }) {
  const { t, translateError } = useI18n();
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
      const message = err instanceof Error ? err.message : t('error.auth_failed');
      if (message.includes('Failed to fetch') || message.includes('Network') || message.includes('CORS')) {
        storage.setToken(null);
        storage.setReconnectKey(null);
        setError(t('auth.network_reset'));
      } else {
        setError(translateError(message));
      }
    }
  };

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <LanguageSwitcher />
        <h1>{t('auth.title')}</h1>
        <p>{t('auth.subtitle')}</p>

        <div className="button-row">
          <button
            type="button"
            className={mode === 'guest' ? '' : 'secondary'}
            onClick={() => setMode('guest')}
          >
            {t('auth.mode.guest')}
          </button>
          <button
            type="button"
            className={mode === 'login' ? '' : 'secondary'}
            onClick={() => setMode('login')}
          >
            {t('auth.mode.login')}
          </button>
          <button
            type="button"
            className={mode === 'register' ? '' : 'secondary'}
            onClick={() => setMode('register')}
          >
            {t('auth.mode.register')}
          </button>
        </div>

        <form onSubmit={submit}>
          {mode !== 'login' ? (
            <>
              <label htmlFor="display-name">{t('auth.display_name')}</label>
              <input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('auth.display_name_placeholder')}
                maxLength={24}
              />
            </>
          ) : null}

          {mode !== 'guest' ? (
            <>
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.email_placeholder')}
              />
              <label htmlFor="password">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('auth.password_placeholder')}
              />
            </>
          ) : null}

          <button type="submit">
            {mode === 'guest'
              ? t('auth.submit.guest')
              : mode === 'login'
                ? t('auth.submit.login')
                : t('auth.submit.register')}
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
  const { t, translateError } = useI18n();
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
          {user.isAdmin ? <span className="status-pill">Admin</span> : null}
          <span className="status-pill">
            {t('enum.game.gomoku')} {user.ratings.gomoku ?? 1200}
          </span>
          <span className="status-pill">
            {t('enum.game.go')} {user.ratings.go ?? 1200}
          </span>
          <span className="status-pill">
            {t('enum.game.xiangqi')} {user.ratings.xiangqi ?? 1200}
          </span>
          <span className={`status-pill ${realtime.status}`}>{t(`common.status.${realtime.status}`)}</span>
        </div>
        <nav>
          <Link to="/">{t('shell.nav.lobby')}</Link>
          <Link to="/training">{t('shell.nav.training')}</Link>
          <Link to="/game/2048">2048</Link>
          <LanguageSwitcher />
          <button type="button" className="ghost" onClick={onLogout}>
            {t('shell.nav.logout')}
          </button>
        </nav>
      </header>

      {user.isGuest ? (
        <section className="panel upgrade-panel">
          <h3>{t('shell.upgrade.title')}</h3>
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
                .catch((err) =>
                  setUpgradeError(
                    translateError(err instanceof Error ? err.message : t('common.error_generic'))
                  )
                )
                .finally(() => setUpgrading(false));
            }}
          >
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('auth.display_name')}
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('auth.email')}
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.password')}
            />
            <button type="submit" disabled={upgrading}>
              {upgrading ? t('shell.upgrade.submitting') : t('shell.upgrade.submit')}
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
  const { t } = useI18n();
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
      return <main className="auth-gate">{t('auth.loading_session')}</main>;
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

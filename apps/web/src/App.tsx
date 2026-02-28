import type { UserDTO } from '@multiwebgame/shared-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { LanguageSwitcher, useI18n } from './context/I18nContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { ApiClient, storage } from './lib/api';
import { classifyTransportError, isExplicitAuthInvalidError } from './lib/errorHandling';
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
  const [showManualReset, setShowManualReset] = useState(false);

  const api = useMemo(() => new ApiClient(null), []);
  const resetSession = () => {
    storage.setToken(null);
    storage.setReconnectKey(null);
    setShowManualReset(false);
    setError(t('auth.session_reset_done'));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setShowManualReset(false);

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
      const transport = classifyTransportError(err);
      if (transport === 'network') {
        setShowManualReset(true);
        setError(t('auth.network_retry'));
        return;
      }
      if (transport === 'cors') {
        setShowManualReset(true);
        setError(t('auth.cors_retry'));
        return;
      }
      const message = err instanceof Error ? err.message : t('error.auth_failed');
      setError(translateError(message));
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
        {showManualReset ? (
          <div className="button-row">
            <button type="button" className="secondary" onClick={resetSession}>
              {t('auth.reset_session')}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SessionRecoveryGate({
  error,
  showManualReset,
  onRetry,
  onResetSession
}: {
  error: string;
  showManualReset: boolean;
  onRetry: () => void;
  onResetSession: () => void;
}) {
  const { t } = useI18n();

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <LanguageSwitcher />
        <h1>{t('auth.title')}</h1>
        <p className="error-text">{error}</p>
        <div className="button-row">
          <button type="button" onClick={onRetry}>
            {t('auth.retry_restore_session')}
          </button>
          {showManualReset ? (
            <button type="button" className="secondary" onClick={onResetSession}>
              {t('auth.reset_session')}
            </button>
          ) : null}
        </div>
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
        <Route path="/matches/:matchId/replay" element={<ReplayPage api={api} viewerUserId={user.id} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  const { t, translateError } = useI18n();
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [loadingStalled, setLoadingStalled] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showSessionResetAction, setShowSessionResetAction] = useState(false);
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  const clearSession = useCallback(() => {
    storage.setToken(null);
    storage.setReconnectKey(null);
    setToken(null);
    setUser(null);
    setSessionError(null);
    setShowSessionResetAction(false);
    setLoading(false);
    setLoadingStalled(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setSessionError(null);
      setShowSessionResetAction(false);
      setLoading(false);
      setLoadingStalled(false);
      return;
    }

    let active = true;
    const api = new ApiClient(token);
    setLoading(true);
    setSessionError(null);
    setShowSessionResetAction(false);

    api
      .me()
      .then((result) => {
        if (!active) {
          return;
        }
        setUser(result.user);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        if (isExplicitAuthInvalidError(error)) {
          clearSession();
          return;
        }

        const transport = classifyTransportError(error);
        if (transport === 'network') {
          setSessionError(t('auth.session_restore_network'));
          setShowSessionResetAction(true);
          return;
        }
        if (transport === 'cors') {
          setSessionError(t('auth.session_restore_cors'));
          setShowSessionResetAction(true);
          return;
        }

        const message = error instanceof Error ? error.message : t('common.error_generic');
        setSessionError(translateError(message));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoadingStalled(false);
        }
      });

    return () => {
      active = false;
    };
  }, [clearSession, token, sessionCheckAttempt, t, translateError]);

  useEffect(() => {
    if (!token || !loading) {
      setLoadingStalled(false);
      return;
    }

    const timer = globalThis.setTimeout(() => {
      setLoadingStalled(true);
    }, 9_000);

    return () => clearTimeout(timer);
  }, [loading, token]);

  if (!token) {
    if (loading) {
      return <main className="auth-gate">{t('auth.loading_session')}</main>;
    }

    return (
      <AuthGate
        onAuth={(nextToken, nextUser) => {
          storage.setToken(nextToken);
          setToken(nextToken);
          setUser(nextUser);
          setSessionError(null);
          setShowSessionResetAction(false);
        }}
      />
    );
  }

  if (!user) {
    if (loading && !loadingStalled) {
      return <main className="auth-gate">{t('auth.loading_session')}</main>;
    }

    return (
      <SessionRecoveryGate
        error={
          sessionError ??
          (loadingStalled ? t('auth.session_restore_delayed') : t('auth.session_restore_failed'))
        }
        showManualReset={showSessionResetAction || loadingStalled}
        onRetry={() => setSessionCheckAttempt((current) => current + 1)}
        onResetSession={clearSession}
      />
    );
  }

  return (
    <RealtimeProvider token={token} user={user} onAuthInvalid={clearSession}>
      <Shell
        user={user}
        token={token}
        onUserUpdate={(nextUser) => setUser(nextUser)}
        onLogout={clearSession}
      />
    </RealtimeProvider>
  );
}

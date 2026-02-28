import type { UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { LanguageSwitcher, useI18n } from '../context/I18nContext';
import { ApiClient } from '../lib/api';
import { isExplicitAuthInvalidError } from '../lib/errorHandling';

interface Props {
  inviteToken: string;
  token: string | null;
  onAuth: (token: string, user: UserDTO) => void;
  onAuthInvalid: () => void;
}

export function InvitePage({ inviteToken, token, onAuth, onAuthInvalid }: Props) {
  const { t, translateError } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);

    if (!token) {
      new ApiClient(null)
        .authGuest()
        .then((result) => {
          if (!active) {
            return;
          }
          onAuth(result.token, result.user);
        })
        .catch((err) => {
          if (!active) {
            return;
          }
          setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
        });

      return () => {
        active = false;
      };
    }

    new ApiClient(token)
      .acceptInviteLink(inviteToken)
      .then((accepted) => {
        if (!active) {
          return;
        }

        const watch = accepted.role === 'spectator' ? '?watch=1' : '';
        navigate(`/rooms/${accepted.room.id}${watch}`, { replace: true });
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        if (isExplicitAuthInvalidError(err)) {
          onAuthInvalid();
        }

        setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
      });

    return () => {
      active = false;
    };
  }, [attempt, inviteToken, navigate, onAuth, onAuthInvalid, t, token, translateError]);

  return (
    <main className="auth-gate">
      <section className="panel auth-panel">
        <LanguageSwitcher />
        <h1>{t('invite.title')}</h1>
        <p>{error ? t('invite.failed') : t('invite.processing')}</p>
        {error ? <p className="error-text">{error}</p> : <p>{t('common.loading')}</p>}
        {error ? (
          <div className="button-row">
            <button type="button" onClick={() => setAttempt((current) => current + 1)}>
              {t('common.retry')}
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/')}>
              {t('shell.nav.lobby')}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

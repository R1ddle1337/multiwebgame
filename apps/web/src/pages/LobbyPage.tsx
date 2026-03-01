import type {
  BoardGameType,
  MatchDTO,
  RatingDTO,
  RatingFormulaDTO,
  ReportDTO,
  RoomDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
  user: UserDTO;
}

export function LobbyPage({ api, user }: Props) {
  const realtime = useRealtime();
  const { t, translateError } = useI18n();
  const navigate = useNavigate();
  const setInvitations = realtime.setInvitations;
  const clearMatchmakingTimeout = realtime.clearMatchmakingTimeout;

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [history, setHistory] = useState<MatchDTO[]>([]);
  const [ratings, setRatings] = useState<RatingDTO[]>([]);
  const [ratingFormulas, setRatingFormulas] = useState<RatingFormulaDTO[]>([]);
  const [adminReports, setAdminReports] = useState<ReportDTO[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQueueGame, setActiveQueueGame] = useState<BoardGameType | null>(null);
  const [blockUserId, setBlockUserId] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const gameLabel = useCallback(
    (gameType: RoomDTO['gameType'] | BoardGameType) => t(`enum.game.${gameType}`),
    [t]
  );
  const roomStatusLabel = useCallback((status: RoomDTO['status']) => t(`enum.status.${status}`), [t]);
  const matchStatusLabel = useCallback((status: MatchDTO['status']) => t(`enum.status.${status}`), [t]);

  const pendingInvites = useMemo(
    () =>
      realtime.invitations.filter(
        (invitation) => invitation.toUserId === user.id && invitation.status === 'pending'
      ),
    [realtime.invitations, user.id]
  );

  useEffect(() => {
    let active = true;
    setLoadingRooms(true);
    setLoadingHistory(true);
    setLoadingRatings(true);
    setLoadingReports(user.isAdmin);
    setError(null);

    api
      .listRooms()
      .then((result) => {
        if (active) {
          setRooms(result.rooms);
        }
      })
      .catch((err) => {
        if (active) {
          setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRooms(false);
        }
      });

    api
      .matchHistory(30)
      .then((result) => {
        if (active) {
          setHistory(result.matches);
        }
      })
      .catch(() => {
        // Match history is non-blocking for lobby usage.
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    api
      .listRatings()
      .then((result) => {
        if (active) {
          setRatings(result.ratings);
        }
      })
      .catch(() => {
        // Ratings panel is best effort and should not block lobby render.
      })
      .finally(() => {
        if (active) {
          setLoadingRatings(false);
        }
      });

    api
      .listRatingFormulas()
      .then((result) => {
        if (active) {
          setRatingFormulas(result.formulas);
        }
      })
      .catch(() => {
        // Formula metadata is informational.
      });

    if (user.isAdmin) {
      setLoadingReports(true);
      api
        .listReports({ status: 'open', limit: 30 })
        .then((result) => {
          if (active) {
            setAdminReports(result.reports);
          }
        })
        .catch(() => {
          // Admin triage is best effort for first paint.
        })
        .finally(() => {
          if (active) {
            setLoadingReports(false);
          }
        });
    }

    api
      .listInvitations()
      .then((result) => {
        if (active) {
          setInvitations(result.invitations);
        }
      })
      .catch(() => {
        // Non-critical for first paint.
      });

    return () => {
      active = false;
    };
  }, [api, reloadTick, setInvitations, t, translateError, user.isAdmin]);

  useEffect(() => {
    if (realtime.matchmakingTimeout) {
      setError(
        t('lobby.timeout', {
          game: gameLabel(realtime.matchmakingTimeout)
        })
      );
      setActiveQueueGame(null);
      clearMatchmakingTimeout();
    }
  }, [clearMatchmakingTimeout, gameLabel, realtime.matchmakingTimeout, t]);

  useEffect(() => {
    if (!realtime.lastError) {
      return;
    }

    setError(translateError(realtime.lastError));
    realtime.clearLastError();
  }, [realtime, translateError]);

  const createRoom = async (gameType: RoomDTO['gameType']) => {
    const result = await api.createRoom(gameType, gameType === 'single_2048' ? 1 : 4);
    navigate(`/rooms/${result.room.id}`);
  };

  const joinRoom = async (roomId: string) => {
    await api.joinRoom(roomId, false);
    navigate(`/rooms/${roomId}`);
  };

  const queueForGame = (gameType: BoardGameType) => {
    if (activeQueueGame === gameType) {
      realtime.send({ type: 'matchmaking.leave', payload: {} });
      setActiveQueueGame(null);
      return;
    }

    if (activeQueueGame) {
      realtime.send({ type: 'matchmaking.leave', payload: {} });
    }

    realtime.send({ type: 'matchmaking.join', payload: { gameType } });
    setActiveQueueGame(gameType);
  };

  return (
    <main className="content-grid lobby-layout">
      <section className="panel">
        <h2>{t('lobby.title')}</h2>
        <p>{t('lobby.subtitle')}</p>

        <div className="button-row">
          <button type="button" onClick={() => createRoom('backgammon')}>
            {t('lobby.create.backgammon')}
          </button>
          <button type="button" onClick={() => createRoom('cards')}>
            {t('lobby.create.cards')}
          </button>
          <button type="button" onClick={() => createRoom('quoridor')}>
            {t('lobby.create.quoridor')}
          </button>
          <button type="button" onClick={() => createRoom('hex')}>
            {t('lobby.create.hex')}
          </button>
          <button type="button" onClick={() => createRoom('gomoku')}>
            {t('lobby.create.gomoku')}
          </button>
          <button type="button" onClick={() => createRoom('connect4')}>
            {t('lobby.create.connect4')}
          </button>
          <button type="button" onClick={() => createRoom('reversi')}>
            {t('lobby.create.reversi')}
          </button>
          <button type="button" onClick={() => createRoom('dots')}>
            {t('lobby.create.dots')}
          </button>
          <button type="button" onClick={() => createRoom('go')}>
            {t('lobby.create.go')}
          </button>
          <button type="button" onClick={() => createRoom('xiangqi')}>
            {t('lobby.create.xiangqi')}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/training')}>
            {t('lobby.training')}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/game/2048')}>
            {t('lobby.solo_2048')}
          </button>
        </div>

        <div className="matchmaking">
          <h3>{t('lobby.matchmaking')}</h3>
          <div className="button-row">
            {(
              [
                'backgammon',
                'cards',
                'quoridor',
                'hex',
                'gomoku',
                'connect4',
                'reversi',
                'dots',
                'go',
                'xiangqi'
              ] as const
            ).map((gameType) => (
              <button
                key={gameType}
                type="button"
                className={activeQueueGame === gameType ? '' : 'secondary'}
                onClick={() => queueForGame(gameType)}
              >
                {activeQueueGame === gameType
                  ? t('lobby.queue.leave', { game: gameLabel(gameType) })
                  : t('lobby.queue.join', { game: gameLabel(gameType) })}{' '}
                ({realtime.queueSizes[gameType]})
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {loadingRooms && realtime.status === 'disconnected' ? (
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => setReloadTick((current) => current + 1)}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        <h3>{t('lobby.rooms')}</h3>
        {loadingRooms ? <p>{t('lobby.rooms.loading')}</p> : null}
        <div className="card-list">
          {rooms.map((room) => (
            <article className="card" key={room.id}>
              <div>
                <strong>{gameLabel(room.gameType)}</strong>
                <p>
                  {t('lobby.participants', {
                    count: room.players.length,
                    max: room.maxPlayers,
                    status: roomStatusLabel(room.status)
                  })}
                </p>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => joinRoom(room.id)}>
                  {t('common.join')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigate(`/rooms/${room.id}?watch=1`)}
                >
                  {t('common.spectate')}
                </button>
              </div>
            </article>
          ))}
          {rooms.length === 0 && !loadingRooms ? <p>{t('lobby.rooms.empty')}</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>{t('lobby.presence.title')}</h2>

        <h3>{t('lobby.online')}</h3>
        <ul className="simple-list">
          {realtime.onlineUsers.map((online) => (
            <li key={online.userId}>
              {online.displayName} <code>{online.userId.slice(0, 8)}</code>{' '}
              {online.userId === user.id ? null : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    api
                      .reportUser({
                        targetUserId: online.userId,
                        reason: 'lobby report'
                      })
                      .then(() => setError(t('lobby.report_submitted')))
                      .catch((err) => setError(translateError(err instanceof Error ? err.message : '')));
                  }}
                >
                  {t('common.report')}
                </button>
              )}
            </li>
          ))}
          {realtime.onlineUsers.length === 0 ? <li>{t('lobby.online.empty')}</li> : null}
        </ul>

        <h3>{t('lobby.block.title')}</h3>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            api
              .blockUser({ userId: blockUserId.trim(), reason: 'manual block' })
              .then(() => {
                setError(t('lobby.user_blocked'));
                setBlockUserId('');
              })
              .catch((err) => setError(translateError(err instanceof Error ? err.message : '')));
          }}
        >
          <input
            value={blockUserId}
            onChange={(event) => setBlockUserId(event.target.value)}
            placeholder={t('lobby.block.placeholder')}
          />
          <button type="submit">{t('lobby.block.submit')}</button>
        </form>

        <h3>{t('lobby.invites')}</h3>
        <div className="card-list">
          {pendingInvites.map((invite) => (
            <article className="card" key={invite.id}>
              <p>
                Room <code>{invite.roomId.slice(0, 8)}</code> from{' '}
                <code>{invite.fromUserId.slice(0, 8)}</code>
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() =>
                    realtime.send({
                      type: 'invite.respond',
                      payload: { invitationId: invite.id, action: 'accept' }
                    })
                  }
                >
                  {t('common.accept')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    realtime.send({
                      type: 'invite.respond',
                      payload: { invitationId: invite.id, action: 'decline' }
                    })
                  }
                >
                  {t('common.decline')}
                </button>
              </div>
            </article>
          ))}
          {pendingInvites.length === 0 ? <p>{t('lobby.invites.empty')}</p> : null}
        </div>

        <h3>{t('lobby.ratings')}</h3>
        {loadingRatings ? <p>{t('lobby.ratings.loading')}</p> : null}
        <ul className="simple-list">
          {ratings.map((entry) => (
            <li key={entry.gameType}>
              {gameLabel(entry.gameType)}: <strong>{entry.rating}</strong>
            </li>
          ))}
          {ratings.length === 0 && !loadingRatings ? <li>{t('lobby.ratings.empty')}</li> : null}
        </ul>

        <h3>{t('lobby.formula')}</h3>
        <ul className="simple-list">
          {ratingFormulas.map((formula) => (
            <li key={formula.gameType}>
              {gameLabel(formula.gameType)}: ELO K={formula.kFactor}, initial {formula.initialRating}
            </li>
          ))}
          {ratingFormulas.length === 0 ? <li>{t('lobby.formula.unavailable')}</li> : null}
        </ul>

        {user.isAdmin ? (
          <>
            <h3>{t('lobby.admin.queue')}</h3>
            {loadingReports ? <p>{t('lobby.admin.loading')}</p> : null}
            <div className="card-list">
              {adminReports.map((report) => (
                <article className="card" key={report.id}>
                  <p>
                    <strong>{report.status}</strong> • {report.reason}
                  </p>
                  <p>
                    Reporter <code>{report.reporterUserId.slice(0, 8)}</code>{' '}
                    {report.targetUserId ? (
                      <>
                        • Target <code>{report.targetUserId.slice(0, 8)}</code>
                      </>
                    ) : null}
                  </p>
                  {report.details ? <p>{report.details}</p> : null}
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => {
                        api
                          .resolveReport(report.id, 'reviewed')
                          .then((response) => {
                            setAdminReports((current) =>
                              current.map((entry) =>
                                entry.id === response.report.id ? response.report : entry
                              )
                            );
                          })
                          .catch((err) => setError(translateError(err instanceof Error ? err.message : '')));
                      }}
                    >
                      {t('lobby.admin.review')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        api
                          .resolveReport(report.id, 'resolved')
                          .then(() => setAdminReports((current) => current.filter((r) => r.id !== report.id)))
                          .catch((err) => setError(translateError(err instanceof Error ? err.message : '')));
                      }}
                    >
                      {t('lobby.admin.resolve')}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        api
                          .resolveReport(report.id, 'dismissed')
                          .then(() => setAdminReports((current) => current.filter((r) => r.id !== report.id)))
                          .catch((err) => setError(translateError(err instanceof Error ? err.message : '')));
                      }}
                    >
                      {t('lobby.admin.dismiss')}
                    </button>
                  </div>
                </article>
              ))}
              {adminReports.length === 0 && !loadingReports ? <p>{t('lobby.admin.empty')}</p> : null}
            </div>
          </>
        ) : null}

        <h3>{t('lobby.history')}</h3>
        {loadingHistory ? <p>{t('lobby.history.loading')}</p> : null}
        <ul className="simple-list">
          {history.map((match) => (
            <li key={match.id}>
              {gameLabel(match.gameType)} • {matchStatusLabel(match.status)} •{' '}
              <Link to={`/matches/${match.id}/replay`}>{t('common.replay')}</Link>
            </li>
          ))}
          {history.length === 0 && !loadingHistory ? <li>{t('lobby.history.empty')}</li> : null}
        </ul>
      </section>
    </main>
  );
}

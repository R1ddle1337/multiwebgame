import type {
  BoardGameType,
  ClientToServerMessage,
  InvitationDTO,
  MatchMoveAppliedPayload,
  RoomDTO,
  RoomPlayerRole,
  RoomStatePayload,
  ServerToClientMessage,
  UserDTO
} from '@multiwebgame/shared-types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { storage } from '../lib/api';
import { resolveWsUrl } from '../lib/endpoints';
import { isAuthInvalidMessage } from '../lib/errorHandling';
import { isHeartbeatStale, nextReconnectDelay } from '../lib/reconnect';

interface RoomSnapshot {
  room: RoomDTO;
  gameType: RoomStatePayload['gameType'];
  state: RoomStatePayload['state'];
  viewerRole: RoomPlayerRole;
  lastMove: MatchMoveAppliedPayload['lastMove'] | null;
}

interface RealtimeValue {
  status: 'disconnected' | 'connecting' | 'connected';
  onlineUsers: Array<{ userId: string; displayName: string }>;
  invitations: InvitationDTO[];
  queueSizes: Record<BoardGameType, number>;
  roomStates: Record<string, RoomSnapshot>;
  matchedRoom: { room: RoomDTO; matchId: string } | null;
  matchmakingTimeout: BoardGameType | null;
  lastError: string | null;
  send: (message: ClientToServerMessage) => void;
  setInvitations: React.Dispatch<React.SetStateAction<InvitationDTO[]>>;
  clearMatchedRoom: () => void;
  clearMatchmakingTimeout: () => void;
  clearLastError: () => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

const WS_URL = resolveWsUrl();
const WS_AUTH_TIMEOUT_MS = 10_000;
const WS_PING_INTERVAL_MS = 15_000;
const WS_PONG_TIMEOUT_MS = 45_000;

interface Props {
  token: string;
  user: UserDTO;
  children: React.ReactNode;
  onAuthInvalid?: (reason: string) => void;
}

export function RealtimeProvider({ token, user, children, onAuthInvalid }: Props) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const lastPongAtRef = useRef(Date.now());
  const isAuthedRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const pendingMessagesRef = useRef<ClientToServerMessage[]>([]);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [invitations, setInvitations] = useState<InvitationDTO[]>([]);
  const [queueSizes, setQueueSizes] = useState<Record<BoardGameType, number>>({
    backgammon: 0,
    gomoku: 0,
    connect4: 0,
    reversi: 0,
    dots: 0,
    go: 0,
    xiangqi: 0
  });
  const [roomStates, setRoomStates] = useState<Record<string, RoomSnapshot>>({});
  const [matchedRoom, setMatchedRoom] = useState<{ room: RoomDTO; matchId: string } | null>(null);
  const [matchmakingTimeout, setMatchmakingTimeout] = useState<BoardGameType | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    pendingMessagesRef.current = [];
    isAuthedRef.current = false;
    shouldReconnectRef.current = true;
    reconnectAttemptRef.current = 0;
    lastPongAtRef.current = Date.now();

    const clearAuthTimer = () => {
      if (authTimerRef.current !== null) {
        clearTimeout(authTimerRef.current);
        authTimerRef.current = null;
      }
    };

    const clearPingTimer = () => {
      if (pingTimerRef.current !== null) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const connect = () => {
      shouldReconnectRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStatus('connecting');
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        isAuthedRef.current = false;
        lastPongAtRef.current = Date.now();
        const reconnectKey = storage.getReconnectKey();
        socket.send(
          JSON.stringify({
            type: 'auth',
            payload: {
              token,
              reconnectKey: reconnectKey ?? undefined
            }
          })
        );

        clearAuthTimer();
        authTimerRef.current = globalThis.setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN && !isAuthedRef.current) {
            socket.close(4001, 'auth_timeout');
          }
        }, WS_AUTH_TIMEOUT_MS);
      });

      socket.addEventListener('message', (event) => {
        let message: ServerToClientMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerToClientMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case 'auth.ok': {
            clearAuthTimer();
            setStatus('connected');
            setLastError(null);
            isAuthedRef.current = true;
            reconnectAttemptRef.current = 0;
            lastPongAtRef.current = Date.now();
            storage.setReconnectKey(message.payload.reconnectKey);
            socket.send(JSON.stringify({ type: 'lobby.subscribe', payload: {} }));

            if (pendingMessagesRef.current.length > 0) {
              const queued = [...pendingMessagesRef.current];
              pendingMessagesRef.current = [];
              for (const queuedMessage of queued) {
                if (socket.readyState !== WebSocket.OPEN) {
                  pendingMessagesRef.current.unshift(queuedMessage);
                  break;
                }
                socket.send(JSON.stringify(queuedMessage));
              }
            }

            clearPingTimer();
            pingTimerRef.current = globalThis.setInterval(() => {
              if (socket.readyState !== WebSocket.OPEN) {
                return;
              }

              if (isHeartbeatStale(lastPongAtRef.current, Date.now(), WS_PONG_TIMEOUT_MS)) {
                socket.close(4000, 'pong_timeout');
                return;
              }

              socket.send(
                JSON.stringify({
                  type: 'ping',
                  payload: { ts: Date.now() }
                })
              );
            }, WS_PING_INTERVAL_MS);
            break;
          }
          case 'auth.error': {
            // Fallback: stale reconnect key/session can cause auth loop after deployments.
            storage.setReconnectKey(null);
            clearAuthTimer();
            isAuthedRef.current = false;
            setStatus('disconnected');

            if (isAuthInvalidMessage(message.payload.reason)) {
              shouldReconnectRef.current = false;
              pendingMessagesRef.current = [];
              onAuthInvalid?.(message.payload.reason);
            } else {
              setLastError(message.payload.reason);
            }
            socket.close();
            break;
          }
          case 'lobby.presence': {
            setOnlineUsers(message.payload.onlineUsers);
            break;
          }
          case 'invite.received': {
            setInvitations((current) => {
              if (current.some((invite) => invite.id === message.payload.invitation.id)) {
                return current;
              }
              return [message.payload.invitation, ...current];
            });
            break;
          }
          case 'invite.updated': {
            setInvitations((current) =>
              current.map((invitation) =>
                invitation.id === message.payload.invitationId
                  ? {
                      ...invitation,
                      status: message.payload.status
                    }
                  : invitation
              )
            );
            break;
          }
          case 'matchmaking.queued': {
            setQueueSizes((current) => ({
              ...current,
              [message.payload.gameType]: message.payload.queueSize
            }));
            break;
          }
          case 'matchmaking.timeout': {
            setMatchmakingTimeout(message.payload.gameType);
            break;
          }
          case 'matchmaking.matched': {
            setMatchedRoom({ room: message.payload.room, matchId: message.payload.matchId });
            break;
          }
          case 'room.state': {
            setRoomStates((current) => ({
              ...current,
              [message.payload.room.id]: {
                room: message.payload.room,
                gameType: message.payload.gameType,
                state: message.payload.state,
                viewerRole: message.payload.viewerRole,
                lastMove:
                  current[message.payload.room.id]?.gameType === message.payload.gameType
                    ? (current[message.payload.room.id]?.lastMove ?? null)
                    : null
              }
            }));
            break;
          }
          case 'match.move_applied': {
            setRoomStates((current) => {
              const existing = current[message.payload.roomId];
              if (!existing) {
                return current;
              }

              return {
                ...current,
                [message.payload.roomId]: {
                  ...existing,
                  state: message.payload.state,
                  gameType: message.payload.gameType,
                  lastMove: message.payload.lastMove
                }
              };
            });
            break;
          }
          case 'pong': {
            lastPongAtRef.current = Date.now();
            break;
          }
          case 'error': {
            setLastError(message.payload.reason);
            break;
          }
          default:
            break;
        }
      });

      socket.addEventListener('close', () => {
        setStatus('disconnected');
        isAuthedRef.current = false;
        clearAuthTimer();
        clearPingTimer();
        socketRef.current = null;

        if (!isMounted || !shouldReconnectRef.current) {
          return;
        }

        const delay = nextReconnectDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = globalThis.setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      isMounted = false;
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearAuthTimer();
      clearPingTimer();
      pendingMessagesRef.current = [];
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [onAuthInvalid, token, user.id]);

  const send = useCallback((message: ClientToServerMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !isAuthedRef.current) {
      pendingMessagesRef.current.push(message);
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const value = useMemo<RealtimeValue>(
    () => ({
      status,
      onlineUsers,
      invitations,
      queueSizes,
      roomStates,
      matchedRoom,
      matchmakingTimeout,
      lastError,
      send,
      setInvitations,
      clearMatchedRoom: () => setMatchedRoom(null),
      clearMatchmakingTimeout: () => setMatchmakingTimeout(null),
      clearLastError: () => setLastError(null)
    }),
    [
      status,
      onlineUsers,
      invitations,
      queueSizes,
      roomStates,
      matchedRoom,
      matchmakingTimeout,
      lastError,
      send
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  const value = useContext(RealtimeContext);
  if (!value) {
    throw new Error('useRealtime must be used inside RealtimeProvider');
  }
  return value;
}

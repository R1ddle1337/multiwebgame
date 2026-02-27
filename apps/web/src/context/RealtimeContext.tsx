import type {
  BoardGameType,
  ClientToServerMessage,
  InvitationDTO,
  RoomDTO,
  RoomPlayerRole,
  RoomStatePayload,
  ServerToClientMessage,
  UserDTO
} from '@multiwebgame/shared-types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { storage } from '../lib/api';

interface RoomSnapshot {
  room: RoomDTO;
  gameType: RoomStatePayload['gameType'];
  state: RoomStatePayload['state'];
  viewerRole: RoomPlayerRole;
}

interface RealtimeValue {
  status: 'disconnected' | 'connecting' | 'connected';
  onlineUsers: Array<{ userId: string; displayName: string }>;
  invitations: InvitationDTO[];
  queueSizes: Record<BoardGameType, number>;
  roomStates: Record<string, RoomSnapshot>;
  matchedRoom: { room: RoomDTO; matchId: string } | null;
  matchmakingTimeout: BoardGameType | null;
  send: (message: ClientToServerMessage) => void;
  setInvitations: React.Dispatch<React.SetStateAction<InvitationDTO[]>>;
  clearMatchedRoom: () => void;
  clearMatchmakingTimeout: () => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4001';

interface Props {
  token: string;
  user: UserDTO;
  children: React.ReactNode;
}

export function RealtimeProvider({ token, user, children }: Props) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [invitations, setInvitations] = useState<InvitationDTO[]>([]);
  const [queueSizes, setQueueSizes] = useState<Record<BoardGameType, number>>({
    gomoku: 0,
    go: 0,
    xiangqi: 0
  });
  const [roomStates, setRoomStates] = useState<Record<string, RoomSnapshot>>({});
  const [matchedRoom, setMatchedRoom] = useState<{ room: RoomDTO; matchId: string } | null>(null);
  const [matchmakingTimeout, setMatchmakingTimeout] = useState<BoardGameType | null>(null);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      setStatus('connecting');
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
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
      });

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data) as ServerToClientMessage;

        switch (message.type) {
          case 'auth.ok': {
            setStatus('connected');
            storage.setReconnectKey(message.payload.reconnectKey);
            socket.send(JSON.stringify({ type: 'lobby.subscribe', payload: {} }));

            if (pingTimerRef.current !== null) {
              clearInterval(pingTimerRef.current);
            }

            pingTimerRef.current = window.setInterval(() => {
              if (socket.readyState !== WebSocket.OPEN) {
                return;
              }

              socket.send(
                JSON.stringify({
                  type: 'ping',
                  payload: { ts: Date.now() }
                })
              );
            }, 15_000);
            break;
          }
          case 'auth.error': {
            setStatus('disconnected');
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
                viewerRole: message.payload.viewerRole
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
                  gameType: message.payload.gameType
                }
              };
            });
            break;
          }
          default:
            break;
        }
      });

      socket.addEventListener('close', () => {
        setStatus('disconnected');
        if (pingTimerRef.current !== null) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }

        if (!isMounted) {
          return;
        }

        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      });
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pingTimerRef.current !== null) {
        clearInterval(pingTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [token, user.id]);

  const send = useCallback((message: ClientToServerMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
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
      send,
      setInvitations,
      clearMatchedRoom: () => setMatchedRoom(null),
      clearMatchmakingTimeout: () => setMatchmakingTimeout(null)
    }),
    [status, onlineUsers, invitations, queueSizes, roomStates, matchedRoom, matchmakingTimeout, send]
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

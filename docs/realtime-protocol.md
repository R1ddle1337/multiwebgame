# Realtime Protocol (WebSocket)

Endpoint: `ws://localhost:4001`

Message shape:

```json
{
  "type": "event.name",
  "payload": {}
}
```

## Client -> Server

- `auth`
  - `{ token: string, reconnectKey?: string }`

- `lobby.subscribe`
  - `{}`

- `room.subscribe`
  - `{ roomId: string, asSpectator?: boolean }`

- `room.unsubscribe`
  - `{ roomId: string }`

- `room.move` (Gomoku)
  - `{ roomId: string, gameType: "gomoku", x: number, y: number }`

- `room.move` (Go)
  - `{ roomId: string, gameType: "go", move: { type: "place", x, y, player } | { type: "pass", player } }`

- `room.move` (Xiangqi)
  - `{ roomId: string, gameType: "xiangqi", move: { from, to, player } }`

- `matchmaking.join`
  - `{ gameType: "gomoku" | "go" | "xiangqi" }`

- `matchmaking.leave`
  - `{}`

- `invite.respond`
  - `{ invitationId: string, action: "accept" | "decline" }`

- `ping`
  - `{ ts: number }`

## Server -> Client

- `auth.ok`
  - `{ connectionId, reconnectKey, user }`

- `auth.error`
  - `{ reason }`

- `lobby.presence`
  - `{ onlineUsers: [{ userId, displayName }] }`

- `room.state`
  - Gomoku: `{ room, gameType: "gomoku", state, viewerRole }`
  - Go: `{ room, gameType: "go", state, viewerRole }`
  - Xiangqi: `{ room, gameType: "xiangqi", state, viewerRole }`
  - 2048 room: `{ room, gameType: "single_2048", state: null, viewerRole }`

- `room.player_joined`
  - `{ roomId, user, role }`

- `room.player_left`
  - `{ roomId, userId }`

- `invite.received`
  - `{ invitation }`

- `invite.updated`
  - `{ invitationId, status }`

- `matchmaking.queued`
  - `{ gameType, queueSize }`

- `matchmaking.timeout`
  - `{ gameType }`

- `matchmaking.matched`
  - `{ room, matchId }`

- `match.move_applied`
  - Game-specific payload including `{ roomId, gameType, state, lastMove }`

- `match.completed`
  - `{ roomId, matchId, winnerUserId, resultPayload? }`

- `pong`
  - `{ ts }`

- `error`
  - `{ reason }`

## Enforcement and Lifecycle

- Server-authoritative move handling:
  - Room move attempts from non-seated users are rejected (`not_a_match_player`).
  - Move attempts for non-subscribed rooms are rejected (`room_not_subscribed`).

- Spectators:
  - Stable room subscription/unsubscription is supported via `room.subscribe`/`room.unsubscribe`.
  - Spectators are read-only at protocol level.

- Reconnect:
  - Client stores `reconnectKey` from `auth.ok`.
  - On reconnect, client sends `auth` with prior `reconnectKey`.
  - Server restores prior lobby + room subscriptions inside reconnect grace window.

- Matchmaking queue:
  - `matchmaking.leave` cancels queue membership.
  - Timed-out entries receive `matchmaking.timeout`.
  - Disconnected entries get reconnect grace handling before drop.

- Heartbeat:
  - Client sends periodic `ping`; server emits `pong`.
  - Server closes stale sockets that miss heartbeat window.

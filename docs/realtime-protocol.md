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
  - `{ roomId, matchId, winnerUserId }`

- `pong`
  - `{ ts }`

- `error`
  - `{ reason }`

## Reconnect, Timeout, Heartbeat

- Client stores `reconnectKey` from `auth.ok`.
- On reconnect, client sends `auth` with prior `reconnectKey`.
- Server restores lobby + room subscriptions for a short reconnect window.
- Matchmaking entries keep a reconnect grace period; stale disconnected entries are dropped.
- Matchmaking queue entries time out automatically if unmatched.
- Client sends periodic `ping`; server tracks last activity and closes stale sockets.

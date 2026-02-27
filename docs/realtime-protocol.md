# Realtime Protocol (WebSocket)

Endpoint: `ws://localhost:4001`

Message shape:

```json
{
  "type": "event.name",
  "payload": { }
}
```

## Client -> Server

- `auth`
  - `{ token: string, reconnectKey?: string }`

- `lobby.subscribe`
  - `{}`

- `room.subscribe`
  - `{ roomId: string }`

- `room.move`
  - `{ roomId: string, x: number, y: number }`

- `matchmaking.join`
  - `{ gameType: "gomoku" }`

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
  - `{ room, gomokuState }`

- `room.player_joined`
  - `{ roomId, user }`

- `room.player_left`
  - `{ roomId, userId }`

- `invite.received`
  - `{ invitation }`

- `invite.updated`
  - `{ invitationId, status }`

- `matchmaking.queued`
  - `{ queueSize }`

- `matchmaking.matched`
  - `{ room, matchId }`

- `match.move_applied`
  - `{ roomId, state, lastMove }`

- `pong`
  - `{ ts }`

- `error`
  - `{ reason }`

## Reconnect Handling

- Client stores `reconnectKey` from `auth.ok`.
- On reconnect, client sends `auth` with prior `reconnectKey`.
- Server restores lobby + room subscriptions for a short reconnect window.

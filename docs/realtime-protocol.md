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

- `room.rng.commit`
  - `{ roomId: string, commit: string }`

- `room.rng.reveal`
  - `{ roomId: string, nonce: string }`

- `room.move` (Gomoku)
  - `{ roomId: string, gameType: "gomoku", x: number, y: number }`

- `room.move` (Connect Four)
  - `{ roomId: string, gameType: "connect4", column: number }`

- `room.move` (Santorini)
  - `{ roomId: string, gameType: "santorini", move: { type: "place", worker: "a" | "b", x, y } | { type: "turn", worker: "a" | "b", to: {x, y}, build: {x, y} } }`

- `room.move` (Onitama)
  - `{ roomId: string, gameType: "onitama", move: { from: {x, y}, to: {x, y}, card: "tiger" | "dragon" | "frog" | "rabbit" | "crab" | "elephant" | "goose" | "rooster" } }`

- `room.move` (Battleship)
  - `{ roomId: string, gameType: "battleship", move: { type: "place_fleet", ships: [{ x, y, orientation: "h" | "v", length }] } | { type: "fire", x, y } }`

- `room.move` (Yahtzee)
  - `{ roomId: string, gameType: "yahtzee", move: { type: "roll", hold?: [boolean, boolean, boolean, boolean, boolean] } | { type: "score", category: "ones" | "twos" | "threes" | "fours" | "fives" | "sixes" | "three_of_a_kind" | "four_of_a_kind" | "full_house" | "small_straight" | "large_straight" | "yahtzee" | "chance" } }`

- `room.move` (Love Letter)
  - `{ roomId: string, gameType: "love_letter", move: { type: "play", card: "guard" | "priest" | "baron" | "handmaid" | "prince" | "king" | "countess" | "princess", target?: "black" | "white", guess?: cardName } }`

- `room.move` (Codenames Duet)
  - `{ roomId: string, gameType: "codenames_duet", move: { type: "clue", word: string, count: 1..9 } | { type: "guess", index: 0..24 } | { type: "end_guesses" } }`

- `room.move` (Reversi)
  - `{ roomId: string, gameType: "reversi", x: number, y: number }`

- `room.move` (Dots and Boxes)
  - `{ roomId: string, gameType: "dots", move: { orientation: "h" | "v", x: number, y: number } }`

- `room.move` (Go)
  - `{ roomId: string, gameType: "go", move: { type: "place", x, y, player } | { type: "pass", player } }`

- `room.move` (Xiangqi)
  - `{ roomId: string, gameType: "xiangqi", move: { from, to, player } }`

- `room.move` (Cards / Crazy Eights)
  - `{ roomId: string, gameType: "cards", move: { type: "play", card, chosenSuit? } | { type: "draw" } | { type: "end_turn" } }`

- `room.move` (Quoridor)
  - `{ roomId: string, gameType: "quoridor", move: { type: "pawn", x, y } | { type: "wall", orientation: "h" | "v", x, y } }`

- `room.move` (Hex)
  - `{ roomId: string, gameType: "hex", x: number, y: number }`

- `room.move` (Liar's Dice)
  - `{ roomId: string, gameType: "liars_dice", move: { type: "bid", quantity: number, face: 1..6 } | { type: "call_liar" } }`

- `matchmaking.join`
  - `{ gameType: "gomoku" | "santorini" | "onitama" | "battleship" | "yahtzee" | "love_letter" | "codenames_duet" | "connect4" | "reversi" | "dots" | "go" | "xiangqi" | "backgammon" | "cards" | "quoridor" | "hex" | "liars_dice" }`

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
  - Santorini: `{ room, gameType: "santorini", state, viewerRole }`
  - Onitama: `{ room, gameType: "onitama", state, viewerRole }`
  - Battleship: `{ room, gameType: "battleship", state, viewerRole }`
  - Yahtzee: `{ room, gameType: "yahtzee", state, viewerRole }`
  - Love Letter: `{ room, gameType: "love_letter", state, viewerRole }`
  - Codenames Duet: `{ room, gameType: "codenames_duet", state, viewerRole }`
  - Connect Four: `{ room, gameType: "connect4", state, viewerRole }`
  - Reversi: `{ room, gameType: "reversi", state, viewerRole }`
  - Dots and Boxes: `{ room, gameType: "dots", state, viewerRole }`
  - Go: `{ room, gameType: "go", state, viewerRole }`
  - Xiangqi: `{ room, gameType: "xiangqi", state, viewerRole }`
  - Cards: `{ room, gameType: "cards", state, viewerRole }`
  - Liar's Dice: `{ room, gameType: "liars_dice", state, viewerRole }`
  - Quoridor: `{ room, gameType: "quoridor", state, viewerRole }`
  - Hex: `{ room, gameType: "hex", state, viewerRole }`
  - 2048 room: `{ room, gameType: "single_2048", state: null, viewerRole }`

- `room.player_joined`
  - `{ roomId, user, role }`

- `room.player_left`
  - `{ roomId, userId }`

- `room.rng.updated`
  - `{ roomId, phase, serverSeedCommit, commits, revealedUsers, revealDeadlineAt, rngSeed }`

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
  - Cards hidden information policy:
    - active players only receive their own hand;
    - spectators do not receive hand cards or draw-pile visibility during active play.
  - Love Letter hidden information policy:
    - active players only receive their own current hand;
    - spectators do not receive either player's hand during active play.
  - Liar's Dice hidden information policy:
    - active players only receive their own current dice;
    - spectators do not receive any current dice values during active play.
  - Codenames Duet hidden information policy:
    - during active play, each player only receives their own key map;
    - spectators do not receive either key map while match is active;
    - after completion, replay/state projection can reveal both key maps.
  - Battleship hidden information policy:
    - during active play, each player only receives own fleet layout;
    - spectators do not receive either fleet layout while match is active;
    - after completion, state projection can reveal both fleet layouts for replay/audit.

- Reconnect:
  - Client stores `reconnectKey` from `auth.ok`.
  - On reconnect, client sends `auth` with prior `reconnectKey`.
  - Server restores prior lobby + room subscriptions inside reconnect grace window.

- Verifiable randomness commit-reveal:
  - RNG-enabled matches can require both players to submit `room.rng.commit` then `room.rng.reveal`.
  - Until reveal is complete, gameplay moves may be rejected with `rng_reveal_pending`.
  - Reveal timeout may abandon the active match (`abandonedReason: "rng_reveal_timeout"` in match result payload).
  - Onitama uses RNG commit-reveal to sample opening action cards and publishes proof in completed payload for replay verification.
  - Yahtzee uses RNG commit-reveal for all dice rolls and publishes proof in completed payload for replay verification.

- Matchmaking queue:
  - `matchmaking.leave` cancels queue membership.
  - Timed-out entries receive `matchmaking.timeout`.
  - Disconnected entries get reconnect grace handling before drop.

- Heartbeat:
  - Client sends periodic `ping`; server emits `pong`.
  - Server closes stale sockets that miss heartbeat window.

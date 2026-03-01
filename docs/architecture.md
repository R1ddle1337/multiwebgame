# Architecture Overview

- `apps/api`: Express HTTP service for auth, account upgrade, ratings metadata, rooms, invitations, moderation workflows, and replay history.
- `apps/realtime`: WebSocket service for presence, matchmaking (cancel/timeout/reconnect), spectator subscriptions, and server-authoritative board runtimes.
- `apps/web`: React + Vite client for auth flows, lobby, matchmaking, spectator rooms, moderation actions, and replay controls.
- `packages/game-engines`: Pure game engines with production adjudication logic for:
  - 2048
  - Connect Four (7x6 gravity-drop, four-in-a-row adjudication)
  - Reversi (8x8 directional flips with forced-pass handling)
  - Dots and Boxes (5x5 dots default, scoring + extra-turn chaining)
  - Cards / Crazy Eights (2-player, verifiable shuffle, hidden-information projection)
  - Love Letter (2-player hidden-hand card play, verifiable shuffle/deal, spectator-safe projection)
  - Gomoku (`freestyle` + restricted Renju policy support)
  - Santorini (5x5 no-god-power rules, setup + move/build + no-legal-move loss)
  - Onitama (5x5 fixed-card rules, master capture/temple win, verifiable RNG opening cards)
  - Battleship (10x10 fleet placement + turn-based fire resolution, hidden-fleet projection, end-of-match reveal)
  - Yahtzee (2-player score race, up to 3 rolls per turn with hold/reroll, verifiable RNG dice)
  - Codenames Duet (5x5 co-op clues/guesses, hidden key projection, verifiable RNG words + key maps)
  - Go (capture/ko/suicide + Chinese area scoring + komi)
  - Xiangqi (full movement, check safety, mate/stalemate, repetition policy)
- `packages/shared-types`: Cross-service DTOs and realtime protocol contracts.
- `infra/db/migrations`: SQL migrations for core entities, ratings, moderation, and match result payload fields.

## Runtime Model

- API and realtime share PostgreSQL as source of truth.
- Realtime keeps in-memory active match runtimes for low-latency authoritative validation.
- Move persistence is append-only into `match_moves`.
- Replay reconstruction is deterministic from move logs and engine logic.
- Match completion writes:
  - `winner_user_id`
  - `result_payload` (scoring/adjudication metadata)
  - per-mode ELO rating updates.

## Room Model

- Room members have role `player` or `spectator`.
- `maxPlayers` controls total room participants.
- Board modes reserve active seats for two players and allow extra room capacity as spectators.
- Spectator subscriptions are explicit (`room.subscribe` / `room.unsubscribe`) and read-only.
- Host lifecycle is deterministic:
  - creator/host leaves -> ownership is reassigned
  - empty rooms auto-close
- Realtime runs periodic idle-room cleanup:
  - `rooms.status='open'` + no active match + `last_active_at` beyond TTL
  - eligible rooms are auto-closed (history/match data preserved)
- Impossible active matches auto-abandon and room status is reconciled back to `open`.
- Shareable room invite links are reusable and role-aware:
  - token opens web route `/invite/:token`
  - join defaults to player when seats are available; otherwise spectator
  - link invalidates on room close or when the room's active match ends (`completed`/`abandoned`)
- Realtime applies inactive-player timeout with reconnect grace; reconnecting with same session before timeout restores control without seat ghosting.

## Client i18n Model

- Web client uses locale context with persistent local preference (`localStorage`).
- v1 default policy is `zh-CN`; users can switch to `en-US` from UI language controls.
- Core translated flows: auth, lobby/matchmaking, room gameplay controls, errors, replay controls.

## Moderation Model

- Foundation endpoints:
  - user block list + block action
  - report creation
  - admin report queue listing
  - admin report resolution state transitions (`reviewed`/`resolved`/`dismissed`)
- Admin capability is controlled by persisted `users.is_admin`.

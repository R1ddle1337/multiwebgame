# Architecture Overview

- `apps/api`: Express HTTP service for auth, account upgrade, ratings metadata, rooms, invitations, moderation workflows, and replay history.
- `apps/realtime`: WebSocket service for presence, matchmaking (cancel/timeout/reconnect), spectator subscriptions, and server-authoritative board runtimes.
- `apps/web`: React + Vite client for auth flows, lobby, matchmaking, spectator rooms, moderation actions, and replay controls.
- `packages/game-engines`: Pure game engines with production adjudication logic for:
  - 2048
  - Gomoku (`freestyle` + restricted Renju policy support)
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

## Moderation Model

- Foundation endpoints:
  - user block list + block action
  - report creation
  - admin report queue listing
  - admin report resolution state transitions (`reviewed`/`resolved`/`dismissed`)
- Admin capability is controlled by persisted `users.is_admin`.

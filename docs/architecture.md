# Architecture Overview

- `apps/api`: Express HTTP service for auth, account upgrade, ratings, rooms, invitations, moderation, and replay history.
- `apps/realtime`: WebSocket service for presence, matchmaking (cancel/timeout/reconnect), spectator subscriptions, and server-authoritative board game runtime.
- `apps/web`: React + Vite client for auth flows, lobby, matchmaking, training mode, rooms, spectators, moderation actions, and replay.
- `packages/game-engines`: Pure game logic engines for:
  - 2048
  - Gomoku
  - Go (captures, ko, suicide, pass)
  - Xiangqi (rule legality and check safety)
- `packages/shared-types`: Cross-service DTOs and realtime protocol contracts.
- `infra/db/migrations`: SQL migrations for core entities, ratings, and moderation foundations.

## Runtime Model

- API and realtime share PostgreSQL as source of truth.
- Realtime keeps in-memory active room runtimes for low-latency move validation and emits authoritative state updates.
- Move persistence is append-only into `match_moves`; replay rebuilds state from persisted move stream.
- Match completion updates per-game ELO-like ratings in DB.

## Room Membership Model

- Room members have role `player` or `spectator`.
- `maxPlayers` controls participant capacity.
- Board modes reserve player seats (seat 1/2) and allow additional participants as spectators.

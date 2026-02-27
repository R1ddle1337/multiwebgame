# Architecture Overview

- `apps/api`: Express HTTP service for auth, user profile, rooms, invitations, and match history.
- `apps/realtime`: WebSocket service for presence, room sync, invite notifications, matchmaking, and authoritative gomoku moves.
- `apps/web`: React + Vite frontend for lobby, matchmaking, invites, 2048, gomoku, and replay.
- `packages/game-engines`: Pure game logic engines for 2048 and gomoku.
- `packages/shared-types`: Shared DTO and protocol types.
- `infra/db/migrations`: SQL migrations.
- `infra/nginx/nginx.conf`: Reverse proxy sample.

Persistence uses PostgreSQL; Redis is connected for realtime infrastructure readiness.

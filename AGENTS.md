# AGENTS.md

This repository follows these collaboration rules for both human contributors and coding agents.

## Mission

- Keep the monorepo shippable for the v1 multiplayer web game MVP.
- Prefer small, reviewable, behavior-safe changes over large refactors.
- Keep docs and code in sync when APIs, protocols, or operations change.

## Source Of Truth

- Setup and local run: `docs/startup.md`
- HTTP contracts: `docs/api.md`
- Realtime protocol: `docs/realtime-protocol.md`
- System architecture: `docs/architecture.md`

If code and docs diverge, update docs in the same change set.

## Repository Map

- `apps/api`: HTTP API, auth, room/lobby, moderation, replay metadata.
- `apps/realtime`: WebSocket gateway, matchmaking, authoritative gameplay runtime.
- `apps/web`: React client.
- `packages/game-engines`: deterministic game rules and adjudication logic.
- `packages/shared-types`: shared DTOs and protocol contracts.
- `infra/db/migrations`: database migrations.

## Working Agreement

1. Scope changes to the smallest practical unit.
2. Keep cross-package contracts in `packages/shared-types` first, then update API/realtime/web.
3. For gameplay rule changes, update tests in `packages/game-engines/tests` in the same PR.
4. Do not silently change externally visible behavior (API fields, WS events, i18n defaults).
5. If behavior changes are intentional, update docs and include migration notes in PR description.

## Commands

- Install: `npm install`
- Dev all services: `npm run dev`
- Build all: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm run test`
- Format check: `npm run format:check`

For DB changes:

- Start stores: `docker compose up -d postgres redis`
- Migrate: `npm run db:migrate`
- Seed: `npm run db:seed`

## Definition Of Done

Before merge, ensure:

- Relevant tests pass for touched packages.
- `npm run lint`, `npm run typecheck`, and `npm run test` pass.
- New/changed APIs, realtime messages, or ops steps are documented.
- No secrets are committed (`.env` stays local; update `.env.example` when needed).

## Commit And PR Rules

- Conventional Commits are required (enforced by `commitlint`).
- Keep commits focused and logically grouped.
- PR description must include:
  - what changed
  - why it changed
  - how it was validated
  - any follow-up tasks

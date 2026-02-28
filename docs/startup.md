# Local Startup

## Prerequisites

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Environment

1. Copy `.env.example` to `.env`.
2. Set a strong `JWT_SECRET`.
3. Room idle cleanup knobs (optional):
   - `ROOM_IDLE_CLOSE_MINUTES` (default `30`)
   - `ROOM_IDLE_CLOSE_SWEEP_MINUTES` (default `5`)

## Install

```bash
npm install
```

## Start Datastores

```bash
docker compose up -d postgres redis
```

## Apply Database Migrations

```bash
npm run db:migrate
npm run db:seed
```

## Optional: Grant Admin Role

Use this once for a user that should access admin moderation APIs:

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your-admin@example.com';
```

## Run Services (dev)

```bash
npm run dev
```

Services:

- API: `http://localhost:4000`
- Realtime WS: `ws://localhost:4001`
- Web: `http://localhost:5173`

## i18n Defaults (Web)

- UI locale defaults to `zh-CN` unless user explicitly switches.
- Locale preference is persisted in browser local storage and reused on next load.
- English (`en-US`) can be selected from language controls in auth/shell UI.

## Quality Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

## Git Hooks

Husky + lint-staged + commitlint are configured workspace-wide.

- `pre-commit`: ESLint + Prettier on staged files.
- `commit-msg`: Conventional Commits validation.

If hooks are not installed yet:

```bash
npm run prepare
```

## Full Docker Stack

```bash
docker compose up --build
```

## Build

```bash
npm run build
```

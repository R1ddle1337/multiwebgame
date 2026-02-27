# Local Startup

## Prerequisites

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Environment

1. Copy `.env.example` to `.env`.
2. Update `JWT_SECRET` before production use.

## Run With Docker Compose

```bash
docker compose up --build
```

Services:

- API: `http://localhost:4000`
- Realtime WS: `ws://localhost:4001`
- Web: `http://localhost:5173`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Run Without Docker (recommended for development)

```bash
npm install
docker compose up -d postgres redis
npm run db:migrate
npm run db:seed
npm run dev
```

## Test

```bash
npm test
```

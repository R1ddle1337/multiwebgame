# Local Startup

## Prerequisites

- Node.js 22+
- npm 10+
- Docker + Docker Compose

## Environment

1. Copy `.env.example` to `.env`.
2. Set a strong `JWT_SECRET`.

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

## Run Services (dev)

```bash
npm run dev
```

Services:

- API: `http://localhost:4000`
- Realtime WS: `ws://localhost:4001`
- Web: `http://localhost:5173`

## Full Docker Stack

```bash
docker compose up --build
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

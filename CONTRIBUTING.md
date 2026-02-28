# Contributing

This project is a TypeScript monorepo for API, realtime, web, and shared game logic.

## 1) Branching

- Create short-lived feature branches from `main`.
- Keep one topic per branch.

## 2) Commit Format

Conventional Commits are required.

Examples:

- `feat(api): add room spectator limit validation`
- `fix(realtime): prevent duplicate reconnect session`
- `docs: update replay payload fields`

## 3) Local Validation

Run before opening a PR:

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

When your change is scoped to one workspace, run targeted commands during development and finish with the full checks above.

## 4) DB/API/Protocol Changes

If your change affects schema, API, or realtime events:

- add/update DB migrations under `infra/db/migrations`
- update `docs/api.md` and/or `docs/realtime-protocol.md`
- mention compatibility impact in PR description

## 5) Pull Request Checklist

- clear title and summary
- linked issue/task (if available)
- validation evidence (commands and key results)
- screenshots or payload examples for UI/API changes
- follow-up tasks explicitly listed

## 6) Security And Config

- Never commit secrets from `.env`.
- Keep `.env.example` updated when adding new required variables.

# HTTP API (v1)

Base URL: `http://localhost:4000`

Auth uses `Authorization: Bearer <jwt>`.

## Health

- `GET /health`

## Auth

- `POST /auth/guest`
  - Body: `{ "displayName"?: string }`
  - Returns: `{ token, user, session }`

- `POST /auth/register`
  - Body: `{ "displayName": string, "email": string, "password": string }`
  - Returns: `{ token, user, session }`

- `POST /auth/login`
  - Body: `{ "email": string, "password": string }`
  - Returns: `{ token, user, session }`

- `POST /auth/upgrade`
  - Auth required
  - Upgrades a guest account into a credential account.
  - Body: `{ "displayName": string, "email": string, "password": string }`
  - Returns: `{ user }`

- `POST /auth/logout`
  - Auth required
  - Returns `204`

## User + Ratings

- `GET /me`
  - Auth required
  - Returns: `{ user, session }`
  - `user` includes:
    - `ratings` map by game mode
    - `isAdmin` flag

- `GET /ratings/me`
  - Auth required
  - Returns: `{ ratings: RatingDTO[] }`

- `GET /ratings/formula`
  - Returns ELO configuration by game mode.
  - Returns: `{ formulas: RatingFormulaDTO[] }`

## Rooms

- `GET /rooms`
  - Auth required
  - Returns open + in-match rooms: `{ rooms: RoomDTO[] }`

- `POST /rooms`
  - Auth required
  - Body: `{ "gameType": "single_2048" | "gomoku" | "go" | "xiangqi", "maxPlayers"?: number }`
  - Returns: `{ room }`

- `GET /rooms/:roomId`
  - Auth required
  - Returns: `{ room }`

- `POST /rooms/:roomId/join`
  - Auth required
  - Body: `{ "asSpectator"?: boolean }`
  - Returns: `{ room }`

- `POST /rooms/:roomId/leave`
  - Auth required
  - Returns: `{ room: RoomDTO | null }`

## Invitations

- `GET /invitations`
  - Auth required
  - Returns: `{ invitations: InvitationDTO[] }`

- `POST /invitations`
  - Auth required
  - Body: `{ "roomId": string, "toUserId": string }`
  - Returns: `{ invitation }`

- `POST /invitations/:invitationId/respond`
  - Auth required
  - Body: `{ "action": "accept" | "decline" }`
  - Returns: `{ invitation, room }`

## Match History + Replay

- `GET /matches/history?limit=20`
  - Auth required
  - Returns: `{ matches: MatchDTO[] }`

- `GET /matches/:matchId`
  - Auth required
  - Returns: `{ match: MatchDTO }`
  - `match.resultPayload` includes adjudication/scoring payload when available.
    - Go: Chinese area score breakdown + komi + winner.
    - Xiangqi: outcome reason (checkmate/stalemate/repetition policy).
    - Gomoku: ruleset and final status metadata.

## Moderation

- `GET /moderation/blocks`
  - Auth required
  - Returns: `{ blocks: BlockDTO[] }`

- `POST /moderation/blocks`
  - Auth required
  - Body: `{ "userId": string, "reason"?: string }`
  - Returns: `{ block }`

- `POST /moderation/reports`
  - Auth required
  - Body: `{ "targetUserId"?: string, "matchId"?: string, "reason": string, "details"?: string }`
  - Returns: `{ ok: true }`

- `GET /moderation/reports?status=open&limit=50`
  - Auth required
  - Admin required
  - Returns: `{ reports: ReportDTO[] }`

- `PATCH /moderation/reports/:reportId`
  - Auth required
  - Admin required
  - Body: `{ "status": "reviewed" | "resolved" | "dismissed" }`
  - Returns: `{ report: ReportDTO }`

## Errors

Error format:

```json
{
  "error": "message"
}
```

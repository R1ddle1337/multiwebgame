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

- `POST /auth/logout`
  - Auth required
  - Returns `204`

## User

- `GET /me`
  - Auth required
  - Returns: `{ user, session }`

## Rooms

- `GET /rooms`
  - Auth required
  - Returns open rooms: `{ rooms: RoomDTO[] }`

- `POST /rooms`
  - Auth required
  - Body: `{ "gameType": "single_2048" | "gomoku" }`
  - Returns: `{ room }`

- `GET /rooms/:roomId`
  - Auth required
  - Returns: `{ room }`

- `POST /rooms/:roomId/join`
  - Auth required
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

## Match History

- `GET /matches/history?limit=20`
  - Auth required
  - Returns: `{ matches: MatchDTO[] }`

- `GET /matches/:matchId`
  - Auth required
  - Returns: `{ match: MatchDTO }`

## Errors

Error format:

```json
{
  "error": "message"
}
```

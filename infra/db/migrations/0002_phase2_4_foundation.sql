ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_type_check;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_game_type_check CHECK (game_type IN ('single_2048', 'gomoku', 'xiangqi', 'go'));

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_game_type_check;
ALTER TABLE matches
  ADD CONSTRAINT matches_game_type_check CHECK (game_type IN ('single_2048', 'gomoku', 'xiangqi', 'go'));

ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_game_type_check;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_game_type_check CHECK (game_type IN ('single_2048', 'gomoku', 'xiangqi', 'go'));

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_players INTEGER;
UPDATE rooms
SET max_players = CASE
  WHEN game_type = 'single_2048' THEN 1
  ELSE 4
END
WHERE max_players IS NULL;
ALTER TABLE rooms ALTER COLUMN max_players SET NOT NULL;
ALTER TABLE rooms ALTER COLUMN max_players SET DEFAULT 4;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_max_players_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_max_players_check CHECK (max_players BETWEEN 1 AND 8);

ALTER TABLE room_players ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE room_players SET role = 'player' WHERE role IS NULL;
ALTER TABLE room_players ALTER COLUMN role SET NOT NULL;
ALTER TABLE room_players ALTER COLUMN role SET DEFAULT 'player';
ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_role_check;
ALTER TABLE room_players ADD CONSTRAINT room_players_role_check CHECK (role IN ('player', 'spectator'));

ALTER TABLE room_players ALTER COLUMN seat DROP NOT NULL;
ALTER TABLE room_players DROP CONSTRAINT IF EXISTS room_players_role_seat_check;
ALTER TABLE room_players
  ADD CONSTRAINT room_players_role_seat_check CHECK (
    (role = 'player' AND seat IS NOT NULL AND seat > 0)
    OR (role = 'spectator' AND seat IS NULL)
  );

DROP INDEX IF EXISTS idx_room_players_active_seat;
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_players_active_seat
  ON room_players(room_id, seat)
  WHERE left_at IS NULL AND seat IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_user_id ON user_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_target_user_id ON user_reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_match_id ON user_reports(match_id);

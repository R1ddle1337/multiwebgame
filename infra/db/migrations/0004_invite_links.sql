CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_invite_links_room_id ON invite_links(room_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_match_id ON invite_links(match_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_active_room ON invite_links(room_id)
  WHERE invalidated_at IS NULL;

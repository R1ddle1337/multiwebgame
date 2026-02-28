ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

UPDATE rooms
SET last_active_at = COALESCE(last_active_at, created_at, NOW())
WHERE last_active_at IS NULL;

ALTER TABLE rooms ALTER COLUMN last_active_at SET DEFAULT NOW();
ALTER TABLE rooms ALTER COLUMN last_active_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_open_last_active_at
  ON rooms (last_active_at)
  WHERE status = 'open';

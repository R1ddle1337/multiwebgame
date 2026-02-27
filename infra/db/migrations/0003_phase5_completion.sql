ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS result_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);

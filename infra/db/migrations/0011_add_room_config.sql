ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS room_config JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE rooms
SET room_config = '{}'::jsonb
WHERE room_config IS NULL;

ALTER TABLE rooms
  ALTER COLUMN room_config SET DEFAULT '{}'::jsonb;

ALTER TABLE rooms
  DROP CONSTRAINT IF EXISTS rooms_room_config_object_check;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_room_config_object_check CHECK (jsonb_typeof(room_config) = 'object');

ALTER TABLE rooms
  DROP CONSTRAINT IF EXISTS rooms_go_board_size_check;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_go_board_size_check CHECK (
    NOT (room_config ? 'goBoardSize')
    OR (room_config->>'goBoardSize') IN ('9', '13', '19')
  );

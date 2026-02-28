ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_type_check;
ALTER TABLE rooms
  ADD CONSTRAINT rooms_game_type_check CHECK (
    game_type IN (
      'single_2048',
      'gomoku',
      'xiangqi',
      'go',
      'connect4',
      'reversi',
      'dots',
      'backgammon',
      'cards'
    )
  );

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_game_type_check;
ALTER TABLE matches
  ADD CONSTRAINT matches_game_type_check CHECK (
    game_type IN (
      'single_2048',
      'gomoku',
      'xiangqi',
      'go',
      'connect4',
      'reversi',
      'dots',
      'backgammon',
      'cards'
    )
  );

ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_game_type_check;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_game_type_check CHECK (
    game_type IN (
      'single_2048',
      'gomoku',
      'xiangqi',
      'go',
      'connect4',
      'reversi',
      'dots',
      'backgammon',
      'cards'
    )
  );

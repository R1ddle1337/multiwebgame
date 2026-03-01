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
      'cards',
      'quoridor',
      'hex',
      'liars_dice',
      'santorini',
      'onitama',
      'codenames_duet',
      'love_letter',
      'battleship',
      'yahtzee',
      'domination',
      'texas_holdem'
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
      'cards',
      'quoridor',
      'hex',
      'liars_dice',
      'santorini',
      'onitama',
      'codenames_duet',
      'love_letter',
      'battleship',
      'yahtzee',
      'domination',
      'texas_holdem'
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
      'cards',
      'quoridor',
      'hex',
      'liars_dice',
      'santorini',
      'onitama',
      'codenames_duet',
      'love_letter',
      'battleship',
      'yahtzee',
      'domination',
      'texas_holdem'
    )
  );

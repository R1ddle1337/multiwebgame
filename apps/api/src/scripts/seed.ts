import { pool } from '../db.js';

async function run(): Promise<void> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'demo1@multiwebgame.local' LIMIT 1"
  );

  if (existing.rows.length > 0) {
    console.log('Seed already applied.');
    await pool.end();
    return;
  }

  const users = await pool.query<{
    id: string;
  }>(
    `
      INSERT INTO users (display_name, email, password_hash, is_guest)
      VALUES
        ('Demo One', 'demo1@multiwebgame.local', '$2b$10$7fHxT8A7DYx6P4Nl9hPTAuOUmFrifD2Q3KX8h0SC7fj.4AK5blF0m', FALSE),
        ('Demo Two', 'demo2@multiwebgame.local', '$2b$10$7fHxT8A7DYx6P4Nl9hPTAuOUmFrifD2Q3KX8h0SC7fj.4AK5blF0m', FALSE)
      RETURNING id
    `
  );

  for (const row of users.rows) {
    await pool.query(
      `
        INSERT INTO ratings (user_id, game_type, rating)
        SELECT $1, game_type, 1200
        FROM UNNEST($2::text[]) AS game_type
        ON CONFLICT (user_id, game_type) DO NOTHING
      `,
      [row.id, ['single_2048', 'gomoku', 'xiangqi', 'go', 'connect4', 'reversi', 'dots', 'backgammon']]
    );
  }

  console.log('Seeded demo users (password: changeme123).');
  await pool.end();
}

run().catch(async (error) => {
  console.error('Seed failure', error);
  await pool.end();
  process.exit(1);
});

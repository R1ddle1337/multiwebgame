import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { createPostgresStore } from './store/postgres-store.js';

const store = createPostgresStore();
const app = createApp(store);

const server = app.listen(config.apiPort, () => {
  console.log(`API listening on :${config.apiPort}`);
});

const shutdown = async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

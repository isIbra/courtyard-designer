#!/usr/bin/env node
/**
 * Migrate data from SQLite (server/data.db) → PostgreSQL.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-pg.js
 *
 * Requires:
 *   - server/data.db to exist (the old SQLite file)
 *   - PostgreSQL running with tables created (docker compose up -d db)
 *   - DATABASE_URL env var or defaults to localhost:5483
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ROOMS, ROOM_WALL_COLORS } from '../server/seed-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SQLITE_PATH = join(__dirname, '..', 'server', 'data.db');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgresql://courtyard:courtyard_dev_2024@localhost:5483/courtyard_designer',
});

async function migrate() {
  let sqlite;
  try {
    sqlite = new Database(SQLITE_PATH, { readonly: true });
  } catch (err) {
    console.error('Could not open SQLite database at', SQLITE_PATH);
    console.error(err.message);
    process.exit(1);
  }

  const rows = sqlite.prepare('SELECT username, state FROM designs').all();
  console.log(`Found ${rows.length} user(s) in SQLite`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      let state;
      try {
        state = JSON.parse(row.state);
      } catch {
        console.warn(`Skipping ${row.username}: invalid JSON`);
        continue;
      }

      // Augment state with fields that were never synced to server
      if (!state.wallColors) {
        state.wallColors = { ...ROOM_WALL_COLORS };
      }
      if (!state.individualWallColors) {
        state.individualWallColors = {};
      }
      if (!state.rooms) {
        state.rooms = ROOMS;
      }

      // Insert user
      const { rows: userRows } = await client.query(
        `INSERT INTO users (username) VALUES ($1)
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [row.username]
      );
      const userId = userRows[0].id;

      // Insert design
      await client.query(
        `INSERT INTO designs (user_id, name, state, is_template)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (user_id) WHERE is_template = false
         DO UPDATE SET state = $3, updated_at = now()`,
        [userId, row.username + "'s Design", state]
      );

      console.log(`  Migrated user: ${row.username}`);

      // For user "ibra": also create a template
      if (row.username.toLowerCase() === 'ibra') {
        await client.query(
          `INSERT INTO designs (user_id, name, state, is_template)
           VALUES ($1, $2, $3, true)`,
          [userId, "Ibra's Apartment", state]
        );
        console.log(`  Created template: "Ibra's Apartment"`);
      }
    }

    await client.query('COMMIT');
    console.log('Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();

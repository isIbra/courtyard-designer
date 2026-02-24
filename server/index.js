import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── SQLite ──
const db = new Database(join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS designs (
    username   TEXT PRIMARY KEY,
    state      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

const getStmt = db.prepare('SELECT state FROM designs WHERE username = ?');
const upsertStmt = db.prepare(`
  INSERT INTO designs (username, state, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(username)
  DO UPDATE SET state = excluded.state, updated_at = datetime('now')
`);

// ── Routes ──

// GET /api/state/:username — fetch saved design
app.get('/api/state/:username', (req, res) => {
  const row = getStmt.get(req.params.username);
  if (row) {
    res.json({ state: JSON.parse(row.state) });
  } else {
    res.json({ state: null });
  }
});

// PUT /api/state/:username — save design
app.put('/api/state/:username', (req, res) => {
  const { walls, furniture, floorMaterials } = req.body;
  if (!walls && !furniture && !floorMaterials) {
    return res.status(400).json({ error: 'No state data provided' });
  }
  const state = JSON.stringify({ walls, furniture, floorMaterials });
  upsertStmt.run(req.params.username, state);
  res.json({ ok: true });
});

// ── Static files (production) ──
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('{*path}', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

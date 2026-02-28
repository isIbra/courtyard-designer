import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer } from 'ws';
import { handleUpgrade, relay, isConnected } from './ws-relay.js';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3051;

// ── Middleware ──
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Routes ──

// GET /api/state/:username — fetch saved design
app.get('/api/state/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.state FROM designs d
       JOIN users u ON d.user_id = u.id
       WHERE u.username = $1 AND d.is_template = false`,
      [req.params.username]
    );
    if (rows.length > 0) {
      res.json({ state: rows[0].state });
    } else {
      res.json({ state: null });
    }
  } catch (err) {
    console.error('[GET /api/state] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/state/:username — save design
app.put('/api/state/:username', async (req, res) => {
  const { walls, furniture, floorMaterials, floorTiles, stairs, wallColors, individualWallColors, rooms } = req.body;
  if (!walls && !furniture && !floorMaterials) {
    return res.status(400).json({ error: 'No state data provided' });
  }

  const state = { walls, furniture, floorMaterials, floorTiles, stairs, wallColors, individualWallColors, rooms };

  try {
    // Upsert user
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (username) VALUES ($1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [req.params.username]
    );
    const userId = userRows[0].id;

    // Upsert design
    await pool.query(
      `INSERT INTO designs (user_id, name, state, is_template)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (user_id) WHERE is_template = false
       DO UPDATE SET state = $3, updated_at = now()`,
      [userId, req.params.username + "'s Design", state]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/state] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/templates — list available templates
app.get('/api/templates', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM designs WHERE is_template = true ORDER BY name`
    );
    res.json({ templates: rows });
  } catch (err) {
    console.error('[GET /api/templates] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/templates/:id/clone — clone a template for a user
app.post('/api/templates/:id/clone', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  try {
    // Get template state
    const { rows: tplRows } = await pool.query(
      `SELECT state FROM designs WHERE id = $1 AND is_template = true`,
      [req.params.id]
    );
    if (tplRows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Upsert user
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (username) VALUES ($1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id`,
      [username]
    );
    const userId = userRows[0].id;

    // Upsert design with template state
    await pool.query(
      `INSERT INTO designs (user_id, name, state, is_template)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (user_id) WHERE is_template = false
       DO UPDATE SET state = $3, updated_at = now()`,
      [userId, username + "'s Design", tplRows[0].state]
    );

    res.json({ ok: true, state: tplRows[0].state });
  } catch (err) {
    console.error('[POST /api/templates/:id/clone] Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Designer API relay ──

app.get('/api/designer/status', (req, res) => {
  res.json({ connected: isConnected() });
});

app.post('/api/designer/exec', async (req, res) => {
  const { method, params } = req.body;
  if (!method) return res.status(400).json({ error: 'Missing method' });
  try {
    const result = await relay(method, params || {});
    res.json({ ok: true, result });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ── Static files (production) ──
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('{*path}', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// ── Start with WebSocket support ──
const httpServer = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleUpgrade(ws);
    });
  } else {
    socket.destroy();
  }
});

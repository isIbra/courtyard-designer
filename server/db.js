import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgresql://courtyard:courtyard_dev_2024@localhost:5483/courtyard_designer',
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export default pool;

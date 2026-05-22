const { Pool } = require('pg');

let pool;

async function initDb() {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Test connection
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('PostgreSQL connected');
}

function getDb() {
  if (!pool) throw new Error('DB not initialized');
  return pool;
}

module.exports = { initDb, getDb };

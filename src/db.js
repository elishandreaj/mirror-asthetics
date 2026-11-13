const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const config = require('./config');

types.setTypeParser(1082, v => v);                 // DATE -> 'YYYY-MM-DD' string (no TZ shifting)
types.setTypeParser(1700, v => (v === null ? null : Number(v))); // NUMERIC -> number

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});
pool.on('error', e => console.error('Postgres pool error', e.message));

const query = (text, params) => pool.query(text, params);

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

async function migrate() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const done = new Set((await query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await tx(async c => { await c.query(sql); await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]); });
    console.log('Migrated', f);
  }
}

module.exports = { pool, query, tx, migrate };

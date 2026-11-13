const { query } = require('../db');
const defaults = require('../defaults');

// Small in-memory cache so the public site does not hit the DB for settings on every request.
let cache = {}; let cacheAt = 0;
const TTL = 30 * 1000;

const DEFAULTS = { site: defaults.site, booking: defaults.booking, templates: defaults.templates };

// Deep-merge saved values over defaults so new fields added in future versions still have values.
function merge(base, over) {
  if (Array.isArray(base) || Array.isArray(over)) return over ?? base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

async function getAll() {
  if (Date.now() - cacheAt < TTL && cache.site) return cache;
  const { rows } = await query('SELECT key, value FROM settings');
  const saved = Object.fromEntries(rows.map(r => [r.key, r.value]));
  cache = {};
  for (const k of Object.keys(DEFAULTS)) cache[k] = merge(DEFAULTS[k], saved[k]);
  cacheAt = Date.now();
  return cache;
}
async function get(key) { return (await getAll())[key]; }
async function set(key, value) {
  await query(`INSERT INTO settings(key, value, updated_at) VALUES ($1,$2,now())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value)]);
  cacheAt = 0;
}
module.exports = { getAll, get, set, DEFAULTS };

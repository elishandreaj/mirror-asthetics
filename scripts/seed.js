const { migrate, pool } = require('../src/db');
const { seedContent, seedAdmin } = require('../src/seed');
(async () => { await migrate(); const a = await seedContent(); const b = await seedAdmin(); if (!a && !b) console.log('Nothing to seed – database already has data.'); await pool.end(); })()
  .catch(e => { console.error(e.message); process.exit(1); });

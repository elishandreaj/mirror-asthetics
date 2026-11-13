// Fills an empty database with starting content and the first admin account.
const { query, tx } = require('./db');
const D = require('./defaults');
const config = require('./config');
const { hash } = require('./lib/auth');

async function seedContent() {
  const { rows } = await query('SELECT count(*)::int n FROM categories');
  if (rows[0].n > 0) return false;
  await tx(async db => {
    let cs = 0;
    for (const c of D.catalog) {
      const { rows: [cat] } = await db.query('INSERT INTO categories(name, sort) VALUES ($1,$2) RETURNING id', [c.name, cs += 10]);
      let ts = 0;
      for (const [name, dur, price, desc, featured] of c.items)
        await db.query('INSERT INTO treatments(category_id,name,description,duration_min,price,featured,sort) VALUES ($1,$2,$3,$4,$5,$6,$7)', [cat.id, name, desc, dur, price, !!featured, ts += 10]);
    }
    let s = 0;
    for (const p of D.practitioners) await db.query('INSERT INTO practitioners(name, role, credentials, specialties, sort) VALUES ($1,$2,$3,$4,$5)', [p.name, p.role, p.credentials, p.specialties, s += 10]);
    s = 0; for (const p of D.promos) await db.query('INSERT INTO promos(chip,title,body,sort) VALUES ($1,$2,$3,$4)', [p.chip, p.title, p.body, s += 10]);
    s = 0; for (const t of D.testimonials) await db.query('INSERT INTO testimonials(quote,author,sort) VALUES ($1,$2,$3)', [t.quote, t.author, s += 10]);
    s = 0; for (const [t, q, a] of D.faqs) await db.query('INSERT INTO faqs(topic,question,answer,sort) VALUES ($1,$2,$3,$4)', [t, q, a, s += 10]);
  });
  console.log('Seeded starting content (treatments, team, promos, FAQs).');
  return true;
}

async function seedAdmin() {
  const { rows } = await query('SELECT count(*)::int n FROM users');
  if (rows[0].n > 0) return false;
  if (!config.admin.email || !config.admin.password) {
    console.warn('No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars (or run `npm run create-admin`) to create the first admin.');
    return false;
  }
  await query('INSERT INTO users(email, name, role, password_hash) VALUES ($1,$2,$3,$4)', [config.admin.email.toLowerCase(), config.admin.name, 'admin', await hash(config.admin.password)]);
  console.log(`Created first admin account: ${config.admin.email}`);
  return true;
}
// One-time content upgrades for sites created with an earlier version.
// Only replaces content that is still exactly the old sample text (never overwrites the clinic's own edits).
const OLD_FAQ_QUESTIONS = ['Is there downtime?', 'Does it hurt?', 'Are treatments safe?', 'Can I get treated if pregnant or breastfeeding?', 'What aftercare do I need?', 'How do I reschedule or cancel?'];
async function upgradeContent() {
  const { rows: v } = await query("SELECT value FROM settings WHERE key = 'content_version'");
  const version = v[0] ? Number(v[0].value) : 1;
  if (version >= 2) return;
  const { rows } = await query('SELECT question FROM faqs ORDER BY id');
  const qs = rows.map(r => r.question);
  if (qs.length === OLD_FAQ_QUESTIONS.length && qs.every(q => OLD_FAQ_QUESTIONS.includes(q))) {
    await tx(async db => {
      await db.query('DELETE FROM faqs');
      let s = 0; for (const [t, q, a] of D.faqs) await db.query('INSERT INTO faqs(topic,question,answer,sort) VALUES ($1,$2,$3,$4)', [t, q, a, s += 10]);
    });
    console.log('Upgraded FAQ to the new grouped version.');
  }
  await query(`INSERT INTO settings(key, value) VALUES ('content_version', '2') ON CONFLICT (key) DO UPDATE SET value = '2'`);
}
module.exports = { seedContent, seedAdmin, upgradeContent };

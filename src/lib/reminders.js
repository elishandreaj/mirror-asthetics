// Every 30 minutes: email a reminder to clients whose appointment is tomorrow (pending or confirmed).
const { query } = require('../db');
const B = require('./bookings');
const mailer = require('./mailer');
const T = require('./time');

async function runOnce() {
  if (!mailer.enabled()) return 0;
  const tomorrow = T.addDays(T.today(), 1);
  const { rows } = await query(`SELECT id FROM bookings WHERE date = $1 AND status IN ('pending','confirmed') AND reminder_sent_at IS NULL AND client_email <> ''`, [tomorrow]);
  let n = 0;
  for (const r of rows) {
    const b = await B.getById(r.id);
    if (await mailer.sendTemplate('reminder', b)) { await query('UPDATE bookings SET reminder_sent_at = now() WHERE id = $1', [r.id]); n++; }
  }
  if (n) console.log(`Sent ${n} reminder email(s) for ${tomorrow}.`);
  return n;
}
function start() {
  // Hourly between 9 AM and 8 PM clinic time. Kept infrequent so a free database can sleep between checks.
  const tick = () => { const h = new Date().getHours(); if (h >= 9 && h <= 20) runOnce().catch(e => console.error('Reminder job failed', e.message)); };
  setTimeout(tick, 60 * 1000); setInterval(tick, 60 * 60 * 1000);
}
module.exports = { start, runOnce };

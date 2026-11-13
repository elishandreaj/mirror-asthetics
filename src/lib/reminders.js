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
  const tick = () => { if (new Date().getHours() >= 9) runOnce().catch(e => console.error('Reminder job failed', e.message)); }; // only from 9 AM
  setTimeout(tick, 15 * 1000); setInterval(tick, 30 * 60 * 1000);
}
module.exports = { start, runOnce };

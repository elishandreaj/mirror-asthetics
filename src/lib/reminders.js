// Periodic mail jobs: appointment reminders, aftercare after completion, and delayed follow-up.
const { query } = require('../db');
const B = require('./bookings');
const mailer = require('./mailer');
const settings = require('./settings');
const T = require('./time');

let completionEmailRun = null;
async function processCompletionEmails() {
  if (!mailer.enabled()) return 0;
  const { followupDelayDays } = await settings.get('booking');
  const { rows } = await query(`SELECT id, aftercare_sent_at, followup_sent_at,
      (completed_at <= now() - make_interval(days => $1::int)) AS followup_due
    FROM bookings
    WHERE status = 'completed' AND completed_at IS NOT NULL AND client_email <> ''
      AND (aftercare_sent_at IS NULL OR (completed_at <= now() - make_interval(days => $1::int) AND followup_sent_at IS NULL))
    ORDER BY completed_at LIMIT 100`, [followupDelayDays]);
  let sentCount = 0;
  for (const row of rows) {
    const b = await B.getById(row.id);
    if (!b) continue;
    if (!row.aftercare_sent_at && await mailer.sendTemplate('aftercare', b)) {
      await query('UPDATE bookings SET aftercare_sent_at = now() WHERE id = $1 AND aftercare_sent_at IS NULL', [row.id]);
      sentCount++;
    }
    if (row.followup_due && !row.followup_sent_at && await mailer.sendTemplate('followup', b)) {
      await query('UPDATE bookings SET followup_sent_at = now() WHERE id = $1 AND followup_sent_at IS NULL', [row.id]);
      sentCount++;
    }
  }
  if (sentCount) console.log(`Sent ${sentCount} completion email(s).`);
  return sentCount;
}
function runCompletionEmails() {
  if (completionEmailRun) return completionEmailRun.then(() => runCompletionEmails());
  completionEmailRun = processCompletionEmails().finally(() => { completionEmailRun = null; });
  return completionEmailRun;
}

async function runOnce() {
  if (!mailer.enabled()) return 0;
  let n = await runCompletionEmails();
  const tomorrow = T.addDays(T.today(), 1);
  const { rows } = await query(`SELECT id FROM bookings WHERE date = $1 AND status IN ('pending','confirmed') AND reminder_sent_at IS NULL AND client_email <> ''`, [tomorrow]);
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
module.exports = { start, runOnce, runCompletionEmails };

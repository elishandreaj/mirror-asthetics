// Email sending (optional). If SMTP is not configured, emails are skipped and logged.
const nodemailer = require('nodemailer');
const config = require('../config');
const settings = require('./settings');
const T = require('./time');

let transport = null;
if (config.smtp.host && config.smtp.user) {
  transport = nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: { user: config.smtp.user, pass: config.smtp.pass } });
}
const enabled = () => !!transport;

// Fill {placeholders} in a template using booking data
async function fill(text, b) {
  const { site, booking } = await settings.getAll();
  const map = {
    name: b.client_name, code: b.code, service: b.service, specialist: b.practitioner_name || 'Any available',
    date: T.fmtDate(b.date), time: T.fmtTime(b.start_min), status: b.status, type: b.type === 'consult' ? 'consultation' : 'treatment',
    clinic_phone: site.phone, clinic_address: site.address, cancel_hours: booking.cancelHours,
    manage_link: `${config.publicUrl}/#manage`, site_link: config.publicUrl, total: b.price ? `₱${Number(b.price).toLocaleString('en-PH')}` : 'Free',
  };
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

async function send({ to, subject, text, replyTo }) {
  if (!to) return false;
  if (!transport) { console.log(`[mail skipped – SMTP not set] to=${to} subject="${subject}"`); return false; }
  try {
    const { site } = await settings.getAll();
    await transport.sendMail({ from: config.smtp.from || config.smtp.user, to, subject, text, replyTo: replyTo || site.email });
    return true;
  } catch (e) { console.error('Email failed:', e.message); return false; }
}

// Send one of the saved templates (received/confirmed/reminder/rescheduled/cancelled) to the client
async function sendTemplate(key, b) {
  const { templates } = await settings.getAll();
  const tpl = templates.find(t => t.key === key);
  if (!tpl || !b.client_email) return false;
  return send({ to: b.client_email, subject: await fill(tpl.subject, b), text: await fill(tpl.body, b) });
}

async function notifyClinic(b) {
  const { site } = await settings.getAll();
  const to = config.notifyEmail || site.email;
  const text = `New online booking (${b.status})\n\nRef: ${b.code}\nClient: ${b.client_name} · ${b.client_phone} · ${b.client_email}\nService: ${b.service}\n` +
    `Specialist: ${b.practitioner_name || 'Any'}\nDate: ${T.fmtDate(b.date)} ${T.fmtTime(b.start_min)}\n\nOpen the admin dashboard to confirm: ${config.publicUrl}/admin/`;
  return send({ to, subject: `New booking ${b.code} – ${T.fmtDate(b.date)} ${T.fmtTime(b.start_min)}`, text });
}
module.exports = { enabled, send, sendTemplate, notifyClinic, fill };

// Email sending (optional). If SMTP is not configured, emails are skipped and logged.
const nodemailer = require('nodemailer');
const config = require('../config');
const settings = require('./settings');
const T = require('./time');

// Two ways to send: Brevo's HTTPS API (works on free hosts that block SMTP ports, e.g. Render free)
// or classic SMTP (Gmail, etc.). Brevo is used when BREVO_API_KEY is set.
let transport = null;
if (config.brevoKey) {
  transport = {
    async sendMail({ from, to, subject, text, html, replyTo }) {
      const m = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(from || '');
      const sender = m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(from || '').trim() };
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html, ...(replyTo ? { replyTo: { email: replyTo } } : {}) }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    },
  };
} else if (config.smtp.host && config.smtp.user) {
  transport = nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: { user: config.smtp.user, pass: config.smtp.pass } });
}
const enabled = () => !!transport;

function emailHtml(text, clinicName) {
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const details = /^(Service|Specialist|Date|Time|Estimated total|Reference code|Booking code|Code|Ref|Status|Address):\s*(.*)$/i;
  const signatureNames = [clinicName, 'Mirror Aesthetics'].filter(Boolean);
  const lines = String(text).split(/\r?\n/);
  const htmlLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div style="height:12px;line-height:12px">&nbsp;</div>';
    const signature = /^(.+?)\s*[·•]\s*(.+)$/.exec(trimmed);
    if (signature && signatureNames.some(name => signature[1].trim() === name)) {
      return `<div style="margin-top:32px;padding-top:18px;border-top:1px solid #d8cfc2"><div style="font-size:22px;line-height:1.3;font-weight:700;letter-spacing:.02em">${escapeHtml(signature[1].trim())}</div><div style="margin-top:5px;font-size:15px;font-weight:600;color:#5d554d">Clinic contact: ${escapeHtml(signature[2].trim())}</div></div>`;
    }
    const match = details.exec(trimmed);
    if (match) return `<div style="margin:7px 0;padding:8px 10px;background:#f7f4ec;border-radius:4px"><strong>${escapeHtml(match[1])}:</strong> <strong>${escapeHtml(match[2])}</strong></div>`;
    const formattedLine = escapeHtml(line).replace(/\bCONFIRMED\b/g, '<strong>CONFIRMED</strong>');
    return `<div style="margin:5px 0">${formattedLine}</div>`;
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#24211f">${htmlLines.join('')}</div>`;
}

// Fill {placeholders} in a template using booking data
async function fill(text, b) {
  const { site, booking } = await settings.getAll();
  const map = {
    name: b.client_name, code: b.code, service: b.service, specialist: b.practitioner_name || 'Any available',
    date: T.fmtDate(b.date), time: T.fmtTime(b.start_min), status: b.status, type: b.type === 'consult' ? 'consultation' : 'treatment',
    clinic_phone: site.phone, clinic_address: site.address, cancel_hours: booking.cancelHours,
    manage_link: `${config.publicUrl}/#manage?code=${b.code}`, site_link: config.publicUrl, total: b.price ? `₱${Number(b.price).toLocaleString('en-PH')}` : 'Free',
  };
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
}

async function send({ to, subject, text, replyTo }) {
  if (!to) return false;
  if (!transport) { console.log(`[mail skipped – email not set up] to=${to} subject="${subject}"`); return false; }
  try {
    const { site } = await settings.getAll();
    await transport.sendMail({ from: config.smtp.from || config.smtp.user || `"${site.name}" <${site.email}>`, to, subject, text, html: emailHtml(text, site.name), replyTo: replyTo || site.email });
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
    `Specialist: ${b.practitioner_name || 'Any'}\nDate: ${T.fmtDate(b.date)} ${T.fmtTime(b.start_min)}\n\nOpen the admin dashboard to confirm: ${config.publicUrl}${config.adminPath}`;
  return send({ to, subject: `New booking ${b.code} – ${T.fmtDate(b.date)} ${T.fmtTime(b.start_min)}`, text });
}
module.exports = { enabled, send, sendTemplate, notifyClinic, fill };

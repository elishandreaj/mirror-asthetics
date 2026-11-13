// Clinic time helpers. process.env.TZ is set to Asia/Manila in config.js, so Date uses clinic time.
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); };
const dow = s => parseDate(s).getDay();
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseDate(s)) === s;
const fmtTime = m => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${pad(mm)} ${h < 12 ? 'AM' : 'PM'}`; };
const fmtDate = s => parseDate(s).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
// minutes from now until a booking starts (negative if in the past)
const minutesUntil = (date, startMin) => (parseDate(date).getTime() + startMin * 60000 - Date.now()) / 60000;
module.exports = { pad, ymd, today, nowMin, parseDate, addDays, dow, isDate, fmtTime, fmtDate, minutesUntil };

const crypto = require('crypto');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => 'MA-' + Array.from(crypto.randomBytes(6), b => ALPHA[b % ALPHA.length]).join('');
const normPhone = p => {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+63')) s = '0' + s.slice(3); else if (s.startsWith('63') && s.length === 12) s = '0' + s.slice(2);
  return s;
};
const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const int = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
const bool = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
class HttpError extends Error { constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; } }
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); // async handler
module.exports = { newCode, normPhone, str, int, bool, HttpError, ah };

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { query } = require('../db');
const { HttpError } = require('./util');

const COOKIE = 'ma_session';
const cookieOpts = () => ({ httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/', maxAge: config.sessionHours * 3600 * 1000 });

function issue(res, user) {
  const token = jwt.sign({ uid: user.id, role: user.role }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
  res.cookie(COOKIE, token, cookieOpts());
}
function clear(res) { res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined }); }

// Loads the logged-in user (or 401). Also requires a custom header on writes = CSRF protection.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE];
    if (!token) throw new HttpError(401, 'Please sign in.');
    let p; try { p = jwt.verify(token, config.jwtSecret); } catch { throw new HttpError(401, 'Your session expired. Please sign in again.'); }
    const { rows } = await query('SELECT id, email, name, role, active FROM users WHERE id = $1', [p.uid]);
    if (!rows[0] || !rows[0].active) throw new HttpError(401, 'Account disabled.');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'fetch') throw new HttpError(403, 'Bad request origin.');
    req.user = rows[0];
    next();
  } catch (e) { next(e); }
}
const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Only an admin can do this.')));

const hash = pw => bcrypt.hash(pw, 12);
const verify = (pw, h) => bcrypt.compare(pw, h);
function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}
async function audit(user, action, entity, entityId, details) {
  try {
    await query('INSERT INTO audit_log(user_id, user_name, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)',
      [user?.id || null, user?.name || 'system', action, entity || null, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null]);
  } catch (e) { console.error('audit failed', e.message); }
}
module.exports = { issue, clear, requireAuth, requireAdmin, hash, verify, checkPassword, audit };

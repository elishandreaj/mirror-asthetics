const express = require('express');
const rateLimit = require('express-rate-limit');
const { query, tx } = require('../db');
const settings = require('../lib/settings');
const B = require('../lib/bookings');
const { slotsFor } = require('../lib/availability');
const { validateClient } = require('../lib/validate');
const { upload, saveImage, deleteMedia, mediaUrl } = require('../lib/media');
const mailer = require('../lib/mailer');
const A = require('../lib/auth');
const T = require('../lib/time');
const { ah, HttpError, str, int, bool } = require('../lib/util');

const r = express.Router();
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'noshow'];

/* ---------------------------------------------------------------- AUTH */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });

r.post('/login', loginLimiter, ah(async (req, res) => {
  const email = str(req.body.email, 160).toLowerCase();
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !u.active || !(await A.verify(String(req.body.password || ''), u.password_hash))) throw new HttpError(401, 'Incorrect email or password.');
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
  A.issue(res, u); A.audit(u, 'login');
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));
r.post('/logout', (req, res) => { A.clear(res); res.json({ ok: true }); });

r.use(A.requireAuth); // ------- everything below needs a signed-in staff/admin -------

r.get('/me', (req, res) => res.json({ user: req.user, emailEnabled: mailer.enabled() }));
r.post('/me/password', ah(async (req, res) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await A.verify(String(req.body.current || ''), rows[0].password_hash))) throw new HttpError(400, 'Current password is incorrect.');
  const err = A.checkPassword(req.body.password); if (err) throw new HttpError(400, err);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await A.hash(req.body.password), req.user.id]);
  A.audit(req.user, 'change_password'); res.json({ ok: true });
}));

/* ---------------------------------------------------------------- DASHBOARD */
r.get('/dashboard', ah(async (req, res) => {
  const t = T.today(), wk = T.addDays(t, 7);
  const cfg = await settings.get('booking');
  const [today, counts] = await Promise.all([
    query(`${B.SELECT} WHERE b.date = $1 AND b.status <> 'cancelled' ORDER BY b.start_min`, [t]),
    query(`SELECT
        count(*) FILTER (WHERE status='pending' AND date >= $1)::int AS pending,
        count(*) FILTER (WHERE date = $1 AND status IN ('pending','confirmed')) ::int AS today,
        count(*) FILTER (WHERE date BETWEEN $1 AND $2 AND status IN ('pending','confirmed'))::int AS week,
        count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS new24
      FROM bookings`, [t, wk]),
  ]);
  res.json({ today: today.rows.map(b => B.decorate(b, cfg)), counts: counts.rows[0] });
}));

/* ---------------------------------------------------------------- BOOKINGS */
r.get('/bookings', ah(async (req, res) => {
  const cfg = await settings.get('booking');
  const where = [], p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', '$' + p.length)); };
  if (T.isDate(req.query.from)) add('b.date >= ?', req.query.from);
  if (T.isDate(req.query.to)) add('b.date <= ?', req.query.to);
  if (STATUSES.includes(req.query.status)) add('b.status = ?', req.query.status);
  if (req.query.prac) add('b.practitioner_id = ?', int(req.query.prac));
  if (req.query.treatment === 'consult') where.push(`b.type = 'consult'`);
  else if (req.query.treatment) add('EXISTS (SELECT 1 FROM booking_items i WHERE i.booking_id=b.id AND i.treatment_id = ?)', int(req.query.treatment));
  if (req.query.q) {
    p.push('%' + str(req.query.q, 80) + '%'); const i = '$' + p.length;
    where.push(`(b.client_name ILIKE ${i} OR b.code ILIKE ${i} OR b.client_phone ILIKE ${i} OR b.client_email ILIKE ${i})`);
  }
  const order = req.query.sort === 'newest' ? 'b.created_at DESC' : 'b.date, b.start_min';
  const { rows } = await query(`${B.SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 500`, p);
  res.json({ bookings: rows.map(b => { B.decorate(b, cfg); return listView(b); }) });
}));
const listView = b => ({ id: b.id, code: b.code, type: b.type, status: b.status, source: b.source, date: b.date, start: b.start_min, end: b.end_min,
  service: b.service, practitioner: b.practitioner_name, practitionerId: b.practitioner_id, client: b.client_name, phone: b.client_phone, price: b.price, created_at: b.created_at });

r.get('/bookings/:id', ah(async (req, res) => {
  const b = await B.getById(int(req.params.id));
  if (!b) throw new HttpError(404, 'Booking not found.');
  b.photo = b.photo_id ? `/api/admin/media/${b.photo_id}` : null;
  res.json({ booking: b });
}));

// Manual booking (phone, walk-in, Messenger …)
r.post('/bookings', ah(async (req, res) => {
  const { data: client, errors } = validateClient(req.body.client || {}, { requireConsent: false, staff: true });
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'confirmed';
  const b = await B.create({ type: req.body.type, treatmentIds: req.body.treatmentIds, practitionerId: req.body.prac, date: req.body.date, start: req.body.start,
    client, source: str(req.body.source, 20) || 'admin', status, staffNotes: str(req.body.staffNotes, 2000) }, { staff: true, force: bool(req.body.force) });
  A.audit(req.user, 'create', 'booking', b.id, { code: b.code });
  if (bool(req.body.notify)) mailer.sendTemplate(status === 'confirmed' ? 'confirmed' : 'received', b);
  res.status(201).json({ booking: b });
}));

r.patch('/bookings/:id', ah(async (req, res) => {
  const id = int(req.params.id);
  const b = await B.getById(id); if (!b) throw new HttpError(404, 'Booking not found.');
  const sets = [], p = [];
  const set = (col, v) => { p.push(v); sets.push(`${col} = $${p.length}`); };
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) throw new HttpError(400, 'Invalid status.');
    set('status', req.body.status);
    if (req.body.status === 'cancelled') sets.push('cancelled_at = now()');
  }
  if (req.body.staff_notes !== undefined) set('staff_notes', str(req.body.staff_notes, 4000));
  if (req.body.client) {
    const { data, errors } = validateClient({ ...{ name: b.client_name, phone: b.client_phone, email: b.client_email, age: b.client_age, concerns: b.concerns,
      allergies: b.allergies, pregnant: b.pregnant, medications: b.medications, notes: b.notes }, ...req.body.client }, { requireConsent: false, staff: true });
    if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
    set('client_name', data.name); set('client_phone', data.phone); set('client_phone_norm', require('../lib/util').normPhone(data.phone));
    set('client_email', data.email); set('client_age', data.age); set('concerns', data.concerns); set('allergies', data.allergies);
    set('pregnant', data.pregnant); set('medications', data.medications); set('notes', data.notes);
  }
  if (!sets.length) return res.json({ booking: b });
  p.push(id);
  await query(`UPDATE bookings SET ${sets.join(', ')}, updated_at = now() WHERE id = $${p.length}`, p);
  const nb = await B.getById(id);
  A.audit(req.user, 'update', 'booking', id, { status: req.body.status, from: b.status });
  if (req.body.status && req.body.status !== b.status && bool(req.body.notify) && ['confirmed', 'cancelled'].includes(req.body.status)) mailer.sendTemplate(req.body.status, nb);
  res.json({ booking: nb });
}));

r.post('/bookings/:id/reschedule', ah(async (req, res) => {
  const nb = await B.reschedule(int(req.params.id), { date: req.body.date, start: req.body.start, practitionerId: req.body.prac }, { staff: true, force: bool(req.body.force) });
  A.audit(req.user, 'reschedule', 'booking', nb.id, { date: nb.date, start: nb.start_min });
  if (bool(req.body.notify)) mailer.sendTemplate('rescheduled', nb);
  res.json({ booking: nb });
}));

r.delete('/bookings/:id', A.requireAdmin, ah(async (req, res) => {
  const b = await B.getById(int(req.params.id)); if (!b) throw new HttpError(404, 'Booking not found.');
  await tx(async db => { await db.query('DELETE FROM bookings WHERE id=$1', [b.id]); if (b.photo_id) await deleteMedia(b.photo_id, db); });
  A.audit(req.user, 'delete', 'booking', b.id, { code: b.code, client: b.client_name });
  res.json({ ok: true });
}));

// Filled-in message text for copy & paste into SMS / Viber / Messenger
r.get('/bookings/:id/message/:key', ah(async (req, res) => {
  const b = await B.getById(int(req.params.id)); if (!b) throw new HttpError(404, 'Booking not found.');
  const tpl = (await settings.get('templates')).find(t => t.key === req.params.key); if (!tpl) throw new HttpError(404, 'Template not found.');
  res.json({ subject: await mailer.fill(tpl.subject, b), body: await mailer.fill(tpl.body, b) });
}));
r.post('/bookings/:id/email/:key', ah(async (req, res) => {
  const b = await B.getById(int(req.params.id)); if (!b) throw new HttpError(404, 'Booking not found.');
  if (!mailer.enabled()) throw new HttpError(400, 'Email is not set up yet (SMTP settings). Use "Copy message" instead.');
  if (!b.client_email) throw new HttpError(400, 'This client has no email address.');
  const ok = await mailer.sendTemplate(req.params.key, b); if (!ok) throw new HttpError(502, 'Email could not be sent. Check SMTP settings.');
  A.audit(req.user, 'email', 'booking', b.id, { template: req.params.key }); res.json({ ok: true });
}));

r.post('/availability/day', ah(async (req, res) => {
  const cfg = await settings.get('booking');
  if (!T.isDate(req.body.date)) throw new HttpError(400, 'Invalid date.');
  let duration;
  if (req.body.bookingId) { const b = await B.getById(int(req.body.bookingId)); duration = b?.duration_min; }
  if (!duration) duration = (await B.resolveServices(req.body.type, req.body.treatmentIds, cfg)).duration;
  const slots = await slotsFor(cfg, req.body.date, duration, { prac: req.body.prac || 'any', ignoreId: int(req.body.bookingId) || null, staff: true });
  res.json({ slots, duration });
}));

r.get('/calendar', ah(async (req, res) => {
  const y = int(req.query.year), m = int(req.query.month);
  if (!(y > 2000 && m >= 1 && m <= 12)) throw new HttpError(400, 'Invalid month.');
  const first = `${y}-${T.pad(m)}-01`, last = T.ymd(new Date(y, m, 0));
  const [bk, bl] = await Promise.all([
    query(`SELECT date, status, count(*)::int n FROM bookings WHERE date BETWEEN $1 AND $2 GROUP BY date, status`, [first, last]),
    query(`SELECT date, count(*)::int n FROM blocks WHERE date BETWEEN $1 AND $2 GROUP BY date`, [first, last]),
  ]);
  const days = {};
  for (const row of bk.rows) { const d = (days[row.date] ||= { total: 0, pending: 0, blocks: 0 }); if (row.status !== 'cancelled') d.total += row.n; if (row.status === 'pending') d.pending += row.n; }
  for (const row of bl.rows) (days[row.date] ||= { total: 0, pending: 0, blocks: 0 }).blocks = row.n;
  res.json({ days });
}));

r.get('/export.csv', ah(async (req, res) => {
  const from = T.isDate(req.query.from) ? req.query.from : T.addDays(T.today(), -30), to = T.isDate(req.query.to) ? req.query.to : T.addDays(T.today(), 60);
  const cfg = await settings.get('booking');
  const { rows } = await query(`${B.SELECT} WHERE b.date BETWEEN $1 AND $2 ORDER BY b.date, b.start_min`, [from, to]);
  const cols = ['code', 'date', 'time', 'status', 'service', 'specialist', 'price', 'client', 'phone', 'email', 'source', 'staff_notes', 'created_at'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map(b => { B.decorate(b, cfg); return [b.code, b.date, T.fmtTime(b.start_min), b.status, b.service, b.practitioner_name, b.price, b.client_name, b.client_phone, b.client_email, b.source, b.staff_notes, b.created_at?.toISOString()].map(q).join(','); });
  A.audit(req.user, 'export', 'bookings', null, { from, to, rows: rows.length });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bookings_${from}_to_${to}.csv"` });
  res.send('﻿' + cols.join(',') + '\n' + lines.join('\n'));
}));

/* ---------------------------------------------------------------- BLOCKED TIMES */
r.get('/blocks', ah(async (req, res) => {
  const { rows } = await query(`SELECT bl.*, p.name AS practitioner_name FROM blocks bl LEFT JOIN practitioners p ON p.id = bl.practitioner_id WHERE bl.date >= $1 ORDER BY bl.date, bl.from_min`, [T.isDate(req.query.from) ? req.query.from : T.today()]);
  res.json({ blocks: rows });
}));
r.post('/blocks', ah(async (req, res) => {
  const date = req.body.date, from = int(req.body.from ?? 0), to = int(req.body.to ?? 1440);
  if (!T.isDate(date)) throw new HttpError(400, 'Choose a date.');
  if (!(from >= 0 && to <= 1440 && to > from)) throw new HttpError(400, 'End time must be after start time.');
  const { rows } = await query('INSERT INTO blocks(date, from_min, to_min, practitioner_id, note) VALUES ($1,$2,$3,$4,$5) RETURNING *', [date, from, to, int(req.body.practitionerId) || null, str(req.body.note, 200) || 'Blocked']);
  A.audit(req.user, 'create', 'block', rows[0].id, rows[0]); res.status(201).json({ block: rows[0] });
}));
r.delete('/blocks/:id', ah(async (req, res) => { await query('DELETE FROM blocks WHERE id=$1', [int(req.params.id)]); A.audit(req.user, 'delete', 'block', req.params.id); res.json({ ok: true }); }));

/* ---------------------------------------------------------------- MEDIA (private images for staff) */
r.get('/media/:id', ah(async (req, res) => {
  const { rows } = await query('SELECT mime, data FROM media WHERE id = $1', [req.params.id]).catch(() => ({ rows: [] }));
  if (!rows[0]) throw new HttpError(404, 'Not found');
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=3600' }); res.send(rows[0].data);
}));

/* ---------------------------------------------------------------- GALLERY (before & after) – staff allowed */
const galleryView = g => ({ ...g, before: mediaUrl(g.before_id), after: mediaUrl(g.after_id) });
r.get('/gallery', ah(async (req, res) => { const { rows } = await query('SELECT * FROM gallery ORDER BY sort, id DESC'); res.json({ items: rows.map(galleryView) }); }));
const galUpload = upload.fields([{ name: 'before', maxCount: 1 }, { name: 'after', maxCount: 1 }]);
r.post('/gallery', galUpload, ah(async (req, res) => {
  const f = req.body;
  if (!str(f.title)) throw new HttpError(400, 'Add a title.');
  if (!req.files?.before || !req.files?.after) throw new HttpError(400, 'Upload both a BEFORE and an AFTER photo.');
  if (!bool(f.consent)) throw new HttpError(400, "Confirm you have the client's written consent to publish these photos.");
  const before = await saveImage(req.files.before[0].buffer), after = await saveImage(req.files.after[0].buffer);
  const { rows } = await query(`INSERT INTO gallery(title, treatment_label, caption, before_id, after_id, consent_confirmed, published, sort) VALUES ($1,$2,$3,$4,$5,true,$6,$7) RETURNING *`,
    [str(f.title, 120), str(f.treatment, 120), str(f.caption, 500), before, after, f.published === undefined ? true : bool(f.published), int(f.sort) || 0]);
  A.audit(req.user, 'create', 'gallery', rows[0].id, { title: rows[0].title }); res.status(201).json({ item: galleryView(rows[0]) });
}));
r.patch('/gallery/:id', galUpload, ah(async (req, res) => {
  const id = int(req.params.id); const { rows: [g] } = await query('SELECT * FROM gallery WHERE id=$1', [id]); if (!g) throw new HttpError(404, 'Not found');
  const f = req.body; const upd = { title: g.title, treatment_label: g.treatment_label, caption: g.caption, published: g.published, sort: g.sort, before_id: g.before_id, after_id: g.after_id };
  if (f.title !== undefined) upd.title = str(f.title, 120) || g.title;
  if (f.treatment !== undefined) upd.treatment_label = str(f.treatment, 120);
  if (f.caption !== undefined) upd.caption = str(f.caption, 500);
  if (f.published !== undefined) upd.published = bool(f.published);
  if (f.sort !== undefined) upd.sort = int(f.sort) || 0;
  const old = [];
  if (req.files?.before) { old.push(g.before_id); upd.before_id = await saveImage(req.files.before[0].buffer); }
  if (req.files?.after) { old.push(g.after_id); upd.after_id = await saveImage(req.files.after[0].buffer); }
  const { rows } = await query(`UPDATE gallery SET title=$1, treatment_label=$2, caption=$3, published=$4, sort=$5, before_id=$6, after_id=$7 WHERE id=$8 RETURNING *`,
    [upd.title, upd.treatment_label, upd.caption, upd.published, upd.sort, upd.before_id, upd.after_id, id]);
  for (const m of old) await deleteMedia(m);
  A.audit(req.user, 'update', 'gallery', id); res.json({ item: galleryView(rows[0]) });
}));
r.delete('/gallery/:id', ah(async (req, res) => {
  const { rows: [g] } = await query('DELETE FROM gallery WHERE id=$1 RETURNING *', [int(req.params.id)]);
  if (g) { await deleteMedia(g.before_id); await deleteMedia(g.after_id); A.audit(req.user, 'delete', 'gallery', g.id, { title: g.title }); }
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- CATALOGUE (admin) */
r.get('/catalog', ah(async (req, res) => {
  const [c, t] = await Promise.all([query('SELECT * FROM categories ORDER BY sort, id'), query('SELECT * FROM treatments ORDER BY sort, id')]);
  res.json({ categories: c.rows, treatments: t.rows });
}));
r.post('/categories', A.requireAdmin, ah(async (req, res) => {
  const name = str(req.body.name, 120); if (!name) throw new HttpError(400, 'Name is required.');
  const { rows } = await query('INSERT INTO categories(name, sort, active) VALUES ($1,$2,$3) RETURNING *', [name, int(req.body.sort) || 0, req.body.active === undefined ? true : bool(req.body.active)]);
  A.audit(req.user, 'create', 'category', rows[0].id, { name }); res.status(201).json({ category: rows[0] });
}));
r.patch('/categories/:id', A.requireAdmin, ah(async (req, res) => {
  const { rows: [c] } = await query('SELECT * FROM categories WHERE id=$1', [int(req.params.id)]); if (!c) throw new HttpError(404, 'Not found');
  const { rows } = await query('UPDATE categories SET name=$1, sort=$2, active=$3 WHERE id=$4 RETURNING *',
    [str(req.body.name ?? c.name, 120) || c.name, req.body.sort === undefined ? c.sort : int(req.body.sort) || 0, req.body.active === undefined ? c.active : bool(req.body.active), c.id]);
  A.audit(req.user, 'update', 'category', c.id); res.json({ category: rows[0] });
}));
r.delete('/categories/:id', A.requireAdmin, ah(async (req, res) => {
  const { rows } = await query('SELECT count(*)::int n FROM treatments WHERE category_id=$1', [int(req.params.id)]);
  if (rows[0].n) throw new HttpError(409, 'Move or delete the treatments in this category first (or just hide the category).');
  await query('DELETE FROM categories WHERE id=$1', [int(req.params.id)]); A.audit(req.user, 'delete', 'category', req.params.id); res.json({ ok: true });
}));

function treatmentFields(b, cur = {}) {
  const v = {
    category_id: b.category_id !== undefined ? int(b.category_id) : cur.category_id,
    name: b.name !== undefined ? str(b.name, 160) : cur.name,
    description: b.description !== undefined ? str(b.description, 1000) : cur.description ?? '',
    duration_min: b.duration_min !== undefined ? int(b.duration_min) : cur.duration_min,
    price: b.price !== undefined ? Number(b.price) : cur.price,
    featured: b.featured !== undefined ? bool(b.featured) : cur.featured ?? false,
    active: b.active !== undefined ? bool(b.active) : cur.active ?? true,
    sort: b.sort !== undefined ? int(b.sort) || 0 : cur.sort ?? 0,
  };
  if (!v.name) throw new HttpError(400, 'Name is required.');
  if (!Number.isInteger(v.category_id)) throw new HttpError(400, 'Choose a category.');
  if (!(v.duration_min >= 5 && v.duration_min <= 600)) throw new HttpError(400, 'Duration must be 5–600 minutes.');
  if (!(v.price >= 0 && v.price < 1e7)) throw new HttpError(400, 'Price must be 0 or more.');
  return v;
}
r.post('/treatments', A.requireAdmin, ah(async (req, res) => {
  const v = treatmentFields(req.body);
  const { rows } = await query('INSERT INTO treatments(category_id,name,description,duration_min,price,featured,active,sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [v.category_id, v.name, v.description, v.duration_min, v.price, v.featured, v.active, v.sort]);
  A.audit(req.user, 'create', 'treatment', rows[0].id, { name: v.name }); res.status(201).json({ treatment: rows[0] });
}));
r.patch('/treatments/:id', A.requireAdmin, ah(async (req, res) => {
  const { rows: [cur] } = await query('SELECT * FROM treatments WHERE id=$1', [int(req.params.id)]); if (!cur) throw new HttpError(404, 'Not found');
  const v = treatmentFields(req.body, cur);
  const { rows } = await query('UPDATE treatments SET category_id=$1,name=$2,description=$3,duration_min=$4,price=$5,featured=$6,active=$7,sort=$8 WHERE id=$9 RETURNING *',
    [v.category_id, v.name, v.description, v.duration_min, v.price, v.featured, v.active, v.sort, cur.id]);
  A.audit(req.user, 'update', 'treatment', cur.id, { name: v.name, price: v.price, duration: v.duration_min }); res.json({ treatment: rows[0] });
}));
r.delete('/treatments/:id', A.requireAdmin, ah(async (req, res) => {
  await query('DELETE FROM treatments WHERE id=$1', [int(req.params.id)]); // past bookings keep their snapshot (booking_items)
  A.audit(req.user, 'delete', 'treatment', req.params.id); res.json({ ok: true });
}));

/* ---------------------------------------------------------------- TEAM (admin) */
const pracView = p => ({ ...p, photo: mediaUrl(p.photo_id) });
r.get('/practitioners', ah(async (req, res) => { const { rows } = await query('SELECT * FROM practitioners ORDER BY sort, id'); res.json({ practitioners: rows.map(pracView) }); }));
r.post('/practitioners', A.requireAdmin, upload.single('photo'), ah(async (req, res) => {
  const b = req.body; if (!str(b.name)) throw new HttpError(400, 'Name is required.');
  const photo = req.file ? await saveImage(req.file.buffer, { maxSize: 800 }) : null;
  const { rows } = await query('INSERT INTO practitioners(name, role, credentials, specialties, photo_id, bookable, active, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [str(b.name, 100), str(b.role, 120), str(b.credentials, 200), str(b.specialties, 300), photo, b.bookable === undefined ? true : bool(b.bookable), b.active === undefined ? true : bool(b.active), int(b.sort) || 0]);
  A.audit(req.user, 'create', 'practitioner', rows[0].id, { name: rows[0].name }); res.status(201).json({ practitioner: pracView(rows[0]) });
}));
r.patch('/practitioners/:id', A.requireAdmin, upload.single('photo'), ah(async (req, res) => {
  const { rows: [p] } = await query('SELECT * FROM practitioners WHERE id=$1', [int(req.params.id)]); if (!p) throw new HttpError(404, 'Not found');
  const b = req.body; let photo = p.photo_id; const old = [];
  if (req.file) { old.push(p.photo_id); photo = await saveImage(req.file.buffer, { maxSize: 800 }); }
  if (bool(b.removePhoto)) { old.push(p.photo_id); photo = null; }
  const { rows } = await query('UPDATE practitioners SET name=$1, role=$2, credentials=$3, specialties=$4, photo_id=$5, bookable=$6, active=$7, sort=$8 WHERE id=$9 RETURNING *',
    [str(b.name ?? p.name, 100) || p.name, str(b.role ?? p.role, 120), str(b.credentials ?? p.credentials, 200), str(b.specialties ?? p.specialties, 300), photo,
      b.bookable === undefined ? p.bookable : bool(b.bookable), b.active === undefined ? p.active : bool(b.active), b.sort === undefined ? p.sort : int(b.sort) || 0, p.id]);
  for (const m of old) await deleteMedia(m);
  A.audit(req.user, 'update', 'practitioner', p.id); res.json({ practitioner: pracView(rows[0]) });
}));
r.delete('/practitioners/:id', A.requireAdmin, ah(async (req, res) => {
  const { rows: [p] } = await query('SELECT * FROM practitioners WHERE id=$1', [int(req.params.id)]); if (!p) return res.json({ ok: true });
  const { rows } = await query(`SELECT count(*)::int n FROM bookings WHERE practitioner_id=$1 AND date >= CURRENT_DATE AND status IN ('pending','confirmed')`, [p.id]);
  if (rows[0].n) throw new HttpError(409, `${p.name} still has ${rows[0].n} upcoming booking(s). Reassign them or hide this person instead.`);
  await query('DELETE FROM practitioners WHERE id=$1', [p.id]); await deleteMedia(p.photo_id);
  A.audit(req.user, 'delete', 'practitioner', p.id, { name: p.name }); res.json({ ok: true });
}));

/* ---------------------------------------------------------------- SIMPLE CONTENT LISTS (admin) */
const LISTS = {
  promos: { cols: { chip: 60, title: 160, body: 600 }, required: 'title' },
  testimonials: { cols: { quote: 600, author: 120 }, required: 'quote' },
  faqs: { cols: { question: 300, answer: 2000 }, required: 'question' },
};
for (const [table, spec] of Object.entries(LISTS)) {
  r.get(`/${table}`, ah(async (req, res) => { const { rows } = await query(`SELECT * FROM ${table} ORDER BY sort, id`); res.json({ items: rows }); }));
  r.post(`/${table}`, A.requireAdmin, ah(async (req, res) => {
    const cols = Object.keys(spec.cols), vals = cols.map(c => str(req.body[c], spec.cols[c]));
    if (!vals[cols.indexOf(spec.required)]) throw new HttpError(400, `${spec.required} is required.`);
    const { rows } = await query(`INSERT INTO ${table}(${cols.join(',')}, active, sort) VALUES (${cols.map((c, i) => '$' + (i + 1)).join(',')}, $${cols.length + 1}, $${cols.length + 2}) RETURNING *`,
      [...vals, req.body.active === undefined ? true : bool(req.body.active), int(req.body.sort) || 0]);
    A.audit(req.user, 'create', table, rows[0].id); res.status(201).json({ item: rows[0] });
  }));
  r.patch(`/${table}/:id`, A.requireAdmin, ah(async (req, res) => {
    const { rows: [cur] } = await query(`SELECT * FROM ${table} WHERE id=$1`, [int(req.params.id)]); if (!cur) throw new HttpError(404, 'Not found');
    const cols = Object.keys(spec.cols), vals = cols.map(c => (req.body[c] === undefined ? cur[c] : str(req.body[c], spec.cols[c])));
    if (!vals[cols.indexOf(spec.required)]) throw new HttpError(400, `${spec.required} is required.`);
    const { rows } = await query(`UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')}, active=$${cols.length + 1}, sort=$${cols.length + 2} WHERE id=$${cols.length + 3} RETURNING *`,
      [...vals, req.body.active === undefined ? cur.active : bool(req.body.active), req.body.sort === undefined ? cur.sort : int(req.body.sort) || 0, cur.id]);
    A.audit(req.user, 'update', table, cur.id); res.json({ item: rows[0] });
  }));
  r.delete(`/${table}/:id`, A.requireAdmin, ah(async (req, res) => { await query(`DELETE FROM ${table} WHERE id=$1`, [int(req.params.id)]); A.audit(req.user, 'delete', table, req.params.id); res.json({ ok: true }); }));
}

/* ---------------------------------------------------------------- SETTINGS (admin) */
r.get('/settings', ah(async (req, res) => res.json(await settings.getAll())));
r.put('/settings/:key', A.requireAdmin, ah(async (req, res) => {
  const key = req.params.key, v = req.body;
  if (!['site', 'booking', 'templates'].includes(key)) throw new HttpError(404, 'Unknown settings group.');
  if (key === 'booking') {
    const n = (x, lo, hi, name) => { const y = Number(x); if (!(y >= lo && y <= hi)) throw new HttpError(400, `${name} must be between ${lo} and ${hi}.`); return y; };
    v.openHour = n(v.openHour, 0, 23, 'Opening hour'); v.closeHour = n(v.closeHour, 1, 24, 'Closing hour');
    if (v.closeHour <= v.openHour) throw new HttpError(400, 'Closing hour must be after opening hour.');
    v.slotStep = n(v.slotStep, 5, 120, 'Slot step'); v.buffer = n(v.buffer, 0, 120, 'Buffer'); v.minNoticeMin = n(v.minNoticeMin, 0, 2880, 'Minimum notice');
    v.cancelHours = n(v.cancelHours, 0, 168, 'Cancellation hours'); v.maxAdvanceDays = n(v.maxAdvanceDays, 1, 365, 'Max advance days');
    v.closedDays = (Array.isArray(v.closedDays) ? v.closedDays : []).map(Number).filter(d => d >= 0 && d <= 6);
    v.onlineBookingEnabled = bool(v.onlineBookingEnabled);
    v.consult = { label: str(v.consult?.label, 60) || 'Consultation', duration: n(v.consult?.duration, 5, 240, 'Consult duration'), price: n(v.consult?.price, 0, 1e6, 'Consult price'), description: str(v.consult?.description, 300) };
  }
  if (key === 'templates' && !Array.isArray(v)) throw new HttpError(400, 'Templates must be a list.');
  if (key === 'site' && (typeof v !== 'object' || Array.isArray(v))) throw new HttpError(400, 'Invalid settings.');
  await settings.set(key, v); A.audit(req.user, 'update', 'settings', key);
  res.json({ ok: true, value: await settings.get(key) });
}));

/* ---------------------------------------------------------------- USERS (admin) */
r.get('/users', A.requireAdmin, ah(async (req, res) => { const { rows } = await query('SELECT id, email, name, role, active, last_login_at, created_at FROM users ORDER BY id'); res.json({ users: rows }); }));
r.post('/users', A.requireAdmin, ah(async (req, res) => {
  const email = str(req.body.email, 160).toLowerCase(), name = str(req.body.name, 100), role = req.body.role === 'admin' ? 'admin' : 'staff';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Enter a valid email.');
  if (!name) throw new HttpError(400, 'Name is required.');
  const err = A.checkPassword(req.body.password); if (err) throw new HttpError(400, err);
  const { rows } = await query('INSERT INTO users(email, name, role, password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING id, email, name, role, active', [email, name, role, await A.hash(req.body.password)]);
  if (!rows[0]) throw new HttpError(409, 'A user with that email already exists.');
  A.audit(req.user, 'create', 'user', rows[0].id, { email, role }); res.status(201).json({ user: rows[0] });
}));
r.patch('/users/:id', A.requireAdmin, ah(async (req, res) => {
  const id = int(req.params.id); const { rows: [u] } = await query('SELECT * FROM users WHERE id=$1', [id]); if (!u) throw new HttpError(404, 'Not found');
  const role = req.body.role === undefined ? u.role : (req.body.role === 'admin' ? 'admin' : 'staff');
  const active = req.body.active === undefined ? u.active : bool(req.body.active);
  if (id === req.user.id && (role !== 'admin' || !active)) throw new HttpError(400, "You can't remove your own admin access.");
  let hash = u.password_hash;
  if (req.body.password) { const err = A.checkPassword(req.body.password); if (err) throw new HttpError(400, err); hash = await A.hash(req.body.password); }
  await query('UPDATE users SET name=$1, role=$2, active=$3, password_hash=$4 WHERE id=$5', [str(req.body.name ?? u.name, 100) || u.name, role, active, hash, id]);
  A.audit(req.user, 'update', 'user', id, { role, active, passwordReset: !!req.body.password }); res.json({ ok: true });
}));
r.delete('/users/:id', A.requireAdmin, ah(async (req, res) => {
  if (int(req.params.id) === req.user.id) throw new HttpError(400, "You can't delete your own account.");
  await query('DELETE FROM users WHERE id=$1', [int(req.params.id)]); A.audit(req.user, 'delete', 'user', req.params.id); res.json({ ok: true });
}));

r.get('/audit', A.requireAdmin, ah(async (req, res) => { const { rows } = await query('SELECT * FROM audit_log ORDER BY at DESC LIMIT 300'); res.json({ entries: rows }); }));

module.exports = r;

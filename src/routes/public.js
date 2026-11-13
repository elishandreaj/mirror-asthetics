const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const settings = require('../lib/settings');
const B = require('../lib/bookings');
const { slotsFor, monthAvailability } = require('../lib/availability');
const { validateClient } = require('../lib/validate');
const { upload, saveImage, mediaUrl } = require('../lib/media');
const mailer = require('../lib/mailer');
const T = require('../lib/time');
const { ah, HttpError, int } = require('../lib/util');

const r = express.Router();
const bookingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many bookings from this device. Please call the clinic.' } });
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes.' } });

const publicBookingCfg = c => ({ openHour: c.openHour, closeHour: c.closeHour, closedDays: c.closedDays, slotStep: c.slotStep, buffer: c.buffer,
  cancelHours: c.cancelHours, maxAdvanceDays: c.maxAdvanceDays, onlineBookingEnabled: c.onlineBookingEnabled, consult: c.consult });

// Everything the customer site needs in one request
r.get('/site', ah(async (req, res) => {
  const { site, booking } = await settings.getAll();
  const [cats, trs, prs, gal, pro, tes, faq] = await Promise.all([
    query('SELECT id, name FROM categories WHERE active ORDER BY sort, id'),
    query('SELECT id, category_id, name, description, duration_min, price, featured FROM treatments WHERE active ORDER BY sort, id'),
    query('SELECT id, name, role, credentials, specialties, photo_id, bookable FROM practitioners WHERE active ORDER BY sort, id'),
    query(`SELECT g.id, g.title, g.treatment_label, g.caption, g.sessions, g.before_id, g.after_id, g.treatment_id, t.name AS treatment_name, t.category_id
           FROM gallery g LEFT JOIN treatments t ON t.id = g.treatment_id WHERE g.published ORDER BY g.sort, g.id DESC`),
    query('SELECT id, chip, title, body FROM promos WHERE active ORDER BY sort, id'),
    query('SELECT id, quote, author FROM testimonials WHERE active ORDER BY sort, id'),
    query('SELECT id, topic, question, answer FROM faqs WHERE active ORDER BY sort, id'),
  ]);
  res.set('Cache-Control', 'no-cache');
  res.json({
    site: { ...site, heroImage: mediaUrl(site.heroImageId) }, booking: publicBookingCfg(booking),
    categories: cats.rows.map(c => ({ ...c, treatments: trs.rows.filter(t => t.category_id === c.id) })).filter(c => c.treatments.length),
    practitioners: prs.rows.map(p => ({ ...p, photo: mediaUrl(p.photo_id), photo_id: undefined })),
    gallery: gal.rows.map(g => ({ id: g.id, title: g.title, treatment: g.treatment_name || g.treatment_label, treatmentId: g.treatment_id, categoryId: g.category_id,
      caption: g.caption, sessions: g.sessions, before: mediaUrl(g.before_id), after: mediaUrl(g.after_id) })),
    promos: pro.rows, testimonials: tes.rows, faqs: faq.rows,
  });
}));

async function ignoreIdFrom(body) {
  if (!body.code || !body.phone) return null;
  const b = await B.getByCodePhone(body.code, body.phone);
  return b ? b.id : null;
}
async function durationFrom(body, cfg) {
  if (body.code && body.phone) { const b = await B.getByCodePhone(body.code, body.phone); if (b) return b.duration_min; }
  return (await B.resolveServices(body.type, body.treatmentIds, cfg)).duration;
}

// Which days of a month have free times
r.post('/availability/month', lookupLimiter, ah(async (req, res) => {
  const cfg = await settings.get('booking');
  const year = int(req.body.year), month = int(req.body.month);
  if (!(year >= 2024 && year <= 2100 && month >= 1 && month <= 12)) throw new HttpError(400, 'Invalid month.');
  const days = await monthAvailability(cfg, year, month, await durationFrom(req.body, cfg), req.body.prac || 'any');
  res.json({ days });
}));

// Free start times on one day
r.post('/availability/day', lookupLimiter, ah(async (req, res) => {
  const cfg = await settings.get('booking');
  if (!T.isDate(req.body.date)) throw new HttpError(400, 'Invalid date.');
  const slots = await slotsFor(cfg, req.body.date, await durationFrom(req.body, cfg), { prac: req.body.prac || 'any', ignoreId: await ignoreIdFrom(req.body) });
  res.json({ slots: slots.map(s => ({ t: s.t, ok: s.ok })) });
}));

// Create booking. Accepts JSON, or multipart/form-data with a "data" JSON field + optional "photo".
r.post('/bookings', bookingLimiter, upload.single('photo'), ah(async (req, res) => {
  const cfg = await settings.get('booking');
  if (!cfg.onlineBookingEnabled) throw new HttpError(403, 'Online booking is paused. Please call or message the clinic.');
  let body = req.body;
  if (typeof body.data === 'string') { try { body = JSON.parse(body.data); } catch { throw new HttpError(400, 'Invalid form data.'); } }
  if (body.website) throw new HttpError(400, 'Invalid request.'); // honeypot field – bots fill it in
  const { data: client, errors } = validateClient(body.client || {});
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
  const photoId = req.file ? await saveImage(req.file.buffer, { isPrivate: true, maxSize: 1400 }) : null;
  const b = await B.create({ type: body.type, treatmentIds: body.treatmentIds, practitionerId: body.prac, date: body.date, start: body.start, client, photoId,
    status: cfg.autoConfirm ? 'confirmed' : 'pending' });
  mailer.sendTemplate(cfg.autoConfirm ? 'confirmed' : 'received', b); mailer.notifyClinic(b); // fire-and-forget
  res.status(201).json({ booking: publicView(b) });
}));

const publicView = b => ({
  code: b.code, type: b.type, status: b.status, service: b.service, items: b.items.map(i => ({ name: i.name, duration: i.duration, price: i.price })),
  practitioner: b.practitioner_name || 'Any available', practitionerId: b.practitioner_id, date: b.date, start: b.start_min, end: b.end_min,
  duration: b.duration_min, price: b.price, client: { name: b.client_name, phone: b.client_phone, email: b.client_email },
});

async function findOwned(body) {
  const b = await B.getByCodePhone(body.code, body.phone);
  if (!b) throw new HttpError(404, "We couldn't find that booking. Check your code and phone number.");
  return b;
}
async function changeAllowed(b) {
  const cfg = await settings.get('booking');
  if (['cancelled', 'completed', 'noshow'].includes(b.status)) return { ok: false, reason: 'This booking can no longer be changed.' };
  if (T.minutesUntil(b.date, b.start_min) < cfg.cancelHours * 60) return { ok: false, reason: `This appointment is within ${cfg.cancelHours} hours. Please call the clinic to make changes.` };
  return { ok: true };
}

r.post('/bookings/lookup', lookupLimiter, ah(async (req, res) => {
  const b = await findOwned(req.body);
  res.json({ booking: publicView(b), canChange: await changeAllowed(b) });
}));

r.post('/bookings/cancel', lookupLimiter, ah(async (req, res) => {
  const b = await findOwned(req.body);
  const c = await changeAllowed(b); if (!c.ok) throw new HttpError(409, c.reason);
  await query(`UPDATE bookings SET status='cancelled', cancelled_at=now(), updated_at=now() WHERE id=$1`, [b.id]);
  b.status = 'cancelled'; mailer.sendTemplate('cancelled', b);
  res.json({ ok: true });
}));

r.post('/bookings/reschedule', lookupLimiter, ah(async (req, res) => {
  const b = await findOwned(req.body);
  const c = await changeAllowed(b); if (!c.ok) throw new HttpError(409, c.reason);
  const nb = await B.reschedule(b.id, { date: req.body.date, start: req.body.start, practitionerId: req.body.prac });
  mailer.sendTemplate('rescheduled', nb);
  res.json({ booking: publicView(nb) });
}));

module.exports = r;

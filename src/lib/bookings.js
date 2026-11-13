// Shared booking logic used by both the public site and the admin dashboard.
const { query, tx } = require('../db');
const settings = require('./settings');
const { slotsFor } = require('./availability');
const { newCode, normPhone, HttpError } = require('./util');
const T = require('./time');

const SELECT = `
  SELECT b.*, p.name AS practitioner_name,
    COALESCE((SELECT json_agg(json_build_object('id', i.treatment_id, 'name', i.name, 'duration', i.duration_min, 'price', i.price) ORDER BY i.id)
              FROM booking_items i WHERE i.booking_id = b.id), '[]') AS items
  FROM bookings b LEFT JOIN practitioners p ON p.id = b.practitioner_id`;

function decorate(b, cfg) {
  if (!b) return b;
  b.service = b.type === 'consult' ? (cfg?.consult?.label || 'Consultation') : b.items.map(i => i.name).join(', ');
  b.end_min = b.start_min + b.duration_min;
  return b;
}
async function getById(id, db = { query }) {
  const cfg = await settings.get('booking');
  const { rows } = await db.query(`${SELECT} WHERE b.id = $1`, [id]);
  return decorate(rows[0], cfg);
}
async function getByCodePhone(code, phone) {
  const cfg = await settings.get('booking');
  const { rows } = await query(`${SELECT} WHERE b.code = $1 AND b.client_phone_norm = $2`, [String(code || '').trim().toUpperCase(), normPhone(phone)]);
  return decorate(rows[0], cfg);
}

// Work out duration & price from the DB (never trust prices sent by the browser)
async function resolveServices(type, treatmentIds, cfg) {
  if (type === 'consult') return { items: [], duration: cfg.consult.duration, price: cfg.consult.price };
  if (type !== 'treatment') throw new HttpError(400, 'Choose a consultation or at least one treatment.');
  const ids = [...new Set((treatmentIds || []).map(Number).filter(Number.isInteger))];
  if (!ids.length || ids.length > 8) throw new HttpError(400, 'Select between 1 and 8 treatments.');
  const { rows } = await query('SELECT id, name, duration_min, price FROM treatments WHERE id = ANY($1) AND active', [ids]);
  if (rows.length !== ids.length) throw new HttpError(400, 'One of the selected treatments is no longer available. Please refresh.');
  return { items: rows, duration: rows.reduce((s, r) => s + r.duration_min, 0), price: rows.reduce((s, r) => s + Number(r.price), 0) };
}

/**
 * Creates a booking safely: takes a per-date lock so two people can never grab the same slot.
 * opts.staff: booking made by staff (may book closed days; skip min notice). opts.force: staff override of conflicts.
 */
async function create({ type, treatmentIds, practitionerId, date, start, client, photoId = null, source = 'online', status = 'pending', staffNotes = '' }, opts = {}) {
  const cfg = await settings.get('booking');
  if (!T.isDate(date)) throw new HttpError(400, 'Please choose a valid date.');
  const svc = await resolveServices(type, treatmentIds, cfg);
  const startMin = Number(start);
  return tx(async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['booking:' + date]);
    let prac = practitionerId && practitionerId !== 'any' ? Number(practitionerId) : 'any';
    if (!opts.force) {
      const slot = (await slotsFor(cfg, date, svc.duration, { prac, staff: !!opts.staff }, db)).find(s => s.t === startMin);
      if (!slot || !slot.ok) throw new HttpError(409, 'Sorry, that time was just taken. Please choose another time.');
      prac = slot.prac;
    } else if (prac === 'any') prac = null;
    let code; for (;;) { code = newCode(); const { rowCount } = await db.query('SELECT 1 FROM bookings WHERE code=$1', [code]); if (!rowCount) break; }
    const { rows } = await db.query(
      `INSERT INTO bookings(code, type, practitioner_id, date, start_min, duration_min, total_min, price, status, source,
         client_name, client_phone, client_phone_norm, client_email, client_age, concerns, allergies, pregnant, medications, notes,
         photo_id, staff_notes, consent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`,
      [code, type, prac, date, startMin, svc.duration, svc.duration + cfg.buffer, svc.price, status, source,
        client.name, client.phone, normPhone(client.phone), client.email || '', client.age, client.concerns || '', client.allergies || '',
        client.pregnant || '', client.medications || '', client.notes || '', photoId, staffNotes, opts.staff ? null : new Date()]);
    const id = rows[0].id;
    for (const it of svc.items) {
      await db.query('INSERT INTO booking_items(booking_id, treatment_id, name, duration_min, price) VALUES ($1,$2,$3,$4,$5)', [id, it.id, it.name, it.duration_min, it.price]);
    }
    return getById(id, db);
  });
}

// Move an existing booking to a new date/time/practitioner (keeps services)
async function reschedule(id, { date, start, practitionerId }, opts = {}) {
  const cfg = await settings.get('booking');
  if (!T.isDate(date)) throw new HttpError(400, 'Please choose a valid date.');
  return tx(async db => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['booking:' + date]);
    const b = await getById(id, db);
    if (!b) throw new HttpError(404, 'Booking not found.');
    let prac = practitionerId && practitionerId !== 'any' ? Number(practitionerId) : 'any';
    if (!opts.force) {
      const slot = (await slotsFor(cfg, date, b.duration_min, { prac, ignoreId: b.id, staff: !!opts.staff }, db)).find(s => s.t === Number(start));
      if (!slot || !slot.ok) throw new HttpError(409, 'That time is not available. Please choose another.');
      prac = slot.prac;
    } else if (prac === 'any') prac = b.practitioner_id;
    const status = opts.staff ? b.status : 'pending';
    await db.query(`UPDATE bookings SET date=$1, start_min=$2, practitioner_id=$3, status=$4, total_min=duration_min+$5, reminder_sent_at=NULL, updated_at=now() WHERE id=$6`,
      [date, Number(start), prac, status, cfg.buffer, b.id]);
    return getById(b.id, db);
  });
}

module.exports = { SELECT, decorate, getById, getByCodePhone, create, reschedule, resolveServices };

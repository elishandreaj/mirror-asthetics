// Availability engine: an appointment occupies [start, start + duration + buffer) for its practitioner.
const { query } = require('../db');
const T = require('./time');

const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const INACTIVE = ['cancelled', 'noshow'];

async function loadDay(db, date) {
  const [bk, bl, pr] = await Promise.all([
    db.query(`SELECT id, practitioner_id, start_min, total_min FROM bookings WHERE date = $1 AND status <> ALL($2)`, [date, INACTIVE]),
    db.query(`SELECT from_min, to_min, practitioner_id FROM blocks WHERE date = $1`, [date]),
    db.query(`SELECT id FROM practitioners WHERE active AND bookable ORDER BY sort, id`),
  ]);
  return { bookings: bk.rows, blocks: bl.rows, pracs: pr.rows.map(r => r.id) };
}

// Is the date bookable at all for customers (open weekday, not past, within advance window, not fully blocked)?
function dayOpen(cfg, date, blocks, { staff = false } = {}) {
  if (!T.isDate(date)) return false;
  const t = T.today();
  if (date < t) return false;
  if (!staff) {
    if (cfg.closedDays.includes(T.dow(date))) return false;
    if (date > T.addDays(t, cfg.maxAdvanceDays)) return false;
  }
  return !blocks.some(b => b.practitioner_id == null && b.from_min <= 0 && b.to_min >= 1440);
}

/**
 * Returns [{t, ok, prac}] for each candidate start time.
 * opts.prac: practitioner id or 'any'. opts.ignoreId: booking id being rescheduled.
 * opts.staff: staff may book on closed days / beyond advance window (still respects overlaps).
 */
function computeSlots(cfg, date, duration, day, opts = {}) {
  const { prac = 'any', ignoreId = null, staff = false } = opts;
  const out = [];
  const open = dayOpen(cfg, date, day.blocks, { staff });
  const isToday = date === T.today();
  const earliest = T.nowMin() + (staff ? 0 : cfg.minNoticeMin);
  const total = duration + cfg.buffer;
  const cands = prac && prac !== 'any' ? [Number(prac)] : day.pracs;
  for (let t = cfg.openHour * 60; t + duration <= cfg.closeHour * 60; t += cfg.slotStep) {
    let ok = open, assigned = null;
    if (ok && isToday && t < earliest) ok = false;
    if (ok && day.blocks.some(b => b.practitioner_id == null && overlap(t, t + duration, b.from_min, b.to_min))) ok = false;
    if (ok) {
      assigned = cands.find(p =>
        day.pracs.includes(p) &&
        !day.blocks.some(b => b.practitioner_id === p && overlap(t, t + duration, b.from_min, b.to_min)) &&
        !day.bookings.some(b => b.id !== ignoreId && b.practitioner_id === p && overlap(t, t + total, b.start_min, b.start_min + b.total_min))
      ) || null;
      if (!assigned) ok = false;
    }
    out.push({ t, ok, prac: assigned });
  }
  return out;
}

async function slotsFor(cfg, date, duration, opts = {}, db = { query }) {
  const day = await loadDay(db, date);
  return computeSlots(cfg, date, duration, day, opts);
}

// Which days in a month have at least one free slot (single DB round-trip)
async function monthAvailability(cfg, year, month, duration, prac) {
  const first = `${year}-${T.pad(month)}-01`;
  const last = T.ymd(new Date(year, month, 0));
  const [bk, bl, pr] = await Promise.all([
    query(`SELECT id, date, practitioner_id, start_min, total_min FROM bookings WHERE date BETWEEN $1 AND $2 AND status <> ALL($3)`, [first, last, INACTIVE]),
    query(`SELECT date, from_min, to_min, practitioner_id FROM blocks WHERE date BETWEEN $1 AND $2`, [first, last]),
    query(`SELECT id FROM practitioners WHERE active AND bookable ORDER BY sort, id`),
  ]);
  const pracs = pr.rows.map(r => r.id);
  const out = {};
  for (let d = 1; d <= Number(last.slice(8)); d++) {
    const date = `${year}-${T.pad(month)}-${T.pad(d)}`;
    const day = { pracs, bookings: bk.rows.filter(b => b.date === date), blocks: bl.rows.filter(b => b.date === date) };
    out[date] = computeSlots(cfg, date, duration, day, { prac }).some(s => s.ok);
  }
  return out;
}

module.exports = { slotsFor, monthAvailability, computeSlots, loadDay, overlap };

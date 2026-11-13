/* Mirror Aesthetics – staff/admin dashboard */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const fmtTime = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + pad(mm) + ' ' + (h < 12 ? 'AM' : 'PM'); };
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const toHHMM = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'noshow'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function toast(m, bad) { const d = document.createElement('div'); d.className = 'toast'; if (bad) d.style.background = 'var(--danger)'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-Requested-With': 'fetch' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch('/api/admin' + path, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined), credentials: 'same-origin' }); }
  catch { throw new Error('Cannot reach the server. Check your internet connection.'); }
  if (res.status === 401 && path !== '/login') { const wasIn = !!ME; ME = null; renderLogin(wasIn ? 'Your session expired. Please sign in again.' : ''); throw new Error('Please sign in.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.fields = data.fields; throw e; }
  return data;
}
const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { if (e.message !== 'Please sign in.') toast(e.message, true); throw e; } };
const quiet = p => p.catch(() => {});

function drawer(html) {
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div style="display:flex;justify-content:flex-end"><button class="btn ghost sm" data-close>✕ Close</button></div><div class="body">${html}</div></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  return { el: $('.body', d), close };
}
const fv = (root, id) => { const e = $('#' + id, root); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : undefined; };

/* ---------------------------------------------------------------- state */
let ME = null, EMAIL_ON = false, VIEW = 'dashboard';
let CATALOG = null, PRACS = null, SETTINGS = null;
const BK = { from: today(), to: '', status: '', prac: '', treatment: '', q: '', sort: 'date' };
let CAL = new Date(); CAL.setDate(1);
const loadCatalog = async (force) => { if (!CATALOG || force) CATALOG = await api('/catalog'); return CATALOG; };
const loadPracs = async (force) => { if (!PRACS || force) PRACS = (await api('/practitioners')).practitioners; return PRACS; };
const loadSettings = async (force) => { if (!SETTINGS || force) SETTINGS = await api('/settings'); return SETTINGS; };

/* ---------------------------------------------------------------- login */
function renderLogin(msg) {
  $('#logout').classList.add('hide'); $('#who').textContent = '';
  $('#app').innerHTML = `<div class="card login"><h2>Staff login</h2>
    <form id="lf"><label class="f" for="le">Email</label><input type="email" id="le" autocomplete="username" required>
    <label class="f" for="lp">Password</label><input type="password" id="lp" autocomplete="current-password" required>
    <div class="err" id="lerr">${esc(msg || '')}</div><div class="nav-row"><span></span><button class="btn" id="lb">Sign in</button></div></form>
    <p class="mini">Forgot your password? Ask the clinic admin to reset it.</p></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lb').disabled = true;
    try { await api('/login', { method: 'POST', body: { email: $('#le').value, password: $('#lp').value } }); boot(); }
    catch (er) { $('#lerr').textContent = er.message; $('#lb').disabled = false; }
  };
}
$('#logout').onclick = async () => { await quiet(api('/logout', { method: 'POST' })); ME = null; CATALOG = PRACS = SETTINGS = null; renderLogin(); };

/* ---------------------------------------------------------------- layout */
const NAV = [
  ['sep', 'Daily work'], ['dashboard', 'Today'], ['bookings', 'Bookings'], ['calendar', 'Calendar'], ['new', '+ New booking'], ['blocks', 'Block times'],
  ['sep', 'Website content'], ['gallery', 'Results photos'], ['treatments', 'Treatments & prices', 1], ['team', 'Team', 1], ['content', 'Promos · Reviews · FAQ', 1], ['site', 'Clinic info & settings', 1],
  ['sep', 'Account'], ['users', 'Staff accounts', 1], ['audit', 'Activity log', 1], ['account', 'My password'],
];
function layout() {
  const isAdmin = ME.role === 'admin';
  $('#app').innerHTML = `<div class="alay"><nav class="side" aria-label="Dashboard">${NAV.filter(n => !n[2] || isAdmin).map(([k, l]) => k === 'sep' ? `<div class="sep">${l}</div>` : `<button data-v="${k}" class="${VIEW === k ? 'on' : ''}">${l}</button>`).join('')}</nav><section id="view"></section></div>`;
  $$('.side [data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
}
function go(v) { VIEW = v; history.replaceState(null, '', '#' + v); layout(); (VIEWS[v] || VIEWS.dashboard)($('#view')); window.scrollTo(0, 0); }

async function boot() {
  try { const r = await api('/me'); ME = r.user; EMAIL_ON = r.emailEnabled; }
  catch { return; }
  $('#who').textContent = `${ME.name} · ${ME.role}`; $('#logout').classList.remove('hide');
  const h = location.hash.slice(1); go(VIEWS[h] ? h : 'dashboard');
}

/* ---------------------------------------------------------------- shared booking UI */
const stBadge = s => `<span class="st ${s}">${s === 'noshow' ? 'no-show' : s}</span>`;
function bookingRows(list, emptyMsg) {
  return `<div class="tw card" style="padding:6px"><table><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(b => `<tr><td>${fmtDate(b.date)}</td><td>${fmtTime(b.start)}</td><td>${esc(b.client || b.client_name)}<br><small class="mini">${esc(b.code)} · ${esc(b.phone || b.client_phone || '')}</small></td>
   <td>${esc(b.service)}</td><td>${esc(b.practitioner || b.practitioner_name || '—')}</td><td>${stBadge(b.status)}</td><td><button class="btn ghost sm" data-open="${b.id}">Open</button></td></tr>`).join('')
   || `<tr><td colspan="7">${emptyMsg || 'No bookings.'}</td></tr>`}</tbody></table></div>`;
}
function wireOpen(root, after) { $$('[data-open]', root).forEach(b => b.onclick = () => openBooking(Number(b.dataset.open), after)); }

async function openBooking(id, after) {
  const { booking: b } = await run(() => api('/bookings/' + id));
  await loadSettings(); await loadPracs();
  const d = drawer('');
  const refresh = async () => { d.close(); after && after(); await openBooking(id, after); };
  const tpls = SETTINGS.templates;
  d.el.innerHTML = `<h2>${esc(b.client_name)}</h2><p class="mini">${esc(b.code)} · booked ${new Date(b.created_at).toLocaleString('en-PH')} · source: ${esc(b.source)}</p>
   <div class="card kv" style="margin-top:10px">
    <p><b>Status</b> ${stBadge(b.status)}</p><p><b>Service</b> ${esc(b.service)}</p><p><b>Date & time</b> ${fmtDate(b.date)}, ${fmtTime(b.start_min)} – ${fmtTime(b.start_min + b.duration_min)}</p>
    <p><b>Specialist</b> ${esc(b.practitioner_name || '—')}</p><p><b>Estimated total</b> ${b.price ? peso(b.price) : 'Free'}</p>
   </div>
   <h3 style="margin-top:16px">Change status</h3>
   <div class="toolbar">${STATUSES.filter(s => s !== b.status).map(s => `<button class="btn sm ${['cancelled', 'noshow'].includes(s) ? 'ghost' : ''}" data-st="${s}">Mark ${s === 'noshow' ? 'no-show' : s}</button>`).join('')}</div>
   <label class="chk"><input type="checkbox" id="notify" ${EMAIL_ON && b.client_email ? 'checked' : ''} ${EMAIL_ON && b.client_email ? '' : 'disabled'}><span>Email the client about this change ${EMAIL_ON ? (b.client_email ? '' : '(no email on file)') : '(email not set up)'}</span></label>
   <h3 style="margin-top:16px">Client details</h3>
   <div class="card kv"><p><b>Phone</b> <a href="tel:${esc(b.client_phone)}">${esc(b.client_phone)}</a></p><p><b>Email</b> ${b.client_email ? `<a href="mailto:${esc(b.client_email)}">${esc(b.client_email)}</a>` : '—'}</p>
    <p><b>Age</b> ${esc(b.client_age ?? '—')}</p><p><b>Concerns</b> ${esc(b.concerns || '—')}</p><p><b>Allergies / conditions</b> ${esc(b.allergies || '—')}</p>
    <p><b>Pregnant / breastfeeding</b> ${esc(b.pregnant || '—')}</p><p><b>Medications</b> ${esc(b.medications || '—')}</p><p><b>Client notes</b> ${esc(b.notes || '—')}</p>
    <p><b>Consent given</b> ${b.consent_at ? new Date(b.consent_at).toLocaleString('en-PH') : 'n/a (staff booking)'}</p>
    ${b.photo ? `<p><b>Photo of concern</b><br><a href="${b.photo}" target="_blank" rel="noopener"><img src="${b.photo}" alt="Client photo" style="max-width:220px;border-radius:12px;margin-top:6px"></a></p>` : ''}
    <button class="btn ghost sm" id="editClient">Edit client details</button></div>
   <h3 style="margin-top:16px">Staff notes <small class="mini">(only staff can see)</small></h3>
   <textarea id="snotes">${esc(b.staff_notes)}</textarea><div class="nav-row" style="margin-top:8px"><span></span><button class="btn sm" id="saveNotes">Save notes</button></div>
   <h3 style="margin-top:16px">Reschedule</h3><div class="card" id="rsBox"></div>
   <h3 style="margin-top:16px">Messages</h3>
   <div class="toolbar"><select id="tplSel" style="min-width:220px">${tpls.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join('')}</select>
    <button class="btn ghost sm" id="copyMsg">Copy message</button>${EMAIL_ON && b.client_email ? '<button class="btn ghost sm" id="mailMsg">Send by email</button>' : ''}</div>
   <pre class="tpl" id="msgPrev">Pick a template to preview.</pre>
   ${ME.role === 'admin' ? `<h3 style="margin-top:16px" class="danger-text">Danger zone</h3><p class="mini">Permanently deletes this booking and the client's health information (use for data-deletion requests). To simply cancel, use "Mark cancelled".</p><button class="btn danger sm" id="delB">Delete permanently</button>` : ''}`;

  $$('[data-st]', d.el).forEach(x => x.onclick = async () => {
    await run(() => api('/bookings/' + id, { method: 'PATCH', body: { status: x.dataset.st, notify: $('#notify', d.el).checked } }), 'Status updated');
    refresh();
  });
  $('#saveNotes', d.el).onclick = () => run(() => api('/bookings/' + id, { method: 'PATCH', body: { staff_notes: $('#snotes', d.el).value } }), 'Notes saved');
  const prev = async () => { const r = await run(() => api(`/bookings/${id}/message/${$('#tplSel', d.el).value}`)); $('#msgPrev', d.el).textContent = r.body; return r; };
  $('#tplSel', d.el).onchange = prev; quiet(prev());
  $('#copyMsg', d.el).onclick = async () => { const r = await prev(); try { await navigator.clipboard.writeText(r.body); toast('Copied – paste it into SMS, Viber or Messenger'); } catch { toast('Select the text below and copy it manually.'); } };
  if ($('#mailMsg', d.el)) $('#mailMsg', d.el).onclick = () => run(() => api(`/bookings/${id}/email/${$('#tplSel', d.el).value}`, { method: 'POST' }), 'Email sent');
  if ($('#delB', d.el)) $('#delB', d.el).onclick = async () => { if (!confirm(`Delete booking ${b.code} permanently? This cannot be undone.`)) return; await run(() => api('/bookings/' + id, { method: 'DELETE' }), 'Booking deleted'); d.close(); after && after(); };
  $('#editClient', d.el).onclick = () => editClient(b, refresh);
  slotPicker($('#rsBox', d.el), { bookingId: id, date: b.date, prac: b.practitioner_id, current: b.start_min, label: 'Move booking', onPick: async (date, start, prac, force) => {
    await run(() => api(`/bookings/${id}/reschedule`, { method: 'POST', body: { date, start, prac, force, notify: $('#notify', d.el).checked } }), 'Booking moved'); refresh();
  } });
}

function editClient(b, done) {
  const d = drawer(`<h2>Edit client details</h2><form id="ec">
   ${clientFields({ name: b.client_name, phone: b.client_phone, email: b.client_email, age: b.client_age, concerns: b.concerns, allergies: b.allergies, pregnant: b.pregnant, medications: b.medications, notes: b.notes })}
   <div class="nav-row"><span></span><button class="btn">Save</button></div></form>`);
  $('#ec', d.el).onsubmit = async e => {
    e.preventDefault();
    try { await api('/bookings/' + b.id, { method: 'PATCH', body: { client: readClient(d.el) } }); toast('Saved'); d.close(); done(); }
    catch (er) { showFieldErrors(d.el, er); }
  };
}
function clientFields(c = {}) {
  const v = k => esc(c[k] ?? '');
  return `<div class="row2"><div><label class="f" for="c_name">Full name *</label><input type="text" id="c_name" value="${v('name')}"><div class="err" data-e="name"></div></div>
   <div><label class="f" for="c_phone">Mobile number *</label><input type="tel" id="c_phone" value="${v('phone')}"><div class="err" data-e="phone"></div></div></div>
   <div class="row2"><div><label class="f" for="c_email">Email</label><input type="email" id="c_email" value="${v('email')}"><div class="err" data-e="email"></div></div>
   <div><label class="f" for="c_age">Age</label><input type="number" id="c_age" value="${v('age')}"></div></div>
   <label class="f" for="c_concerns">Concerns</label><textarea id="c_concerns">${v('concerns')}</textarea>
   <label class="f" for="c_allergies">Allergies / conditions</label><textarea id="c_allergies">${v('allergies')}</textarea>
   <div class="row2"><div><label class="f" for="c_preg">Pregnant / breastfeeding</label><select id="c_preg"><option value=""></option>${['No', 'Yes'].map(x => `<option ${c.pregnant === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
   <div><label class="f" for="c_meds">Medications</label><input type="text" id="c_meds" value="${v('medications')}"></div></div>
   <label class="f" for="c_notes">Client notes</label><textarea id="c_notes">${v('notes')}</textarea>`;
}
const readClient = r => ({ name: fv(r, 'c_name'), phone: fv(r, 'c_phone'), email: fv(r, 'c_email'), age: fv(r, 'c_age'), concerns: fv(r, 'c_concerns'), allergies: fv(r, 'c_allergies'), pregnant: fv(r, 'c_preg'), medications: fv(r, 'c_meds'), notes: fv(r, 'c_notes') });
function showFieldErrors(root, er) { $$('[data-e]', root).forEach(x => { x.textContent = (er.fields || {})[x.dataset.e] || ''; }); toast(er.message, true); }

// Date + practitioner + slot grid. Used by reschedule and new booking.
function slotPicker(box, { bookingId, getServices, date, prac, current, label, onPick }) {
  box.innerHTML = `<div class="row3"><div><label class="f">Date</label><input type="date" id="sp_d" value="${date || today()}"></div>
   <div><label class="f">Specialist</label><select id="sp_p"><option value="any">Any available</option>${PRACS.filter(p => p.active).map(p => `<option value="${p.id}" ${String(prac) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
   <div><label class="f">&nbsp;</label><button type="button" class="btn ghost" id="sp_go" style="width:100%">Show free times</button></div></div>
   <div id="sp_s" style="margin-top:10px"></div>
   <label class="chk"><input type="checkbox" id="sp_force"><span>Override: allow double-booking / outside hours (use carefully)</span></label>
   <div class="row2" id="sp_manual" style="display:none"><div><label class="f">Start time</label><input type="time" id="sp_t" value="${current != null ? toHHMM(current) : '10:00'}"></div>
   <div><label class="f">&nbsp;</label><button type="button" class="btn gold" id="sp_mgo" style="width:100%">${label}</button></div></div>`;
  let sel = null;
  const load = async () => {
    const body = { date: $('#sp_d', box).value, prac: $('#sp_p', box).value };
    if (bookingId) body.bookingId = bookingId; else Object.assign(body, getServices());
    if (!bookingId && body.type === 'treatment' && !(body.treatmentIds || []).length) { $('#sp_s', box).innerHTML = '<p class="err">Choose a service first.</p>'; return; }
    $('#sp_s', box).innerHTML = '<div class="spin"></div>';
    try {
      const { slots, duration } = await api('/availability/day', { method: 'POST', body });
      $('#sp_s', box).innerHTML = `<p class="mini">Length: ${duration} min. Greyed times are taken, blocked or outside hours.</p>
       <div class="slots admin">${slots.map(s => `<button type="button" class="slot" data-t="${s.t}" data-p="${s.prac || ''}" ${s.ok ? '' : 'disabled'}>${fmtTime(s.t)}</button>`).join('') || '<p>Closed.</p>'}</div>
       <div class="nav-row"><span></span><button type="button" class="btn gold" id="sp_ok" disabled>${label}</button></div>`;
      $$('.slot', box).forEach(x => x.onclick = () => { sel = { t: Number(x.dataset.t), p: x.dataset.p }; $$('.slot', box).forEach(y => y.classList.toggle('sel', y === x)); $('#sp_ok', box).disabled = false; });
      $('#sp_ok', box).onclick = () => sel && onPick($('#sp_d', box).value, sel.t, sel.p || $('#sp_p', box).value, false);
    } catch (e) { $('#sp_s', box).innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $('#sp_go', box).onclick = load;
  $('#sp_force', box).onchange = e => { $('#sp_manual', box).style.display = e.target.checked ? 'grid' : 'none'; };
  $('#sp_mgo', box).onclick = () => { const v = $('#sp_t', box).value; if (!v) return toast('Enter a start time', true); onPick($('#sp_d', box).value, toMin(v), $('#sp_p', box).value, true); };
  if (bookingId) quiet(load());
}

/* ---------------------------------------------------------------- views */
const VIEWS = {};

VIEWS.dashboard = async el => {
  el.innerHTML = '<div class="spin"></div>';
  const d = await run(() => api('/dashboard'));
  el.innerHTML = `<h2 class="sec">Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${esc(ME.name.split(' ')[0])}</h2>
   <div class="stats"><div class="stat"><b>${d.counts.today}</b>Appointments today</div><div class="stat"><b>${d.counts.pending}</b>Waiting for confirmation</div>
   <div class="stat"><b>${d.counts.week}</b>Next 7 days</div><div class="stat"><b>${d.counts.new24}</b>New in last 24h</div></div>
   ${d.counts.pending ? `<p class="note" style="margin-top:14px">You have ${d.counts.pending} pending booking(s). <a href="#" id="seePending">Review them</a> and mark them confirmed.</p>` : ''}
   ${EMAIL_ON ? '' : '<p class="note" style="margin-top:14px">Email is not set up yet, so clients do not receive automatic confirmations. Use "Copy message" on a booking to send by SMS/Viber, or ask your developer to add SMTP settings.</p>'}
   <h3 style="margin:20px 0 10px">Today · ${fmtDate(today())}</h3>${bookingRows(d.today.map(b => ({ ...b, start: b.start_min })), 'No appointments today.')}`;
  wireOpen(el, () => VIEWS.dashboard(el));
  if ($('#seePending', el)) $('#seePending', el).onclick = e => { e.preventDefault(); Object.assign(BK, { status: 'pending', from: today(), to: '' }); go('bookings'); };
};

VIEWS.bookings = async el => {
  const [cat] = await Promise.all([loadCatalog(), loadPracs()]);
  el.innerHTML = `<h2 class="sec">Bookings</h2>
   <div class="toolbar"><input type="search" id="fq" placeholder="Search name, code, phone…" value="${esc(BK.q)}">
    <label class="mini">From <input type="date" id="ff" value="${BK.from}"></label><label class="mini">To <input type="date" id="ft" value="${BK.to}"></label>
    <select id="fs"><option value="">All statuses</option>${STATUSES.map(s => `<option ${BK.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select id="fp"><option value="">All staff</option>${PRACS.map(p => `<option value="${p.id}" ${String(BK.prac) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <select id="fr"><option value="">All services</option><option value="consult" ${BK.treatment === 'consult' ? 'selected' : ''}>Consultation</option>${cat.treatments.map(x => `<option value="${x.id}" ${String(BK.treatment) === String(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select id="fo"><option value="date">Sort by appointment</option><option value="newest" ${BK.sort === 'newest' ? 'selected' : ''}>Newest first</option></select>
    <button class="btn ghost sm" id="fclear">Clear</button><a class="btn ghost sm" id="csv" href="#">Export CSV</a></div><div id="list"><div class="spin"></div></div>`;
  const load = async () => {
    const q = new URLSearchParams(Object.entries(BK).filter(([, v]) => v)).toString();
    const { bookings } = await run(() => api('/bookings?' + q));
    $('#list', el).innerHTML = `<p class="mini" style="margin-bottom:6px">${bookings.length} booking(s)${bookings.length === 500 ? ' – showing first 500, narrow your filters' : ''}</p>` + bookingRows(bookings, 'No bookings match these filters.');
    wireOpen(el, load);
  };
  const bind = (id, k) => { $('#' + id, el).onchange = e => { BK[k] = e.target.value; load(); }; };
  bind('ff', 'from'); bind('ft', 'to'); bind('fs', 'status'); bind('fp', 'prac'); bind('fr', 'treatment'); bind('fo', 'sort');
  let tm; $('#fq', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { BK.q = e.target.value; load(); }, 300); };
  $('#fclear', el).onclick = () => { Object.assign(BK, { from: today(), to: '', status: '', prac: '', treatment: '', q: '', sort: 'date' }); VIEWS.bookings(el); };
  $('#csv', el).onclick = e => { e.preventDefault(); location.href = `/api/admin/export.csv?from=${BK.from || addDays(today(), -365)}&to=${BK.to || addDays(today(), 365)}`; };
  load();
};

VIEWS.calendar = async el => {
  const y = CAL.getFullYear(), m = CAL.getMonth();
  el.innerHTML = `<h2 class="sec">Calendar</h2><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><button class="btn ghost sm" id="cp">‹</button><b>${CAL.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</b><button class="btn ghost sm" id="cn">›</button></div><div id="cg"><div class="spin"></div></div><div id="cday"></div>`;
  $('#cp', el).onclick = () => { CAL = new Date(y, m - 1, 1); VIEWS.calendar(el); };
  $('#cn', el).onclick = () => { CAL = new Date(y, m + 1, 1); VIEWS.calendar(el); };
  const { days } = await run(() => api(`/calendar?year=${y}&month=${m + 1}`));
  const first = new Date(y, m, 1).getDay(), dn = new Date(y, m + 1, 0).getDate();
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= dn; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`, x = days[ds] || {};
    cells += `<button class="mcell ${ds === today() ? 'today' : ''}" data-d="${ds}">${d}${x.total ? `<b>${x.total} appt</b>` : ''}${x.pending ? `<span class="mini">${x.pending} pending</span>` : ''}${x.blocks ? '<small> 🚫 blocked</small>' : ''}</button>`;
  }
  $('#cg', el).innerHTML = `<div class="cal daygrid">${cells}</div>`;
  const showDay = async ds => {
    const { bookings } = await run(() => api(`/bookings?from=${ds}&to=${ds}`));
    $('#cday', el).innerHTML = `<h3 style="margin:18px 0 8px">${fmtDate(ds)}</h3>` + bookingRows(bookings, 'No bookings on this day.');
    wireOpen($('#cday', el), () => showDay(ds)); $('#cday', el).scrollIntoView({ behavior: 'smooth' });
  };
  $$('.mcell', el).forEach(c => c.onclick = () => showDay(c.dataset.d));
};

VIEWS.new = async el => {
  const [cat] = await Promise.all([loadCatalog(), loadPracs(), loadSettings()]);
  const consult = SETTINGS.booking.consult;
  el.innerHTML = `<h2 class="sec">New booking</h2><p class="lead">For phone, walk-in and Messenger bookings.</p>
   <div class="card"><h3>1. Service</h3>
    <label class="opt"><input type="radio" name="nt" value="consult"><span><b>${esc(consult.label)}</b><small>${consult.duration} min</small></span></label>
    <label class="opt"><input type="radio" name="nt" value="treatment" checked><span><b>Treatment(s)</b></span></label>
    <div id="ntp">${cat.categories.map(c => `<details style="margin-top:6px"><summary>${esc(c.name)}</summary><div style="padding:0 10px 10px">${cat.treatments.filter(x => x.category_id === c.id && x.active).map(x => `<label class="opt"><input type="checkbox" value="${x.id}"><span><b>${esc(x.name)}</b><small>${x.duration_min} min · ${peso(x.price)}</small></span></label>`).join('')}</div></details>`).join('')}</div></div>
   <div class="card" style="margin-top:12px"><h3>2. Client</h3><form id="nf">${clientFields()}
    <div class="row2"><div><label class="f">Source</label><select id="n_src"><option value="phone">Phone</option><option value="walk-in">Walk-in</option><option value="messenger">Messenger / Viber</option><option value="admin">Other</option></select></div>
    <div><label class="f">Status</label><select id="n_st"><option value="confirmed">Confirmed</option><option value="pending">Pending</option></select></div></div>
    <label class="f">Staff notes</label><textarea id="n_notes"></textarea>
    <label class="chk"><input type="checkbox" id="n_notify" ${EMAIL_ON ? '' : 'disabled'}><span>Email confirmation to client ${EMAIL_ON ? '' : '(email not set up)'}</span></label></form></div>
   <div class="card" style="margin-top:12px"><h3>3. Date & time</h3><div id="nslot"></div></div>`;
  $$('input[name=nt]', el).forEach(r => r.onchange = () => { $('#ntp', el).classList.toggle('hide', r.value === 'consult' && r.checked); });
  const services = () => { const type = $('input[name=nt]:checked', el).value; return { type, treatmentIds: type === 'treatment' ? $$('#ntp input:checked', el).map(i => Number(i.value)) : [] }; };
  slotPicker($('#nslot', el), { getServices: services, label: 'Create booking', onPick: async (date, start, prac, force) => {
    try {
      const { booking } = await api('/bookings', { method: 'POST', body: { ...services(), date, start, prac, force, client: readClient(el), source: fv(el, 'n_src'), status: fv(el, 'n_st'), staffNotes: fv(el, 'n_notes'), notify: fv(el, 'n_notify') } });
      toast(`Booking ${booking.code} created`); go('bookings'); openBooking(booking.id);
    } catch (er) { showFieldErrors(el, er); }
  } });
};

VIEWS.blocks = async el => {
  await loadPracs();
  el.innerHTML = `<h2 class="sec">Block dates & times</h2><p class="lead">Holidays, trainings, lunch breaks or a staff day off. Blocked times can't be booked online.</p>
   <div class="card"><div class="row3"><div><label class="f">Date</label><input type="date" id="bd" min="${today()}"></div>
    <div><label class="f">Who</label><select id="bp"><option value="">Whole clinic</option>${PRACS.map(p => `<option value="${p.id}">${esc(p.name)} only</option>`).join('')}</select></div>
    <div><label class="f">Repeat for</label><select id="br"><option value="1">Just this day</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div></div>
    <label class="chk"><input type="checkbox" id="bw" checked><span>Whole day</span></label>
    <div id="bt" class="row2 hide"><div><label class="f">From</label><input type="time" id="bf" value="12:00"></div><div><label class="f">To</label><input type="time" id="bto" value="13:00"></div></div>
    <label class="f">Note</label><input type="text" id="bn" placeholder="e.g. Holiday, training"><div class="nav-row"><span></span><button class="btn" id="badd">Add block</button></div></div>
   <div class="card" style="margin-top:12px"><h3>Upcoming blocks</h3><div id="bl"><div class="spin"></div></div></div>`;
  $('#bw', el).onchange = e => $('#bt', el).classList.toggle('hide', e.target.checked);
  const load = async () => {
    const { blocks } = await run(() => api('/blocks'));
    $('#bl', el).innerHTML = blocks.map(b => `<p style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:8px 0"><span><b>${fmtDate(b.date)}</b> · ${b.from_min <= 0 && b.to_min >= 1440 ? 'Whole day' : fmtTime(b.from_min) + '–' + fmtTime(b.to_min)} · ${esc(b.practitioner_name || 'Whole clinic')} · ${esc(b.note)}</span><button class="btn ghost sm" data-rm="${b.id}">Remove</button></p>`).join('') || '<p>None.</p>';
    $$('[data-rm]', el).forEach(x => x.onclick = async () => { await run(() => api('/blocks/' + x.dataset.rm, { method: 'DELETE' }), 'Removed'); load(); });
  };
  $('#badd', el).onclick = async () => {
    const d = $('#bd', el).value; if (!d) return toast('Choose a date', true);
    let from = 0, to = 1440; if (!$('#bw', el).checked) { from = toMin($('#bf', el).value); to = toMin($('#bto', el).value); if (to <= from) return toast('End time must be after start time', true); }
    const n = Number($('#br', el).value);
    for (let i = 0; i < n; i++) await run(() => api('/blocks', { method: 'POST', body: { date: addDays(d, i), from, to, practitionerId: $('#bp', el).value || null, note: $('#bn', el).value } }));
    toast(n > 1 ? `${n} days blocked` : 'Block added'); load();
  };
  load();
};

VIEWS.gallery = async el => {
  el.innerHTML = `<h2 class="sec">Before & after photos</h2><p class="lead">These appear on the website's Results page. Only upload photos the client has agreed in writing to share.</p>
   <div class="card"><h3>Add a result</h3><form id="gf"><div class="row2"><div><label class="f">Title *</label><input type="text" id="g_title" placeholder="e.g. Acne clearing – 6 sessions" maxlength="120"></div>
    <div><label class="f">Treatment</label><input type="text" id="g_tr" placeholder="e.g. Anti-acne Facial" maxlength="120"></div></div>
    <label class="f">Caption (optional)</label><input type="text" id="g_cap" maxlength="500">
    <div class="row2"><div><label class="f">BEFORE photo *</label><input type="file" id="g_b" accept="image/*"></div><div><label class="f">AFTER photo *</label><input type="file" id="g_a" accept="image/*"></div></div>
    <label class="chk"><input type="checkbox" id="g_consent"><span>I confirm the client gave written consent to publish these photos. *</span></label>
    <label class="chk"><input type="checkbox" id="g_pub" checked><span>Show on website now</span></label>
    <div class="nav-row"><span></span><button class="btn" id="g_go">Upload</button></div></form></div>
   <div class="grid g3" style="margin-top:14px" id="gl"><div class="spin"></div></div>`;
  const load = async () => {
    const { items } = await run(() => api('/gallery'));
    $('#gl', el).innerHTML = items.map(g => `<div class="card gcard"><div class="ba"><img src="${g.before}" alt="before"><img src="${g.after}" alt="after"></div>
      <p style="margin-top:8px"><b>${esc(g.title)}</b> ${g.published ? '<span class="pill">On website</span>' : '<span class="pill off">Hidden</span>'}<br><small class="mini">${esc(g.treatment_label)}</small></p>
      <div class="toolbar" style="margin-top:8px"><button class="btn ghost sm" data-ed="${g.id}">Edit</button><button class="btn ghost sm" data-tg="${g.id}">${g.published ? 'Hide' : 'Show'}</button><button class="btn ghost sm danger-text" data-dl="${g.id}">Delete</button></div></div>`).join('') || '<p>No photos yet.</p>';
    $$('[data-tg]', el).forEach(x => x.onclick = async () => { const g = items.find(i => i.id == x.dataset.tg); const fd = new FormData(); fd.append('published', !g.published); await run(() => api('/gallery/' + g.id, { method: 'PATCH', form: fd }), 'Updated'); load(); });
    $$('[data-dl]', el).forEach(x => x.onclick = async () => { if (!confirm('Delete these photos from the website?')) return; await run(() => api('/gallery/' + x.dataset.dl, { method: 'DELETE' }), 'Deleted'); load(); });
    $$('[data-ed]', el).forEach(x => x.onclick = () => {
      const g = items.find(i => i.id == x.dataset.ed);
      const d = drawer(`<h2>Edit result</h2><label class="f">Title</label><input type="text" id="e_t" value="${esc(g.title)}"><label class="f">Treatment</label><input type="text" id="e_tr" value="${esc(g.treatment_label)}">
        <label class="f">Caption</label><input type="text" id="e_c" value="${esc(g.caption)}"><label class="f">Order (lower shows first)</label><input type="number" id="e_s" value="${g.sort}">
        <div class="row2"><div><label class="f">Replace BEFORE</label><input type="file" id="e_b" accept="image/*"></div><div><label class="f">Replace AFTER</label><input type="file" id="e_a" accept="image/*"></div></div>
        <div class="nav-row"><span></span><button class="btn" id="e_go">Save</button></div>`);
      $('#e_go', d.el).onclick = async () => {
        const fd = new FormData(); fd.append('title', fv(d.el, 'e_t')); fd.append('treatment', fv(d.el, 'e_tr')); fd.append('caption', fv(d.el, 'e_c')); fd.append('sort', fv(d.el, 'e_s'));
        if ($('#e_b', d.el).files[0]) fd.append('before', $('#e_b', d.el).files[0]); if ($('#e_a', d.el).files[0]) fd.append('after', $('#e_a', d.el).files[0]);
        $('#e_go', d.el).disabled = true; try { await run(() => api('/gallery/' + g.id, { method: 'PATCH', form: fd }), 'Saved'); d.close(); load(); } catch { $('#e_go', d.el).disabled = false; }
      };
    });
  };
  $('#gf', el).onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(); fd.append('title', fv(el, 'g_title')); fd.append('treatment', fv(el, 'g_tr')); fd.append('caption', fv(el, 'g_cap'));
    fd.append('consent', fv(el, 'g_consent')); fd.append('published', fv(el, 'g_pub'));
    if ($('#g_b', el).files[0]) fd.append('before', $('#g_b', el).files[0]); if ($('#g_a', el).files[0]) fd.append('after', $('#g_a', el).files[0]);
    $('#g_go', el).disabled = true; $('#g_go', el).textContent = 'Uploading…';
    try { await run(() => api('/gallery', { method: 'POST', form: fd }), 'Photos added'); $('#gf', el).reset(); load(); } catch {}
    $('#g_go', el).disabled = false; $('#g_go', el).textContent = 'Upload';
  };
  load();
};

VIEWS.treatments = async el => {
  const cat = await loadCatalog(true);
  el.innerHTML = `<h2 class="sec">Treatments & prices</h2><p class="lead">Changes show on the website immediately. "Featured" treatments appear on the home page. Turn off "Active" to hide a treatment without deleting it.</p>
   <div class="toolbar"><button class="btn sm" id="addT">+ Add treatment</button><button class="btn ghost sm" id="addC">+ Add category</button></div>
   ${cat.categories.map(c => `<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
     <h3>${esc(c.name)} ${c.active ? '' : '<span class="pill off">Hidden</span>'}</h3><div class="toolbar" style="margin:0"><button class="btn ghost sm" data-ec="${c.id}">Edit category</button></div></div>
     <div class="tw"><table><thead><tr><th>Treatment</th><th>Minutes</th><th>Price (₱)</th><th>Featured</th><th>Active</th><th></th></tr></thead><tbody>
     ${cat.treatments.filter(x => x.category_id === c.id).map(x => `<tr><td>${esc(x.name)}<br><small class="mini">${esc(x.description)}</small></td>
       <td><input type="number" min="5" max="600" step="5" value="${x.duration_min}" data-id="${x.id}" data-k="duration_min" style="width:90px"></td>
       <td><input type="number" min="0" step="10" value="${x.price}" data-id="${x.id}" data-k="price" style="width:110px"></td>
       <td><input type="checkbox" ${x.featured ? 'checked' : ''} data-id="${x.id}" data-k="featured"></td><td><input type="checkbox" ${x.active ? 'checked' : ''} data-id="${x.id}" data-k="active"></td>
       <td><button class="btn ghost sm" data-et="${x.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="6">No treatments.</td></tr>'}</tbody></table></div></div>`).join('')}`;
  $$('[data-k]', el).forEach(i => i.onchange = async () => {
    const v = i.type === 'checkbox' ? i.checked : Number(i.value);
    try { await api('/treatments/' + i.dataset.id, { method: 'PATCH', body: { [i.dataset.k]: v } }); toast('Saved'); CATALOG = null; } catch (e) { toast(e.message, true); VIEWS.treatments(el); }
  });
  const editT = x => {
    x = x || { category_id: cat.categories[0]?.id, name: '', description: '', duration_min: 60, price: 0, featured: false, active: true, sort: 0 };
    const d = drawer(`<h2>${x.id ? 'Edit' : 'Add'} treatment</h2><label class="f">Category</label><select id="t_c">${cat.categories.map(c => `<option value="${c.id}" ${c.id === x.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label class="f">Name *</label><input type="text" id="t_n" value="${esc(x.name)}" maxlength="160"><label class="f">Description</label><textarea id="t_d" maxlength="1000">${esc(x.description)}</textarea>
      <div class="row3"><div><label class="f">Minutes *</label><input type="number" id="t_m" value="${x.duration_min}" min="5" step="5"></div><div><label class="f">Price ₱ *</label><input type="number" id="t_p" value="${x.price}" min="0"></div><div><label class="f">Order</label><input type="number" id="t_s" value="${x.sort}"></div></div>
      <label class="chk"><input type="checkbox" id="t_f" ${x.featured ? 'checked' : ''}><span>Featured on home page</span></label><label class="chk"><input type="checkbox" id="t_a" ${x.active ? 'checked' : ''}><span>Active (bookable & visible)</span></label>
      <div class="nav-row">${x.id ? '<button class="btn danger sm" id="t_del">Delete</button>' : '<span></span>'}<button class="btn" id="t_go">Save</button></div>`);
    $('#t_go', d.el).onclick = async () => {
      const body = { category_id: Number(fv(d.el, 't_c')), name: fv(d.el, 't_n'), description: fv(d.el, 't_d'), duration_min: Number(fv(d.el, 't_m')), price: Number(fv(d.el, 't_p')), sort: Number(fv(d.el, 't_s')), featured: fv(d.el, 't_f'), active: fv(d.el, 't_a') };
      await run(() => api('/treatments' + (x.id ? '/' + x.id : ''), { method: x.id ? 'PATCH' : 'POST', body }), 'Saved'); d.close(); CATALOG = null; VIEWS.treatments(el);
    };
    if (x.id) $('#t_del', d.el).onclick = async () => { if (!confirm(`Delete "${x.name}"? Past bookings keep their record. Tip: untick Active to just hide it.`)) return; await run(() => api('/treatments/' + x.id, { method: 'DELETE' }), 'Deleted'); d.close(); CATALOG = null; VIEWS.treatments(el); };
  };
  const editC = c => {
    c = c || { name: '', sort: (cat.categories.length + 1) * 10, active: true };
    const d = drawer(`<h2>${c.id ? 'Edit' : 'Add'} category</h2><label class="f">Name *</label><input type="text" id="c_n" value="${esc(c.name)}"><label class="f">Order</label><input type="number" id="c_s" value="${c.sort}">
      <label class="chk"><input type="checkbox" id="c_a" ${c.active ? 'checked' : ''}><span>Show on website</span></label><div class="nav-row">${c.id ? '<button class="btn danger sm" id="c_del">Delete</button>' : '<span></span>'}<button class="btn" id="c_go">Save</button></div>`);
    $('#c_go', d.el).onclick = async () => { await run(() => api('/categories' + (c.id ? '/' + c.id : ''), { method: c.id ? 'PATCH' : 'POST', body: { name: fv(d.el, 'c_n'), sort: Number(fv(d.el, 'c_s')), active: fv(d.el, 'c_a') } }), 'Saved'); d.close(); CATALOG = null; VIEWS.treatments(el); };
    if (c.id) $('#c_del', d.el).onclick = async () => { if (!confirm('Delete this category?')) return; await run(() => api('/categories/' + c.id, { method: 'DELETE' }), 'Deleted'); d.close(); CATALOG = null; VIEWS.treatments(el); };
  };
  $('#addT', el).onclick = () => editT(); $('#addC', el).onclick = () => editC();
  $$('[data-et]', el).forEach(b => b.onclick = () => editT(cat.treatments.find(x => x.id == b.dataset.et)));
  $$('[data-ec]', el).forEach(b => b.onclick = () => editC(cat.categories.find(x => x.id == b.dataset.ec)));
};

VIEWS.team = async el => {
  const list = await loadPracs(true);
  el.innerHTML = `<h2 class="sec">Team</h2><p class="lead">Shown on the Team page. "Takes bookings" lets clients choose this person when booking.</p><div class="toolbar"><button class="btn sm" id="addP">+ Add team member</button></div>
   <div class="grid g3">${list.map(p => `<div class="card"><div class="avatar">${p.photo ? `<img src="${p.photo}" alt="">` : esc(p.name[0])}</div><h3>${esc(p.name)}</h3><p class="eyebrow">${esc(p.role)}</p>
     <p class="mini">${esc(p.credentials)}<br>${esc(p.specialties)}</p><p>${p.active ? '<span class="pill">On website</span>' : '<span class="pill off">Hidden</span>'} ${p.bookable ? '<span class="pill">Takes bookings</span>' : ''}</p>
     <button class="btn ghost sm" style="margin-top:8px" data-ep="${p.id}">Edit</button></div>`).join('')}</div>`;
  const edit = p => {
    p = p || { name: '', role: '', credentials: '', specialties: '', active: true, bookable: true, sort: (list.length + 1) * 10 };
    const d = drawer(`<h2>${p.id ? 'Edit' : 'Add'} team member</h2><label class="f">Name *</label><input type="text" id="p_n" value="${esc(p.name)}"><label class="f">Role / title</label><input type="text" id="p_r" value="${esc(p.role)}">
      <label class="f">Credentials</label><input type="text" id="p_c" value="${esc(p.credentials)}"><label class="f">Specialties</label><input type="text" id="p_s" value="${esc(p.specialties)}">
      <label class="f">Photo</label>${p.photo ? `<img src="${p.photo}" class="thumb" alt=""><label class="chk"><input type="checkbox" id="p_rm"><span>Remove photo</span></label>` : ''}<input type="file" id="p_ph" accept="image/*">
      <label class="f">Order</label><input type="number" id="p_o" value="${p.sort}">
      <label class="chk"><input type="checkbox" id="p_a" ${p.active ? 'checked' : ''}><span>Show on website</span></label><label class="chk"><input type="checkbox" id="p_b" ${p.bookable ? 'checked' : ''}><span>Takes bookings</span></label>
      <div class="nav-row">${p.id ? '<button class="btn danger sm" id="p_del">Delete</button>' : '<span></span>'}<button class="btn" id="p_go">Save</button></div>`);
    $('#p_go', d.el).onclick = async () => {
      const fd = new FormData(); [['name', 'p_n'], ['role', 'p_r'], ['credentials', 'p_c'], ['specialties', 'p_s'], ['sort', 'p_o'], ['active', 'p_a'], ['bookable', 'p_b']].forEach(([k, i]) => fd.append(k, fv(d.el, i)));
      if ($('#p_rm', d.el)?.checked) fd.append('removePhoto', 'true'); if ($('#p_ph', d.el).files[0]) fd.append('photo', $('#p_ph', d.el).files[0]);
      await run(() => api('/practitioners' + (p.id ? '/' + p.id : ''), { method: p.id ? 'PATCH' : 'POST', form: fd }), 'Saved'); d.close(); PRACS = null; VIEWS.team(el);
    };
    if (p.id) $('#p_del', d.el).onclick = async () => { if (!confirm(`Delete ${p.name}? Tip: untick "Show on website" to just hide them.`)) return; await run(() => api('/practitioners/' + p.id, { method: 'DELETE' }), 'Deleted'); d.close(); PRACS = null; VIEWS.team(el); };
  };
  $('#addP', el).onclick = () => edit(); $$('[data-ep]', el).forEach(b => b.onclick = () => edit(list.find(x => x.id == b.dataset.ep)));
};

VIEWS.content = async el => {
  const LISTS = [
    ['promos', 'Packages & promos', [['chip', 'Label (e.g. PROMO)', 'text'], ['title', 'Title *', 'text'], ['body', 'Description', 'textarea']], x => `<b>${esc(x.title)}</b> <small class="mini">${esc(x.chip)}</small><br><small>${esc(x.body)}</small>`],
    ['testimonials', 'Client reviews', [['quote', 'Quote *', 'textarea'], ['author', 'Name / place', 'text']], x => `“${esc(x.quote)}” <small class="mini">— ${esc(x.author)}</small>`],
    ['faqs', 'FAQ', [['question', 'Question *', 'text'], ['answer', 'Answer *', 'textarea']], x => `<b>${esc(x.question)}</b><br><small>${esc(x.answer)}</small>`],
  ];
  el.innerHTML = `<h2 class="sec">Promos · Reviews · FAQ</h2>` + LISTS.map(([k, n]) => `<div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${n}</h3><button class="btn sm" data-add="${k}">+ Add</button></div><div id="l_${k}"><div class="spin"></div></div></div>`).join('');
  for (const [k, , fields, show] of LISTS) {
    const load = async () => {
      const { items } = await run(() => api('/' + k));
      $('#l_' + k, el).innerHTML = items.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line);padding:10px 0"><div>${show(x)} ${x.active ? '' : '<span class="pill off">Hidden</span>'}</div><button class="btn ghost sm" data-ed="${x.id}">Edit</button></div>`).join('') || '<p>None yet.</p>';
      $$('[data-ed]', $('#l_' + k, el)).forEach(b => b.onclick = () => edit(items.find(i => i.id == b.dataset.ed)));
    };
    const edit = x => {
      x = x || { active: true, sort: 0 };
      const d = drawer(`<h2>${x.id ? 'Edit' : 'Add'}</h2>${fields.map(([f, l, t]) => `<label class="f">${l}</label>${t === 'textarea' ? `<textarea id="x_${f}">${esc(x[f])}</textarea>` : `<input type="text" id="x_${f}" value="${esc(x[f])}">`}`).join('')}
        <label class="f">Order (lower shows first)</label><input type="number" id="x_sort" value="${x.sort || 0}"><label class="chk"><input type="checkbox" id="x_active" ${x.active ? 'checked' : ''}><span>Show on website</span></label>
        <div class="nav-row">${x.id ? '<button class="btn danger sm" id="x_del">Delete</button>' : '<span></span>'}<button class="btn" id="x_go">Save</button></div>`);
      $('#x_go', d.el).onclick = async () => {
        const body = Object.fromEntries(fields.map(([f]) => [f, fv(d.el, 'x_' + f)])); body.sort = Number(fv(d.el, 'x_sort')); body.active = fv(d.el, 'x_active');
        await run(() => api(`/${k}${x.id ? '/' + x.id : ''}`, { method: x.id ? 'PATCH' : 'POST', body }), 'Saved'); d.close(); load();
      };
      if (x.id) $('#x_del', d.el).onclick = async () => { if (!confirm('Delete this item?')) return; await run(() => api(`/${k}/${x.id}`, { method: 'DELETE' }), 'Deleted'); d.close(); load(); };
    };
    $(`[data-add=${k}]`, el).onclick = () => edit(); load();
  }
};

VIEWS.site = async el => {
  const s = await loadSettings(true), site = s.site, bk = s.booking;
  const inp = (id, label, v, type = 'text', extra = '') => `<label class="f" for="${id}">${label}</label><input type="${type}" id="${id}" value="${esc(v)}" ${extra}>`;
  const ta = (id, label, v) => `<label class="f" for="${id}">${label}</label><textarea id="${id}">${esc(v)}</textarea>`;
  el.innerHTML = `<h2 class="sec">Clinic info & settings</h2>
   <div class="card"><h3>Clinic details</h3><div class="row2"><div>${inp('s_name', 'Clinic name', site.name)}</div><div>${inp('s_city', 'City (shown above name)', site.city)}</div></div>
    <div class="row2"><div>${inp('s_tag', 'Tagline (English)', site.tagline)}</div><div>${inp('s_tagf', 'Tagline (Filipino)', site.taglineFil)}</div></div>
    ${inp('s_addr', 'Address', site.address)}<div class="row2"><div>${inp('s_phone', 'Phone', site.phone)}</div><div>${inp('s_email', 'Email', site.email, 'email')}</div></div>
    <div class="row2"><div>${inp('s_hs', 'Hours (short, home page)', site.hoursShort)}</div><div>${ta('s_hl', 'Hours (full, contact & footer)', site.hoursLong)}</div></div>
    ${inp('s_meta', 'Google search description', site.metaDescription, 'text', 'maxlength="160"')}
    ${inp('s_map', 'Google Maps embed link (Google Maps → Share → Embed a map → copy the link inside src="…")', site.mapEmbedUrl, 'url', 'placeholder="https://www.google.com/maps/embed?pb=..."')}</div>
   <div class="card" style="margin-top:12px"><h3>Social & chat links</h3><div class="row3"><div>${inp('s_fb', 'Facebook page URL', site.social.facebook, 'url')}</div><div>${inp('s_ig', 'Instagram URL', site.social.instagram, 'url')}</div><div>${inp('s_tt', 'TikTok URL', site.social.tiktok, 'url')}</div></div>
    <div class="row3"><div>${inp('s_wa', 'WhatsApp number (e.g. 639276507729)', site.chat.whatsapp)}</div><div>${inp('s_vb', 'Viber number (e.g. +639276507729)', site.chat.viber)}</div><div>${inp('s_ms', 'Messenger page username (m.me/____)', site.chat.messenger)}</div></div></div>
   <div class="card" style="margin-top:12px"><h3>Home & page text</h3>${inp('s_ti', 'Text under "Our most-loved treatments"', site.topIntro)}${inp('s_tri', 'Treatments page intro', site.treatmentsIntro)}
    ${inp('s_rn', 'Results page note', site.resultsNote)}${inp('s_tmi', 'Team page intro', site.teamIntro)}
    <h4 style="margin-top:14px">Trust badges</h4>${site.badges.map((b, i) => `<div class="row3"><div>${inp('bi' + i, 'Icon', b.icon)}</div><div>${inp('bt' + i, 'Title', b.title)}</div><div>${inp('bx' + i, 'Text', b.text)}</div></div>`).join('')}
    <h4 style="margin-top:14px">Loyalty section</h4><div class="row2"><div>${inp('l_t', 'Title', site.loyalty.title)}</div><div>${inp('l_ct', 'Card title', site.loyalty.cardTitle)}</div></div>
    <div class="row2"><div>${ta('l_x', 'Text', site.loyalty.text)}</div><div>${ta('l_cx', 'Card text', site.loyalty.cardText)}</div></div>
    ${ta('s_pre', 'Before-your-visit instructions (one per line)', site.preTreatment.join('\n'))}${ta('s_priv', 'Privacy policy', site.privacyText)}
    <div class="nav-row"><span></span><button class="btn" id="saveSite">Save clinic info</button></div></div>
   <div class="card" style="margin-top:12px"><h3>Booking rules</h3>
    <label class="chk"><input type="checkbox" id="b_on" ${bk.onlineBookingEnabled ? 'checked' : ''}><span><b>Online booking is ON</b> (untick to pause, e.g. during a closure)</span></label>
    <div class="row3"><div>${inp('b_oh', 'Opens (hour, 0–23)', bk.openHour, 'number', 'min="0" max="23"')}</div><div>${inp('b_ch', 'Closes (hour, 1–24)', bk.closeHour, 'number', 'min="1" max="24"')}</div><div>${inp('b_ss', 'Start times every (min)', bk.slotStep, 'number')}</div></div>
    <div class="row3"><div>${inp('b_bf', 'Cleaning buffer after each appt (min)', bk.buffer, 'number')}</div><div>${inp('b_mn', 'Earliest online booking (min from now)', bk.minNoticeMin, 'number')}</div><div>${inp('b_cx', 'Self-cancel allowed until (hours before)', bk.cancelHours, 'number')}</div></div>
    <div class="row3"><div>${inp('b_ad', 'Book up to (days ahead)', bk.maxAdvanceDays, 'number')}</div></div>
    <label class="f">Closed every</label><div class="toolbar">${DAYS.map((d, i) => `<label class="chk" style="margin:0 10px 0 0"><input type="checkbox" class="b_cd" value="${i}" ${bk.closedDays.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
    <h4 style="margin-top:10px">Consultation</h4><div class="row3"><div>${inp('b_cl', 'Name', bk.consult.label)}</div><div>${inp('b_cd', 'Minutes', bk.consult.duration, 'number')}</div><div>${inp('b_cp', 'Price ₱ (0 = free)', bk.consult.price, 'number')}</div></div>
    ${inp('b_cdesc', 'Consultation description', bk.consult.description)}
    <div class="nav-row"><span></span><button class="btn" id="saveBk">Save booking rules</button></div></div>
   <div class="card" style="margin-top:12px"><h3>Message templates</h3><p class="mini">Placeholders: {name} {code} {service} {specialist} {date} {time} {status} {total} {clinic_phone} {clinic_address} {cancel_hours} {manage_link} {site_link}</p>
    ${s.templates.map((x, i) => `<h4 style="margin-top:12px">${esc(x.name)}</h4>${inp('tp_s' + i, 'Subject', x.subject)}${ta('tp_b' + i, 'Message', x.body)}`).join('')}
    <div class="nav-row"><span></span><button class="btn" id="saveTp">Save templates</button></div></div>`;
  $('#saveSite', el).onclick = () => {
    const v = id => fv(el, id);
    const value = { ...site, name: v('s_name'), city: v('s_city'), tagline: v('s_tag'), taglineFil: v('s_tagf'), address: v('s_addr'), phone: v('s_phone'), email: v('s_email'),
      hoursShort: v('s_hs'), hoursLong: v('s_hl'), metaDescription: v('s_meta'), mapEmbedUrl: v('s_map'), topIntro: v('s_ti'), treatmentsIntro: v('s_tri'), resultsNote: v('s_rn'), teamIntro: v('s_tmi'),
      social: { facebook: v('s_fb'), instagram: v('s_ig'), tiktok: v('s_tt') }, chat: { whatsapp: v('s_wa'), viber: v('s_vb'), messenger: v('s_ms') },
      badges: site.badges.map((b, i) => ({ icon: v('bi' + i), title: v('bt' + i), text: v('bx' + i) })),
      loyalty: { title: v('l_t'), text: v('l_x'), cardTitle: v('l_ct'), cardText: v('l_cx') },
      preTreatment: v('s_pre').split('\n').map(x => x.trim()).filter(Boolean), privacyText: v('s_priv') };
    if (value.mapEmbedUrl && !/^https:\/\/(www\.)?google\.com\/maps\/embed/.test(value.mapEmbedUrl)) return toast('The map link must start with https://www.google.com/maps/embed', true);
    run(() => api('/settings/site', { method: 'PUT', body: value }), 'Clinic info saved');
  };
  $('#saveBk', el).onclick = () => {
    const n = id => Number(fv(el, id));
    run(() => api('/settings/booking', { method: 'PUT', body: { onlineBookingEnabled: fv(el, 'b_on'), openHour: n('b_oh'), closeHour: n('b_ch'), slotStep: n('b_ss'), buffer: n('b_bf'), minNoticeMin: n('b_mn'),
      cancelHours: n('b_cx'), maxAdvanceDays: n('b_ad'), closedDays: $$('.b_cd:checked', el).map(x => Number(x.value)), consult: { label: fv(el, 'b_cl'), duration: n('b_cd'), price: n('b_cp'), description: fv(el, 'b_cdesc') } } }), 'Booking rules saved');
  };
  $('#saveTp', el).onclick = () => run(() => api('/settings/templates', { method: 'PUT', body: s.templates.map((x, i) => ({ ...x, subject: fv(el, 'tp_s' + i), body: fv(el, 'tp_b' + i) })) }), 'Templates saved');
};

VIEWS.users = async el => {
  const { users } = await run(() => api('/users'));
  el.innerHTML = `<h2 class="sec">Staff accounts</h2><p class="lead"><b>Staff</b> can manage bookings, block times and upload results photos. <b>Admins</b> can also change prices, team, website text, settings and accounts.</p>
   <div class="toolbar"><button class="btn sm" id="addU">+ Add account</button></div>
   <div class="tw card" style="padding:6px"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead><tbody>
   ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${u.active ? '<span class="pill">Active</span>' : '<span class="pill off">Disabled</span>'}</td><td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-PH') : '—'}</td><td><button class="btn ghost sm" data-eu="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
  const edit = u => {
    u = u || { name: '', email: '', role: 'staff', active: true };
    const d = drawer(`<h2>${u.id ? 'Edit' : 'Add'} account</h2><label class="f">Name *</label><input type="text" id="u_n" value="${esc(u.name)}">
      <label class="f">Email *</label><input type="email" id="u_e" value="${esc(u.email)}" ${u.id ? 'disabled' : ''}>
      <label class="f">Role</label><select id="u_r"><option value="staff">Staff</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select>
      <label class="f">${u.id ? 'New password (leave blank to keep)' : 'Password *'} <small>(10+ characters, letters and numbers)</small></label><input type="password" id="u_p" autocomplete="new-password">
      ${u.id ? `<label class="chk"><input type="checkbox" id="u_a" ${u.active ? 'checked' : ''}><span>Account active (untick when someone leaves)</span></label>` : ''}
      <div class="nav-row">${u.id && u.id !== ME.id ? '<button class="btn danger sm" id="u_del">Delete</button>' : '<span></span>'}<button class="btn" id="u_go">Save</button></div>`);
    $('#u_go', d.el).onclick = async () => {
      const body = { name: fv(d.el, 'u_n'), role: fv(d.el, 'u_r') }; if (fv(d.el, 'u_p')) body.password = fv(d.el, 'u_p');
      if (!u.id) body.email = fv(d.el, 'u_e'); else body.active = fv(d.el, 'u_a');
      await run(() => api('/users' + (u.id ? '/' + u.id : ''), { method: u.id ? 'PATCH' : 'POST', body }), 'Saved'); d.close(); VIEWS.users(el);
    };
    if ($('#u_del', d.el)) $('#u_del', d.el).onclick = async () => { if (!confirm(`Delete ${u.name}'s account?`)) return; await run(() => api('/users/' + u.id, { method: 'DELETE' }), 'Deleted'); d.close(); VIEWS.users(el); };
  };
  $('#addU', el).onclick = () => edit(); $$('[data-eu]', el).forEach(b => b.onclick = () => edit(users.find(x => x.id == b.dataset.eu)));
};

VIEWS.audit = async el => {
  const { entries } = await run(() => api('/audit'));
  el.innerHTML = `<h2 class="sec">Activity log</h2><p class="lead">The last 300 changes made by staff.</p><div class="tw card" style="padding:6px"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th></tr></thead><tbody>
   ${entries.map(a => `<tr><td>${new Date(a.at).toLocaleString('en-PH')}</td><td>${esc(a.user_name)}</td><td>${esc(a.action)}</td><td>${esc(a.entity || '')} ${esc(a.entity_id || '')}<br><small class="mini">${esc(a.details ? JSON.stringify(a.details) : '')}</small></td></tr>`).join('') || '<tr><td colspan="4">Nothing yet.</td></tr>'}</tbody></table></div>`;
};

VIEWS.account = el => {
  el.innerHTML = `<h2 class="sec">My password</h2><div class="card" style="max-width:480px"><label class="f">Current password</label><input type="password" id="pw0" autocomplete="current-password">
   <label class="f">New password <small>(10+ characters, letters and numbers)</small></label><input type="password" id="pw1" autocomplete="new-password">
   <label class="f">Repeat new password</label><input type="password" id="pw2" autocomplete="new-password"><div class="nav-row"><span></span><button class="btn" id="pwgo">Change password</button></div></div>`;
  $('#pwgo', el).onclick = async () => {
    if (fv(el, 'pw1') !== fv(el, 'pw2')) return toast('New passwords do not match', true);
    await run(() => api('/me/password', { method: 'POST', body: { current: fv(el, 'pw0'), password: fv(el, 'pw1') } }), 'Password changed');
    $$('input', el).forEach(i => { i.value = ''; });
  };
};

boot();
})();

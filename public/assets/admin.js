/* Mirror Aesthetics – staff dashboard */
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
const stLabel = s => (s === 'noshow' ? 'no-show' : s);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
function toast(m, bad) { const d = document.createElement('div'); d.className = 'toast'; if (bad) d.style.background = 'var(--danger)'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3600); }

const IC = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bookings: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', new: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  blocks: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', gallery: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  treatments: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
  content: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>', site: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', audit: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', account: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>', collapse: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>', chevR: '<path d="M9 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
};
const ic = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

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
const fv = (root, id) => { const e = $('#' + id, root); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : undefined; };

function drawer(title, html) {
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<div class="panel2" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="drawer-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${ic('close')}</button></div><div class="body">${html}</div></div>`;
  document.body.appendChild(d); document.body.style.overflow = 'hidden';
  const close = () => { d.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  return { el: $('.body', d), close };
}
function dropTile(id, label, current) {
  return `<label class="drop" for="${id}">${current ? `<img src="${current}" alt="">` : ''}<span><b>${label}</b>${current ? 'Tap to replace' : 'Tap to choose a photo'}</span><input type="file" id="${id}" accept="image/*"></label>`;
}
function wireDrops(root) {
  $$('.drop input', root).forEach(inp => inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const lab = inp.closest('.drop');
    let img = $('img', lab); if (!img) { img = document.createElement('img'); lab.prepend(img); }
    img.src = URL.createObjectURL(f);
  });
}

/* ================================================================ state */
let ME = null, EMAIL_ON = false, VIEW = 'dashboard';
let CATALOG = null, PRACS = null, SETTINGS = null;
const BK = { from: today(), to: '', status: '', prac: '', treatment: '', q: '', sort: 'date' };
let CAL = new Date(); CAL.setDate(1);
let TSEL = null, GSEL = null;
const loadCatalog = async force => { if (!CATALOG || force) CATALOG = await api('/catalog'); return CATALOG; };
const loadPracs = async force => { if (!PRACS || force) PRACS = (await api('/practitioners')).practitioners; return PRACS; };
const loadSettings = async force => { if (!SETTINGS || force) SETTINGS = await api('/settings'); return SETTINGS; };

/* ================================================================ login */
function renderLogin(msg) {
  $('#app').innerHTML = `<div class="login-wrap"><div class="panel login"><div class="mono">M</div><h2 style="text-align:center;font-size:1.9rem">Staff sign in</h2><p class="mini" style="text-align:center;margin-bottom:8px">Mirror Aesthetics dashboard</p>
    <form id="lf"><label class="f" for="le">Email</label><input type="email" id="le" autocomplete="username" required>
    <label class="f" for="lp">Password</label><input type="password" id="lp" autocomplete="current-password" required>
    <div class="err" id="lerr">${esc(msg || '')}</div><button class="btn" id="lb" style="width:100%;margin-top:10px">Sign in</button></form>
    <p class="mini" style="text-align:center;margin-top:16px">Forgot your password? Ask the clinic admin to reset it.</p></div></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lb').disabled = true;
    try { await api('/login', { method: 'POST', body: { email: $('#le').value, password: $('#lp').value } }); boot(); }
    catch (er) { $('#lerr').textContent = er.message; $('#lb').disabled = false; }
  };
}

/* ================================================================ shell */
const NAV = [
  ['grp', 'Daily'], ['dashboard', 'Today', 'today'], ['bookings', 'Bookings', 'bookings'], ['calendar', 'Calendar', 'calendar'], ['new', 'New booking', 'new'], ['blocks', 'Block times', 'blocks'],
  ['grp', 'Website'], ['gallery', 'Results photos', 'gallery'], ['treatments', 'Treatments & prices', 'treatments', 1], ['team', 'Team', 'team', 1], ['content', 'Promos, reviews & FAQ', 'content', 1], ['site', 'Clinic info & settings', 'site', 1],
  ['grp', 'Admin'], ['users', 'Staff accounts', 'users', 1], ['audit', 'Activity log', 'audit', 1], ['account', 'My password', 'account'],
];
const TITLES = Object.fromEntries(NAV.filter(n => n[0] !== 'grp').map(n => [n[0], n[1]]));
function shell() {
  const isAdmin = ME.role === 'admin';
  const collapsed = store.get('ma_sb') === '1';
  $('#app').innerHTML = `<div class="shell ${collapsed ? 'collapsed' : ''}" id="shell">
    <aside class="sb" aria-label="Dashboard menu">
      <div class="sb-top"><span class="mono">M</span><span class="sb-name"><b>Mirror</b><i>Aesthetics</i></span>
        <button class="collapse-btn" id="collapse" aria-label="${collapsed ? 'Expand' : 'Collapse'} menu" title="${collapsed ? 'Expand' : 'Collapse'} menu"><span class="collapse-ic">${ic('collapse')}</span></button></div>
      <nav>${NAV.filter(n => !n[3] || isAdmin).map(n => n[0] === 'grp' ? `<div class="grp">${n[1]}</div>`
        : `<button data-v="${n[0]}" title="${esc(n[1])}">${ic(n[2])}<span class="lbl">${n[1]}</span>${n[0] === 'bookings' ? '<span class="badge hide" id="pendBadge"></span>' : ''}</button>`).join('')}</nav>
      <div class="sb-foot"><div class="me"><span class="av">${esc(ME.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span><div><b>${esc(ME.name)}</b><small>${esc(ME.role)}</small></div>
        <button class="logout-btn" id="logout" aria-label="Log out" title="Log out">${ic('logout')}</button></div></div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main"><header class="topbar"><button class="burger" id="burger" aria-label="Open menu">${ic('menu')}</button><span class="crumb" id="crumb"></span>
      <a href="/" target="_blank" rel="noopener">View website ${ic('ext')}</a></header><section id="view"></section></div></div>`;
  $$('.sb nav [data-v]').forEach(b => b.onclick = () => { $('#shell').classList.remove('mobile-open'); go(b.dataset.v); });
  $('#collapse').onclick = () => {
    const c = $('#shell').classList.toggle('collapsed');
    store.set('ma_sb', c ? '1' : '0');
    $('#collapse').setAttribute('aria-label', `${c ? 'Expand' : 'Collapse'} menu`);
    $('#collapse').title = `${c ? 'Expand' : 'Collapse'} menu`;
  };
  $('#burger').onclick = () => $('#shell').classList.add('mobile-open');
  $('#scrim').onclick = () => $('#shell').classList.remove('mobile-open');
  $('#logout').onclick = async () => { await quiet(api('/logout', { method: 'POST' })); ME = null; CATALOG = PRACS = SETTINGS = null; renderLogin(); };
}
function setBadge(n) { const b = $('#pendBadge'); if (!b) return; b.textContent = n; b.classList.toggle('hide', !n); b.parentElement.classList.toggle('has-badge', !!n); }
function go(v) {
  if (!VIEWS[v] || (NAV.find(n => n[0] === v)?.[3] && ME.role !== 'admin')) v = 'dashboard';
  VIEW = v; history.replaceState(null, '', '#' + v);
  $$('.sb nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#crumb').textContent = TITLES[v] || '';
  const el = $('#view'); el.innerHTML = '<div class="spin"></div>';
  Promise.resolve().then(() => VIEWS[v](el)).catch(e => { if (VIEW === v) el.innerHTML = `<div class="box empty">${esc(e.message)}</div>`; });
  window.scrollTo(0, 0);
}
async function boot() {
  try { const r = await api('/me'); ME = r.user; EMAIL_ON = r.emailEnabled; } catch { return; }
  shell();
  quiet(api('/dashboard').then(d => setBadge(d.counts.pending)));
  go(location.hash.slice(1) || 'dashboard');
}

/* ================================================================ booking pieces */
const stBadge = s => `<span class="st ${s}">${stLabel(s)}</span>`;
function bookingTable(list, emptyMsg) {
  if (!list.length) return `<div class="box empty">${emptyMsg || 'No bookings.'}</div>`;
  return `<div class="box tw" style="padding:4px 8px"><table class="t"><thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Service</th><th>Specialist</th><th>Status</th></tr></thead><tbody>
  ${list.map(b => `<tr class="click" data-open="${b.id}"><td>${fmtDate(b.date)}</td><td>${fmtTime(b.start)}</td><td><b>${esc(b.client)}</b><br><span class="mini">${esc(b.code)} · ${esc(b.phone)}</span></td>
   <td>${esc(b.service)}</td><td>${esc(b.practitioner || '—')}</td><td>${stBadge(b.status)}</td></tr>`).join('')}</tbody></table></div>`;
}
const fromFull = b => ({ id: b.id, code: b.code, date: b.date, start: b.start_min, client: b.client_name, phone: b.client_phone, service: b.service, practitioner: b.practitioner_name, status: b.status });
function wireOpen(root, after) { $$('[data-open]', root).forEach(r => r.onclick = () => openBooking(Number(r.dataset.open), after)); }

async function openBooking(id, after) {
  const { booking: b } = await run(() => api('/bookings/' + id));
  await Promise.all([loadSettings(), loadPracs()]);
  const d = drawer(b.client_name, '');
  const refresh = () => { d.close(); after && after(); quiet(api('/dashboard').then(x => setBadge(x.counts.pending))); openBooking(id, after); };
  const canMail = EMAIL_ON && b.client_email;
  d.el.innerHTML = `<p class="mini">${esc(b.code)} · booked ${new Date(b.created_at).toLocaleString('en-PH')} · ${esc(b.source)}</p>
   <div class="box" style="margin-top:14px"><dl class="kv"><dt>Status</dt><dd>${stBadge(b.status)}</dd><dt>Service</dt><dd>${esc(b.service)}</dd>
    <dt>When</dt><dd>${fmtDate(b.date)} · ${fmtTime(b.start_min)} – ${fmtTime(b.start_min + b.duration_min)}</dd><dt>Specialist</dt><dd>${esc(b.practitioner_name || '—')}</dd>
    <dt>Estimated total</dt><dd>${b.price ? peso(b.price) : 'Free'}</dd></dl></div>
   <h4>Update status</h4><div class="toolbar">${STATUSES.filter(s => s !== b.status).map(s => `<button class="btn sm ${['cancelled', 'noshow'].includes(s) ? 'line' : ''}" data-st="${s}">${s === 'confirmed' ? 'Confirm' : 'Mark ' + stLabel(s)}</button>`).join('')}</div>
   <label class="chk"><input type="checkbox" id="notify" ${canMail ? 'checked' : 'disabled'}><span>Email the client about this change ${EMAIL_ON ? (b.client_email ? '' : '(no email on file)') : '(email not set up yet)'}</span></label>
   <h4>Client</h4><div class="box"><dl class="kv">
    <dt>Phone</dt><dd><a href="tel:${esc(b.client_phone)}">${esc(b.client_phone)}</a></dd><dt>Email</dt><dd>${b.client_email ? `<a href="mailto:${esc(b.client_email)}">${esc(b.client_email)}</a>` : '—'}</dd>
    <dt>Age</dt><dd>${esc(b.client_age ?? '—')}</dd><dt>Concerns</dt><dd>${esc(b.concerns || '—')}</dd><dt>Allergies</dt><dd>${esc(b.allergies || '—')}</dd>
    <dt>Pregnant / BF</dt><dd>${esc(b.pregnant || '—')}</dd><dt>Medications</dt><dd>${esc(b.medications || '—')}</dd><dt>Client notes</dt><dd>${esc(b.notes || '—')}</dd>
    <dt>Consent</dt><dd>${b.consent_at ? new Date(b.consent_at).toLocaleString('en-PH') : 'n/a (staff booking)'}</dd></dl>
    ${b.photo ? `<a href="${b.photo}" target="_blank" rel="noopener"><img src="${b.photo}" alt="Client photo" style="max-width:200px;border-radius:8px;margin-top:12px"></a>` : ''}
    <div style="margin-top:12px"><button class="btn sm line" id="editClient">Edit details</button></div></div>
   <h4>Staff notes (private)</h4><textarea id="snotes" placeholder="e.g. prefers Jasmine, paid ₱500 deposit">${esc(b.staff_notes)}</textarea><div style="margin-top:8px;text-align:right"><button class="btn sm" id="saveNotes">Save notes</button></div>
   <h4>Reschedule</h4><div class="box" id="rsBox"></div>
   <h4>Send a message</h4><div class="toolbar"><select id="tplSel" class="grow">${SETTINGS.templates.map(x => `<option value="${x.key}">${esc(x.name)}</option>`).join('')}</select>
    <button class="btn sm line" id="copyMsg">Copy</button>${canMail ? '<button class="btn sm" id="mailMsg">Email it</button>' : ''}</div><pre class="tpl" id="msgPrev"></pre>
   ${ME.role === 'admin' ? `<h4 class="danger-text">Delete</h4><p class="mini">Permanently removes this booking and the client's health information – use for data-deletion requests. To cancel, use "Mark cancelled".</p><button class="btn sm danger" id="delB" style="margin-top:8px">Delete permanently</button>` : ''}`;
  $$('[data-st]', d.el).forEach(x => x.onclick = async () => { await run(() => api('/bookings/' + id, { method: 'PATCH', body: { status: x.dataset.st, notify: $('#notify', d.el).checked } }), 'Status updated'); refresh(); });
  $('#saveNotes', d.el).onclick = () => run(() => api('/bookings/' + id, { method: 'PATCH', body: { staff_notes: $('#snotes', d.el).value } }), 'Notes saved');
  const prev = async () => { const r = await run(() => api(`/bookings/${id}/message/${$('#tplSel', d.el).value}`)); $('#msgPrev', d.el).textContent = r.body; return r; };
  $('#tplSel', d.el).onchange = prev; quiet(prev());
  $('#copyMsg', d.el).onclick = async () => { const r = await prev(); try { await navigator.clipboard.writeText(r.body); toast('Copied – paste it into SMS, Viber or Messenger'); } catch { toast('Select the text and copy it manually.'); } };
  if ($('#mailMsg', d.el)) $('#mailMsg', d.el).onclick = () => run(() => api(`/bookings/${id}/email/${$('#tplSel', d.el).value}`, { method: 'POST' }), 'Email sent');
  if ($('#delB', d.el)) $('#delB', d.el).onclick = async () => { if (!confirm(`Delete booking ${b.code} permanently? This cannot be undone.`)) return; await run(() => api('/bookings/' + id, { method: 'DELETE' }), 'Booking deleted'); d.close(); after && after(); };
  $('#editClient', d.el).onclick = () => editClient(b, refresh);
  slotPicker($('#rsBox', d.el), { bookingId: id, date: b.date, prac: b.practitioner_id, current: b.start_min, label: 'Move booking', onPick: async (date, start, prac, force) => {
    await run(() => api(`/bookings/${id}/reschedule`, { method: 'POST', body: { date, start, prac, force, notify: $('#notify', d.el).checked } }), 'Booking moved'); refresh();
  } });
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
function editClient(b, done) {
  const d = drawer('Edit client details', `<form id="ec">${clientFields({ name: b.client_name, phone: b.client_phone, email: b.client_email, age: b.client_age, concerns: b.concerns, allergies: b.allergies, pregnant: b.pregnant, medications: b.medications, notes: b.notes })}
   <div class="nav-row"><span></span><button class="btn">Save</button></div></form>`);
  $('#ec', d.el).onsubmit = async e => { e.preventDefault(); try { await api('/bookings/' + b.id, { method: 'PATCH', body: { client: readClient(d.el) } }); toast('Saved'); d.close(); done(); } catch (er) { showFieldErrors(d.el, er); } };
}
function slotPicker(box, { bookingId, getServices, date, prac, current, label, onPick }) {
  box.innerHTML = `<div class="row3"><div><label class="f" style="margin-top:0">Date</label><input type="date" id="sp_d" value="${date || today()}"></div>
   <div><label class="f" style="margin-top:0">Specialist</label><select id="sp_p"><option value="any">Any available</option>${PRACS.filter(p => p.active).map(p => `<option value="${p.id}" ${String(prac) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
   <div><label class="f" style="margin-top:0">&nbsp;</label><button type="button" class="btn line" id="sp_go" style="width:100%">Show free times</button></div></div>
   <div id="sp_s" style="margin-top:6px"></div>
   <label class="chk"><input type="checkbox" id="sp_force"><span>Override – allow double-booking or outside hours</span></label>
   <div class="row2" id="sp_manual" style="display:none"><div><label class="f" style="margin-top:0">Start time</label><input type="time" id="sp_t" value="${current != null ? toHHMM(current) : '10:00'}"></div>
   <div><label class="f" style="margin-top:0">&nbsp;</label><button type="button" class="btn gold" id="sp_mgo" style="width:100%">${label}</button></div></div>`;
  let sel = null;
  const load = async () => {
    const body = { date: $('#sp_d', box).value, prac: $('#sp_p', box).value };
    if (bookingId) body.bookingId = bookingId; else Object.assign(body, getServices());
    if (!bookingId && body.type === 'treatment' && !(body.treatmentIds || []).length) { $('#sp_s', box).innerHTML = '<p class="err">Choose a service first.</p>'; return; }
    $('#sp_s', box).innerHTML = '<div class="spin"></div>';
    try {
      const { slots } = await api('/availability/day', { method: 'POST', body });
      $('#sp_s', box).innerHTML = `<p class="mini" style="margin-top:10px">Faded times are taken, blocked or outside opening hours.</p>
       <div class="slots admin">${slots.map(s => `<button type="button" class="slot" data-t="${s.t}" data-p="${s.prac || ''}" ${s.ok ? '' : 'disabled'}>${fmtTime(s.t)}</button>`).join('') || '<p>Closed.</p>'}</div>
       <div class="nav-row" style="margin-top:14px"><span></span><button type="button" class="btn gold" id="sp_ok" disabled>${label}</button></div>`;
      $$('.slot', box).forEach(x => x.onclick = () => { sel = { t: Number(x.dataset.t), p: x.dataset.p }; $$('.slot', box).forEach(y => y.classList.toggle('sel', y === x)); $('#sp_ok', box).disabled = false; });
      $('#sp_ok', box).onclick = () => sel && onPick($('#sp_d', box).value, sel.t, sel.p || $('#sp_p', box).value, false);
    } catch (e) { $('#sp_s', box).innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $('#sp_go', box).onclick = load;
  $('#sp_force', box).onchange = e => { $('#sp_manual', box).style.display = e.target.checked ? 'grid' : 'none'; };
  $('#sp_mgo', box).onclick = () => { const v = $('#sp_t', box).value; if (!v) return toast('Enter a start time', true); onPick($('#sp_d', box).value, toMin(v), $('#sp_p', box).value, true); };
  if (bookingId) quiet(load());
}

/* ================================================================ views */
const VIEWS = {};

VIEWS.dashboard = async el => {
  const d = await run(() => api('/dashboard')); setBadge(d.counts.pending);
  const h = new Date().getHours();
  el.innerHTML = `<h2 class="sec">Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${esc(ME.name.split(' ')[0])}</h2><p class="sub">${new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
   <div class="stats"><div class="stat"><b>${d.counts.today}</b><span>Appointments today</span></div><div class="stat ${d.counts.pending ? 'alert' : ''}"><b>${d.counts.pending}</b><span>Waiting for confirmation</span></div>
   <div class="stat"><b>${d.counts.week}</b><span>Next 7 days</span></div><div class="stat"><b>${d.counts.new24}</b><span>New in the last 24 hours</span></div></div>
   ${d.counts.pending ? `<div class="note" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>${d.counts.pending} booking(s) are waiting for you to confirm.</span><button class="btn sm" id="seePending">Review now</button></div>` : ''}
   ${EMAIL_ON ? '' : '<div class="note" style="margin-top:12px">Automatic emails are off, so clients don\'t get email confirmations yet. Use "Copy" in a booking to send by SMS/Viber, or set up email (see Clinic info & settings).</div>'}
   <h3 style="margin:28px 0 12px;font-size:1.5rem">Today's schedule</h3>${bookingTable(d.today.map(fromFull), 'No appointments today.')}`;
  wireOpen(el, () => VIEWS.dashboard(el));
  if ($('#seePending', el)) $('#seePending', el).onclick = () => { Object.assign(BK, { status: 'pending', from: today(), to: '' }); go('bookings'); };
};

VIEWS.bookings = async el => {
  const [cat] = await Promise.all([loadCatalog(), loadPracs()]);
  el.innerHTML = `<div class="toolbar"><input type="search" id="fq" class="grow" placeholder="Search name, code, phone or email" value="${esc(BK.q)}">
    <select id="fs"><option value="">All statuses</option>${STATUSES.map(s => `<option value="${s}" ${BK.status === s ? 'selected' : ''}>${stLabel(s)}</option>`).join('')}</select>
    <select id="fp"><option value="">All specialists</option>${PRACS.map(p => `<option value="${p.id}" ${String(BK.prac) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
   <div class="toolbar"><label class="mini">From <input type="date" id="ff" value="${BK.from}"></label><label class="mini">To <input type="date" id="ft" value="${BK.to}"></label>
    <select id="fr"><option value="">All services</option><option value="consult" ${BK.treatment === 'consult' ? 'selected' : ''}>Consultation</option>${cat.categories.map(c => `<optgroup label="${esc(c.name)}">${cat.treatments.filter(x => x.category_id === c.id).map(x => `<option value="${x.id}" ${String(BK.treatment) === String(x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>
    <select id="fo"><option value="date">By appointment date</option><option value="newest" ${BK.sort === 'newest' ? 'selected' : ''}>Newest bookings first</option></select>
    <button class="btn sm line" id="fclear">Reset</button><button class="btn sm line" id="csv">Export CSV</button></div><div id="list"><div class="spin"></div></div>`;
  const load = async () => {
    const q = new URLSearchParams(Object.entries(BK).filter(([, v]) => v)).toString();
    const { bookings } = await run(() => api('/bookings?' + q));
    $('#list', el).innerHTML = `<p class="mini" style="margin-bottom:8px">${bookings.length} booking(s)${bookings.length === 500 ? ' – showing the first 500, narrow your filters' : ''}</p>` + bookingTable(bookings, 'No bookings match these filters.');
    wireOpen(el, load);
  };
  const bind = (id, k) => { $('#' + id, el).onchange = e => { BK[k] = e.target.value; load(); }; };
  bind('ff', 'from'); bind('ft', 'to'); bind('fs', 'status'); bind('fp', 'prac'); bind('fr', 'treatment'); bind('fo', 'sort');
  let tm; $('#fq', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { BK.q = e.target.value; load(); }, 300); };
  $('#fclear', el).onclick = () => { Object.assign(BK, { from: today(), to: '', status: '', prac: '', treatment: '', q: '', sort: 'date' }); VIEWS.bookings(el); };
  $('#csv', el).onclick = () => { location.href = `/api/admin/export.csv?from=${BK.from || addDays(today(), -365)}&to=${BK.to || addDays(today(), 365)}`; };
  load();
};

VIEWS.calendar = async el => {
  const y = CAL.getFullYear(), m = CAL.getMonth();
  el.innerHTML = `<div class="toolbar" style="justify-content:space-between"><button class="icon-btn" id="cp" aria-label="Previous month">${ic('chevL')}</button><b style="font:500 1.6rem var(--serif)">${CAL.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</b><button class="icon-btn" id="cn" aria-label="Next month">${ic('chevR')}</button></div><div id="cg"><div class="spin"></div></div><div id="cday"></div>`;
  $('#cp', el).onclick = () => { CAL = new Date(y, m - 1, 1); VIEWS.calendar(el); };
  $('#cn', el).onclick = () => { CAL = new Date(y, m + 1, 1); VIEWS.calendar(el); };
  const { days } = await run(() => api(`/calendar?year=${y}&month=${m + 1}`));
  const first = new Date(y, m, 1).getDay(), dn = new Date(y, m + 1, 0).getDate();
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= dn; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`, x = days[ds] || {};
    cells += `<button class="mcell ${ds === today() ? 'today' : ''}" data-d="${ds}"><span>${d}</span>${x.total ? `<b>${x.total} appt</b>` : ''}${x.pending ? `<span class="p">${x.pending} pending</span>` : ''}${x.blocks ? '<span class="x">blocked</span>' : ''}</button>`;
  }
  $('#cg', el).innerHTML = `<div class="calgrid">${cells}</div>`;
  const showDay = async ds => {
    const { bookings } = await run(() => api(`/bookings?from=${ds}&to=${ds}`));
    $('#cday', el).innerHTML = `<h3 style="margin:24px 0 10px;font-size:1.5rem">${fmtDate(ds)}</h3>` + bookingTable(bookings, 'No bookings on this day.');
    wireOpen($('#cday', el), () => showDay(ds)); $('#cday', el).scrollIntoView({ behavior: 'smooth' });
  };
  $$('.mcell', el).forEach(c => c.onclick = () => showDay(c.dataset.d));
};

VIEWS.new = async el => {
  const [cat] = await Promise.all([loadCatalog(), loadPracs(), loadSettings()]);
  const consult = SETTINGS.booking.consult;
  el.innerHTML = `<p class="sub">For phone, walk-in and Messenger bookings.</p>
   <div class="box"><h3>1 · Service</h3>
    <label class="opt"><input type="radio" name="nt" value="consult"><span><b>${esc(consult.label)}</b></span></label>
    <label class="opt"><input type="radio" name="nt" value="treatment" checked><span><b>Treatment(s)</b></span></label>
    <div class="toolbar" style="margin-top:8px"><input type="search" id="ntq" class="grow" placeholder="Search treatments"></div>
    <div id="ntp">${cat.categories.map(c => `<details class="cat-group"><summary>${esc(c.name)}</summary><div class="inner">${cat.treatments.filter(x => x.category_id === c.id && x.active).map(x => `<label class="opt" data-name="${esc(x.name.toLowerCase())}"><input type="checkbox" value="${x.id}"><span><b>${esc(x.name)}</b></span><span class="right">${peso(x.price)}</span></label>`).join('')}</div></details>`).join('')}</div></div>
   <div class="box"><h3>2 · Client</h3><form id="nf">${clientFields()}
    <div class="row2"><div><label class="f">How they booked</label><select id="n_src"><option value="phone">Phone</option><option value="walk-in">Walk-in</option><option value="messenger">Messenger / Viber</option><option value="admin">Other</option></select></div>
    <div><label class="f">Status</label><select id="n_st"><option value="confirmed">Confirmed</option><option value="pending">Pending</option></select></div></div>
    <label class="f">Staff notes</label><textarea id="n_notes"></textarea>
    <label class="chk"><input type="checkbox" id="n_notify" ${EMAIL_ON ? '' : 'disabled'}><span>Email a confirmation to the client ${EMAIL_ON ? '' : '(email not set up yet)'}</span></label></form></div>
   <div class="box"><h3>3 · Date &amp; time</h3><div id="nslot"></div></div>`;
  $$('input[name=nt]', el).forEach(r => r.onchange = () => { const t = $('input[name=nt]:checked', el).value; $('#ntp', el).classList.toggle('hide', t === 'consult'); $('#ntq', el).classList.toggle('hide', t === 'consult'); });
  $('#ntq', el).oninput = e => { const q = e.target.value.toLowerCase(); $$('#ntp .opt', el).forEach(o => o.classList.toggle('hide', !!q && !o.dataset.name.includes(q))); $$('#ntp details', el).forEach(dd => { dd.open = !!q && $$('.opt:not(.hide)', dd).length > 0; dd.classList.toggle('hide', !!q && !$$('.opt:not(.hide)', dd).length); }); };
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
  el.innerHTML = `<p class="sub">Holidays, trainings, lunch breaks or a staff day off. Blocked times can't be booked online.</p>
   <div class="box"><div class="row3"><div><label class="f" style="margin-top:0">Date</label><input type="date" id="bd" min="${today()}"></div>
    <div><label class="f" style="margin-top:0">Who</label><select id="bp"><option value="">Whole clinic</option>${PRACS.map(p => `<option value="${p.id}">${esc(p.name)} only</option>`).join('')}</select></div>
    <div><label class="f" style="margin-top:0">Repeat</label><select id="br"><option value="1">Just this day</option><option value="7">For 7 days</option><option value="14">For 14 days</option><option value="30">For 30 days</option></select></div></div>
    <label class="chk"><input type="checkbox" id="bw" checked><span>Whole day</span></label>
    <div id="bt" class="row2 hide"><div><label class="f" style="margin-top:0">From</label><input type="time" id="bf" value="12:00"></div><div><label class="f" style="margin-top:0">To</label><input type="time" id="bto" value="13:00"></div></div>
    <label class="f">Reason</label><input type="text" id="bn" placeholder="e.g. Holiday, staff training"><div class="nav-row"><span></span><button class="btn" id="badd">Add block</button></div></div>
   <h3 style="margin:26px 0 10px;font-size:1.5rem">Upcoming</h3><div id="bl"><div class="spin"></div></div>`;
  $('#bw', el).onchange = e => $('#bt', el).classList.toggle('hide', e.target.checked);
  const load = async () => {
    const { blocks } = await run(() => api('/blocks'));
    $('#bl', el).innerHTML = blocks.length ? `<div class="box tw" style="padding:4px 8px"><table class="t"><thead><tr><th>Date</th><th>Time</th><th>Who</th><th>Reason</th><th></th></tr></thead><tbody>${blocks.map(b => `<tr><td>${fmtDate(b.date)}</td><td>${b.from_min <= 0 && b.to_min >= 1440 ? 'Whole day' : fmtTime(b.from_min) + ' – ' + fmtTime(b.to_min)}</td><td>${esc(b.practitioner_name || 'Whole clinic')}</td><td>${esc(b.note)}</td><td style="text-align:right"><button class="btn sm line" data-rm="${b.id}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="box empty">No blocked dates coming up.</div>';
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

/* ---- results: pick a treatment, then add photos ---- */
VIEWS.gallery = async el => {
  const [cat, gal] = await Promise.all([loadCatalog(true), run(() => api('/gallery'))]);
  const items = gal.items, count = id => items.filter(g => g.treatment_id === id).length;
  const unlinked = items.filter(g => !g.treatment_id);
  if (GSEL == null) GSEL = (cat.treatments.find(t => count(t.id)) || cat.treatments[0] || {}).id ?? 'other';
  el.innerHTML = `<p class="sub">Choose a treatment, then add its before &amp; after photos. They appear on the website's Results page, grouped by treatment.</p>
   <div class="pane"><div class="list"><div style="padding:6px"><input type="search" id="gq" placeholder="Find a treatment"></div><div id="glist"></div></div><div id="gmain"></div></div>`;
  const drawList = q => {
    $('#glist', el).innerHTML = cat.categories.map(c => {
      const ts = cat.treatments.filter(t => t.category_id === c.id && (!q || t.name.toLowerCase().includes(q)));
      return ts.length ? `<div class="cat-lbl">${esc(c.name)}</div>` + ts.map(t => `<button class="li ind ${GSEL === t.id ? 'on' : ''}" data-g="${t.id}">${esc(t.name)}${count(t.id) ? `<span class="n">${count(t.id)}</span>` : ''}</button>`).join('') : '';
    }).join('') + (unlinked.length ? `<div class="cat-lbl">Other</div><button class="li ind ${GSEL === 'other' ? 'on' : ''}" data-g="other">Not linked to a treatment<span class="n">${unlinked.length}</span></button>` : '');
    $$('[data-g]', el).forEach(b => b.onclick = () => { GSEL = b.dataset.g === 'other' ? 'other' : Number(b.dataset.g); drawList(q); drawMain(); if (innerWidth < 960) $('#gmain', el).scrollIntoView({ behavior: 'smooth' }); });
  };
  const drawMain = () => {
    const t = cat.treatments.find(x => x.id === GSEL), list = GSEL === 'other' ? unlinked : items.filter(g => g.treatment_id === GSEL);
    $('#gmain', el).innerHTML = `<div class="box"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><p class="eyebrow">${esc(t ? (cat.categories.find(c => c.id === t.category_id) || {}).name : 'Other')}</p><h3 style="font-size:1.8rem">${esc(t ? t.name : 'Not linked to a treatment')}</h3><p class="mini">${list.length} result(s)</p></div>${t ? '<button class="btn" id="gadd">' + ic('plus') + 'Add before &amp; after</button>' : ''}</div></div>
      <div class="rgrid" style="margin-top:14px">${list.map(g => `<div class="rcard"><div class="pair"><img src="${g.before}" alt="before"><img src="${g.after}" alt="after"></div>
        <div class="meta">${g.published ? '<span class="pill2">On website</span>' : '<span class="pill2 off">Hidden</span>'}<p style="margin-top:6px">${esc([g.sessions, g.caption].filter(Boolean).join(' · ') || g.title)}</p>
        <div class="toolbar" style="margin:10px 0 0"><button class="btn sm line" data-ed="${g.id}">Edit</button><button class="btn sm line" data-tg="${g.id}">${g.published ? 'Hide' : 'Show'}</button></div></div></div>`).join('') || `<div class="box empty" style="grid-column:1/-1">No photos for this treatment yet.</div>`}</div>`;
    if ($('#gadd', el)) $('#gadd', el).onclick = () => editResult(null, t);
    $$('[data-tg]', el).forEach(x => x.onclick = async () => { const g = items.find(i => i.id == x.dataset.tg); const fd = new FormData(); fd.append('published', !g.published); await run(() => api('/gallery/' + g.id, { method: 'PATCH', form: fd }), 'Updated'); VIEWS.gallery(el); });
    $$('[data-ed]', el).forEach(x => x.onclick = () => editResult(items.find(i => i.id == x.dataset.ed), t));
  };
  const editResult = (g, t) => {
    const d = drawer(g ? 'Edit result' : `Add result – ${t.name}`, `<div class="row2" style="gap:12px">${dropTile('r_b', 'Before', g?.before)}${dropTile('r_a', 'After', g?.after)}</div>
      ${g ? `<label class="f">Treatment</label><select id="r_t"><option value="">— Not linked —</option>${cat.categories.map(c => `<optgroup label="${esc(c.name)}">${cat.treatments.filter(x => x.category_id === c.id).map(x => `<option value="${x.id}" ${g.treatment_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select>` : ''}
      <div class="row2"><div><label class="f">Sessions <span class="mini">(optional)</span></label><input type="text" id="r_s" placeholder="e.g. After 4 sessions" value="${esc(g?.sessions || '')}"></div>
      <div><label class="f">Order <span class="mini">(lower shows first)</span></label><input type="number" id="r_o" value="${g?.sort || 0}"></div></div>
      <label class="f">Short note <span class="mini">(optional)</span></label><input type="text" id="r_c" maxlength="500" placeholder="e.g. Combined with a home-care routine" value="${esc(g?.caption || '')}">
      ${g ? '' : `<label class="chk"><input type="checkbox" id="r_consent"><span>The client gave <b>written consent</b> to publish these photos. *</span></label>`}
      <label class="chk"><input type="checkbox" id="r_pub" ${!g || g.published ? 'checked' : ''}><span>Show on website</span></label>
      <div class="nav-row">${g ? '<button class="btn sm danger" id="r_del">Delete</button>' : '<span></span>'}<button class="btn" id="r_go">${g ? 'Save' : 'Upload'}</button></div>`);
    wireDrops(d.el);
    $('#r_go', d.el).onclick = async () => {
      const fd = new FormData();
      if (g) fd.append('treatment_id', fv(d.el, 'r_t') || ''); else { fd.append('treatment_id', t.id); fd.append('consent', fv(d.el, 'r_consent')); }
      fd.append('sessions', fv(d.el, 'r_s')); fd.append('caption', fv(d.el, 'r_c')); fd.append('sort', fv(d.el, 'r_o') || 0); fd.append('published', fv(d.el, 'r_pub'));
      if ($('#r_b', d.el).files[0]) fd.append('before', $('#r_b', d.el).files[0]);
      if ($('#r_a', d.el).files[0]) fd.append('after', $('#r_a', d.el).files[0]);
      const btn = $('#r_go', d.el); btn.disabled = true; btn.textContent = 'Uploading…';
      try { await run(() => api('/gallery' + (g ? '/' + g.id : ''), { method: g ? 'PATCH' : 'POST', form: fd }), g ? 'Saved' : 'Photos added'); d.close(); VIEWS.gallery(el); }
      catch { btn.disabled = false; btn.textContent = g ? 'Save' : 'Upload'; }
    };
    if (g) $('#r_del', d.el).onclick = async () => { if (!confirm('Delete these photos?')) return; await run(() => api('/gallery/' + g.id, { method: 'DELETE' }), 'Deleted'); d.close(); VIEWS.gallery(el); };
  };
  $('#gq', el).oninput = e => drawList(e.target.value.trim().toLowerCase());
  drawList(''); drawMain();
};

/* ---- treatments: one category at a time + search ---- */
VIEWS.treatments = async el => {
  const cat = await loadCatalog(true);
  if (TSEL == null || (TSEL !== 'all' && !cat.categories.some(c => c.id === TSEL))) TSEL = cat.categories[0]?.id ?? 'all';
  el.innerHTML = `<p class="sub">Prices update on the website immediately. Session length is only used for scheduling – clients don't see it.</p>
   <div class="pane"><div class="list hscroll" id="clist"></div><div><div class="toolbar"><input type="search" id="tq" class="grow" placeholder="Search all treatments"><button class="btn" id="addT">${ic('plus')}Add treatment</button></div><div id="tmain"></div></div></div>`;
  const drawList = () => {
    $('#clist', el).innerHTML = `<button class="li ${TSEL === 'all' ? 'on' : ''}" data-c="all">All treatments<span class="n">${cat.treatments.length}</span></button>` +
      cat.categories.map(c => `<button class="li ${TSEL === c.id ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}${c.active ? '' : ' (hidden)'}<span class="n">${cat.treatments.filter(t => t.category_id === c.id).length}</span></button>`).join('') +
      `<button class="li" id="addC" style="color:var(--gold-ink)">${ic('plus')} New category</button>`;
    $$('[data-c]', el).forEach(b => b.onclick = () => { TSEL = b.dataset.c === 'all' ? 'all' : Number(b.dataset.c); $('#tq', el).value = ''; drawList(); drawMain(); });
    $('#addC', el).onclick = () => editC();
  };
  const drawMain = () => {
    const q = $('#tq', el).value.trim().toLowerCase();
    const c = cat.categories.find(x => x.id === TSEL);
    const rows = cat.treatments.filter(t => (q ? t.name.toLowerCase().includes(q) : TSEL === 'all' || t.category_id === TSEL));
    const catName = id => (cat.categories.find(x => x.id === id) || {}).name || '';
    $('#tmain', el).innerHTML = `${c && !q ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h3 style="font-size:1.6rem">${esc(c.name)} ${c.active ? '' : '<span class="pill2 off">Hidden</span>'}</h3><button class="btn sm line" id="editCat">Edit category</button></div>` : ''}
     ${rows.length ? `<div class="box tw" style="padding:4px 8px"><table class="t"><thead><tr><th>Treatment</th><th style="width:130px">Price (₱)</th><th>Home page</th><th>On website</th><th></th></tr></thead><tbody>
     ${rows.map(x => `<tr><td><b>${esc(x.name)}</b>${q || TSEL === 'all' ? `<br><span class="mini">${esc(catName(x.category_id))}</span>` : ''}</td>
       <td><input type="number" min="0" step="10" value="${x.price}" data-id="${x.id}" data-k="price" aria-label="Price of ${esc(x.name)}"></td>
       <td><label class="toggle"><input type="checkbox" ${x.featured ? 'checked' : ''} data-id="${x.id}" data-k="featured" aria-label="Show on home page"><span></span></label></td>
       <td><label class="toggle"><input type="checkbox" ${x.active ? 'checked' : ''} data-id="${x.id}" data-k="active" aria-label="Show on website"><span></span></label></td>
       <td style="text-align:right"><button class="btn sm line" data-et="${x.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="box empty">No treatments here yet.</div>'}`;
    $$('[data-k]', el).forEach(i => i.onchange = async () => {
      const v = i.type === 'checkbox' ? i.checked : Number(i.value);
      try { const r = await api('/treatments/' + i.dataset.id, { method: 'PATCH', body: { [i.dataset.k]: v } }); Object.assign(cat.treatments.find(t => t.id == i.dataset.id), r.treatment); CATALOG = null; toast('Saved'); }
      catch (e) { toast(e.message, true); drawMain(); }
    });
    $$('[data-et]', el).forEach(b => b.onclick = () => editT(cat.treatments.find(x => x.id == b.dataset.et)));
    if ($('#editCat', el)) $('#editCat', el).onclick = () => editC(c);
  };
  const reload = async () => { Object.assign(cat, await loadCatalog(true)); drawList(); drawMain(); };
  const editT = x => {
    x = x || { category_id: TSEL === 'all' ? cat.categories[0]?.id : TSEL, name: '', description: '', duration_min: 60, price: 0, featured: false, active: true, sort: 0 };
    const d = drawer(x.id ? 'Edit treatment' : 'Add treatment', `<label class="f" style="margin-top:0">Category</label><select id="t_c">${cat.categories.map(c => `<option value="${c.id}" ${c.id === x.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label class="f">Name *</label><input type="text" id="t_n" value="${esc(x.name)}" maxlength="160"><label class="f">Short description</label><textarea id="t_d" maxlength="1000">${esc(x.description)}</textarea>
      <div class="row3"><div><label class="f">Price ₱ *</label><input type="number" id="t_p" value="${x.price}" min="0"></div><div><label class="f">Session length (min) *</label><input type="number" id="t_m" value="${x.duration_min}" min="5" step="5"></div><div><label class="f">Order</label><input type="number" id="t_s" value="${x.sort}"></div></div>
      <p class="mini" style="margin-top:6px">Session length blocks the specialist's calendar when someone books. Clients don't see it.</p>
      <label class="chk"><input type="checkbox" id="t_f" ${x.featured ? 'checked' : ''}><span>Show on the home page (signature treatments)</span></label><label class="chk"><input type="checkbox" id="t_a" ${x.active ? 'checked' : ''}><span>Show on website &amp; allow booking</span></label>
      <div class="nav-row">${x.id ? '<button class="btn sm danger" id="t_del">Delete</button>' : '<span></span>'}<button class="btn" id="t_go">Save</button></div>`);
    $('#t_go', d.el).onclick = async () => {
      const body = { category_id: Number(fv(d.el, 't_c')), name: fv(d.el, 't_n'), description: fv(d.el, 't_d'), duration_min: Number(fv(d.el, 't_m')), price: Number(fv(d.el, 't_p')), sort: Number(fv(d.el, 't_s')), featured: fv(d.el, 't_f'), active: fv(d.el, 't_a') };
      await run(() => api('/treatments' + (x.id ? '/' + x.id : ''), { method: x.id ? 'PATCH' : 'POST', body }), 'Saved'); d.close(); reload();
    };
    if (x.id) $('#t_del', d.el).onclick = async () => { if (!confirm(`Delete "${x.name}"? Past bookings keep their record. Tip: switch off "On website" to just hide it.`)) return; await run(() => api('/treatments/' + x.id, { method: 'DELETE' }), 'Deleted'); d.close(); reload(); };
  };
  const editC = c => {
    c = c || { name: '', sort: (cat.categories.length + 1) * 10, active: true };
    const d = drawer(c.id ? 'Edit category' : 'New category', `<label class="f" style="margin-top:0">Name *</label><input type="text" id="c_n" value="${esc(c.name)}"><label class="f">Order</label><input type="number" id="c_s" value="${c.sort}">
      <label class="chk"><input type="checkbox" id="c_a" ${c.active ? 'checked' : ''}><span>Show on website</span></label><div class="nav-row">${c.id ? '<button class="btn sm danger" id="c_del">Delete</button>' : '<span></span>'}<button class="btn" id="c_go">Save</button></div>`);
    $('#c_go', d.el).onclick = async () => { const r = await run(() => api('/categories' + (c.id ? '/' + c.id : ''), { method: c.id ? 'PATCH' : 'POST', body: { name: fv(d.el, 'c_n'), sort: Number(fv(d.el, 'c_s')), active: fv(d.el, 'c_a') } }), 'Saved'); d.close(); if (!c.id) TSEL = r.category.id; reload(); };
    if (c.id) $('#c_del', d.el).onclick = async () => { if (!confirm('Delete this category?')) return; await run(() => api('/categories/' + c.id, { method: 'DELETE' }), 'Deleted'); d.close(); TSEL = null; VIEWS.treatments(el); };
  };
  let tm; $('#tq', el).oninput = () => { clearTimeout(tm); tm = setTimeout(drawMain, 150); };
  $('#addT', el).onclick = () => editT();
  drawList(); drawMain();
};

VIEWS.team = async el => {
  const list = await loadPracs(true);
  el.innerHTML = `<div class="toolbar" style="justify-content:space-between"><p class="sub" style="margin:0">Shown on the "Our team" page. "Takes bookings" lets clients choose this person.</p><button class="btn" id="addP">${ic('plus')}Add team member</button></div>
   <div class="rgrid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${list.map(p => `<div class="box" style="text-align:center;margin:0">
     <div class="portrait" style="width:96px;height:96px;font-size:2.2rem;margin:0 auto 12px;border-width:4px">${p.photo ? `<img src="${p.photo}" alt="">` : esc(p.name[0])}</div><h3>${esc(p.name)}</h3><p class="eyebrow" style="margin:4px 0 8px">${esc(p.role)}</p>
     <p class="mini">${esc(p.credentials)}</p><p style="margin:10px 0">${p.active ? '<span class="pill2">On website</span>' : '<span class="pill2 off">Hidden</span>'} ${p.bookable ? '<span class="pill2">Takes bookings</span>' : ''}</p>
     <button class="btn sm line" data-ep="${p.id}">Edit</button></div>`).join('')}</div>`;
  const edit = p => {
    p = p || { name: '', role: '', credentials: '', specialties: '', active: true, bookable: true, sort: (list.length + 1) * 10 };
    const d = drawer(p.id ? 'Edit team member' : 'Add team member', `<div style="max-width:200px">${dropTile('p_ph', 'Photo', p.photo)}</div>${p.photo ? '<label class="chk"><input type="checkbox" id="p_rm"><span>Remove photo</span></label>' : ''}
      <label class="f">Name *</label><input type="text" id="p_n" value="${esc(p.name)}"><label class="f">Position</label><input type="text" id="p_r" value="${esc(p.role)}" placeholder="e.g. Aesthetic Therapist">
      <label class="f">Credentials</label><input type="text" id="p_c" value="${esc(p.credentials)}"><label class="f">Specialties <span class="mini">(separate with commas)</span></label><input type="text" id="p_s" value="${esc(p.specialties)}">
      <label class="f">Order</label><input type="number" id="p_o" value="${p.sort}">
      <label class="chk"><input type="checkbox" id="p_a" ${p.active ? 'checked' : ''}><span>Show on website</span></label><label class="chk"><input type="checkbox" id="p_b" ${p.bookable ? 'checked' : ''}><span>Takes bookings</span></label>
      <div class="nav-row">${p.id ? '<button class="btn sm danger" id="p_del">Delete</button>' : '<span></span>'}<button class="btn" id="p_go">Save</button></div>`);
    wireDrops(d.el);
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
    ['promos', 'Packages & promos', 'Shown on the home page.', [['chip', 'Label (e.g. PROMO, PACKAGE)', 'text'], ['title', 'Title *', 'text'], ['body', 'Description', 'textarea']], x => `<b>${esc(x.title)}</b> <span class="mini">${esc(x.chip)}</span><br><span class="mini">${esc(x.body)}</span>`],
    ['testimonials', 'Client reviews', 'Use real reviews from clients (with their permission).', [['quote', 'What they said *', 'textarea'], ['author', 'Name / town', 'text']], x => `“${esc(x.quote)}” <span class="mini">— ${esc(x.author)}</span>`],
    ['faqs', 'FAQ', 'Grouped by topic on the FAQ page.', [['topic', 'Topic (e.g. Booking & visits, Treatments & safety, Aftercare)', 'text'], ['question', 'Question *', 'text'], ['answer', 'Answer *', 'textarea']], x => `<span class="mini">${esc(x.topic)}</span><br><b>${esc(x.question)}</b>`],
  ];
  el.innerHTML = LISTS.map(([k, n, h]) => `<div class="box"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><h3>${n}</h3><p class="mini">${h}</p></div><button class="btn sm" data-add="${k}">${ic('plus')}Add</button></div><div id="l_${k}" style="margin-top:10px"><div class="spin"></div></div></div>`).join('');
  for (const [k, n, , fields, show] of LISTS) {
    const load = async () => {
      const { items } = await run(() => api('/' + k));
      $('#l_' + k, el).innerHTML = items.length ? `<table class="t"><tbody>${items.map(x => `<tr class="click" data-ed="${x.id}"><td>${show(x)}</td><td style="text-align:right;white-space:nowrap">${x.active ? '' : '<span class="pill2 off">Hidden</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="mini">Nothing yet.</p>';
      $$('[data-ed]', $('#l_' + k, el)).forEach(b => b.onclick = () => edit(items.find(i => i.id == b.dataset.ed)));
    };
    const edit = x => {
      x = x || { active: true, sort: 0, topic: k === 'faqs' ? 'Booking & visits' : undefined };
      const d = drawer(`${x.id ? 'Edit' : 'Add'} – ${n}`, `${fields.map(([f, l, t]) => `<label class="f">${l}</label>${t === 'textarea' ? `<textarea id="x_${f}" style="min-height:140px">${esc(x[f])}</textarea>` : `<input type="text" id="x_${f}" value="${esc(x[f])}">`}`).join('')}
        <label class="f">Order (lower shows first)</label><input type="number" id="x_sort" value="${x.sort || 0}"><label class="chk"><input type="checkbox" id="x_active" ${x.active ? 'checked' : ''}><span>Show on website</span></label>
        <div class="nav-row">${x.id ? '<button class="btn sm danger" id="x_del">Delete</button>' : '<span></span>'}<button class="btn" id="x_go">Save</button></div>`);
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
  const inp = (id, label, v, type = 'text', extra = '') => `<label class="f" for="${id}">${label}</label><input type="${type}" id="${id}" value="${esc(v ?? '')}" ${extra}>`;
  const ta = (id, label, v, h = 96) => `<label class="f" for="${id}">${label}</label><textarea id="${id}" style="min-height:${h}px">${esc(v ?? '')}</textarea>`;
  const sw = (id, title, text, on) => `<div class="setting-row"><div><b>${title}</b><p>${text}</p></div><label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${esc(title)}"><span></span></label></div>`;
  const h4 = t => `<h4 style="font:600 .68rem var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:22px 0 0">${t}</h4>`;
  el.innerHTML = `
   <div class="box"><h3>Email</h3>${EMAIL_ON ? `<p class="mini" style="margin-bottom:10px"><span class="pill2">Connected</span> Clients get automatic emails when they book, when you confirm, move or cancel, and a reminder the day before.</p>
      <div class="toolbar"><input type="email" id="te_to" class="grow" placeholder="Send a test to…" value="${esc(ME.email)}"><button class="btn sm" id="te_go">Send test email</button></div>`
    : `<p class="mini"><span class="pill2 off">Not set up</span> To send automatic emails, add <b>BREVO_API_KEY</b> and <b>MAIL_FROM</b> in your hosting settings (Render → Environment) – see the setup guide. Until then, use "Copy" in a booking to send messages by SMS/Viber.</p>`}</div>
   <div class="box"><h3>Booking rules</h3>
    ${sw('b_on', 'Online booking', 'Turn off to pause online bookings (e.g. during a closure).', bk.onlineBookingEnabled)}
    ${sw('b_auto', 'Confirm online bookings automatically', 'On: clients are confirmed straight away and get a confirmation email. Off: bookings stay "pending" until staff review the intake form.', bk.autoConfirm)}
    <div class="row3"><div>${inp('b_oh', 'Opens at (hour, 0–23)', bk.openHour, 'number')}</div><div>${inp('b_ch', 'Closes at (hour, 1–24)', bk.closeHour, 'number')}</div><div>${inp('b_ss', 'Start times every (minutes)', bk.slotStep, 'number')}</div></div>
    <div class="row3"><div>${inp('b_bf', 'Cleaning time after each appointment (min)', bk.buffer, 'number')}</div><div>${inp('b_mn', 'Earliest online booking (minutes from now)', bk.minNoticeMin, 'number')}</div><div>${inp('b_cx', 'Clients can change up to (hours before)', bk.cancelHours, 'number')}</div></div>
    <div class="row3"><div>${inp('b_ad', 'Book up to (days ahead)', bk.maxAdvanceDays, 'number')}</div></div>
    <label class="f">Closed every</label><div class="toolbar">${DAYS.map((d, i) => `<label class="chk" style="margin:0 12px 0 0"><input type="checkbox" class="b_cd" value="${i}" ${bk.closedDays.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
    <div class="row3"><div>${inp('b_cl', 'Consultation name', bk.consult.label)}</div><div>${inp('b_cd', 'Consultation length (min)', bk.consult.duration, 'number')}</div><div>${inp('b_cp', 'Consultation price ₱ (0 = free)', bk.consult.price, 'number')}</div></div>
    ${inp('b_cdesc', 'Consultation description', bk.consult.description)}
    <div class="nav-row"><span></span><button class="btn" id="saveBk">Save booking rules</button></div></div>
   <div class="box"><h3>Home page</h3><div class="row2" style="gap:0 24px"><div><label class="f">Hero photo <span class="mini">(optional – shown in the arch)</span></label><div style="max-width:220px">${dropTile('h_img', 'Hero photo', site.heroImageId ? '/media/' + site.heroImageId : '')}</div>
      <div class="toolbar" style="margin-top:10px"><button class="btn sm" id="h_up">Upload photo</button>${site.heroImageId ? '<button class="btn sm line" id="h_rm">Remove</button>' : ''}</div></div>
      <div>${inp('s_ht', 'Headline', site.heroTitle)}${ta('s_hx', 'Text under the headline', site.heroText)}${inp('s_ti', 'Note under signature treatments', site.topIntro)}</div></div>
    ${h4('Why choose us (3 points)')}
    ${site.badges.map((b, i) => `<div class="row3"><div>${inp('bt' + i, 'Title', b.title)}</div><div style="grid-column:span 2">${inp('bx' + i, 'Text', b.text)}</div></div>`).join('')}
    ${h4('Rewards')}<div class="row2"><div>${inp('l_t', 'Rewards title', site.loyalty.title)}${ta('l_x', 'Rewards text', site.loyalty.text)}</div><div>${inp('l_ct', 'Loyalty card title', site.loyalty.cardTitle)}${ta('l_cx', 'Loyalty card text', site.loyalty.cardText)}</div></div></div>
   <div class="box"><h3>Clinic details</h3><div class="row2"><div>${inp('s_name', 'Clinic name', site.name)}</div><div>${inp('s_city', 'City', site.city)}</div></div>
    <div class="row2"><div>${inp('s_tag', 'Tagline (English)', site.tagline)}</div><div>${inp('s_tagf', 'Tagline (Filipino)', site.taglineFil)}</div></div>
    ${inp('s_addr', 'Address (used for the map and directions)', site.address)}<div class="row2"><div>${inp('s_phone', 'Phone', site.phone)}</div><div>${inp('s_email', 'Email', site.email, 'email')}</div></div>
    ${inp('s_hn', 'Hours note (shown under opening hours)', site.hoursNote)}${inp('s_meta', 'Google search description', site.metaDescription, 'text', 'maxlength="160"')}
    ${inp('s_map', 'Exact map pin (optional) – Google Maps → Share → Embed a map → copy the link inside src="…"', site.mapEmbedUrl, 'url', 'placeholder="Leave empty to place the pin using the address"')}</div>
   <div class="box"><h3>Social & chat</h3><p class="mini">Footer icons only appear for links you fill in.</p><div class="row3"><div>${inp('s_fb', 'Facebook page link', site.social.facebook, 'url', 'placeholder="https://facebook.com/…"')}</div><div>${inp('s_ig', 'Instagram link', site.social.instagram, 'url', 'placeholder="https://instagram.com/…"')}</div><div>${inp('s_tt', 'TikTok link', site.social.tiktok, 'url', 'placeholder="https://tiktok.com/@…"')}</div></div>
    <div class="row3"><div>${inp('s_ms', 'Messenger page username (m.me/____)', site.chat.messenger)}</div><div>${inp('s_vb', 'Viber number (+63…)', site.chat.viber)}</div><div>${inp('s_wa', 'WhatsApp number (63…)', site.chat.whatsapp)}</div></div></div>
   <div class="box"><h3>Page text</h3>${inp('s_tri', 'Treatments page intro', site.treatmentsIntro)}${inp('s_rn', 'Results page note', site.resultsNote)}${inp('s_tmi', 'Team page intro', site.teamIntro)}
    ${ta('s_pre', 'Before-your-visit tips (one per line)', site.preTreatment.join('\n'), 140)}${ta('s_priv', 'Privacy policy', site.privacyText, 200)}
    <div class="nav-row"><span></span><button class="btn" id="saveSite">Save clinic info</button></div></div>
   <div class="box"><h3>Message templates</h3><p class="mini">Placeholders: {name} {code} {service} {specialist} {date} {time} {status} {total} {clinic_phone} {clinic_address} {cancel_hours} {manage_link} {site_link}</p>
    ${s.templates.map((x, i) => `${h4(esc(x.name))}${inp('tp_s' + i, 'Subject', x.subject)}${ta('tp_b' + i, 'Message', x.body, 150)}`).join('')}
    <div class="nav-row"><span></span><button class="btn" id="saveTp">Save templates</button></div></div>`;
  wireDrops(el);
  const v = id => fv(el, id);
  const siteValue = () => ({ ...site, name: v('s_name'), city: v('s_city'), tagline: v('s_tag'), taglineFil: v('s_tagf'), address: v('s_addr'), phone: v('s_phone'), email: v('s_email'),
    hoursNote: v('s_hn'), metaDescription: v('s_meta'), mapEmbedUrl: v('s_map'), heroTitle: v('s_ht'), heroText: v('s_hx'), topIntro: v('s_ti'), treatmentsIntro: v('s_tri'), resultsNote: v('s_rn'), teamIntro: v('s_tmi'),
    social: { facebook: v('s_fb'), instagram: v('s_ig'), tiktok: v('s_tt') }, chat: { whatsapp: v('s_wa'), viber: v('s_vb'), messenger: v('s_ms') },
    badges: site.badges.map((b, i) => ({ icon: b.icon, title: v('bt' + i), text: v('bx' + i) })), loyalty: { title: v('l_t'), text: v('l_x'), cardTitle: v('l_ct'), cardText: v('l_cx') },
    preTreatment: v('s_pre').split('\n').map(x => x.trim()).filter(Boolean), privacyText: v('s_priv') });
  $('#saveSite', el).onclick = () => {
    if (v('s_map') && !/^https:\/\/(www\.)?google\.com\/maps\/embed/.test(v('s_map'))) return toast('The map link must start with https://www.google.com/maps/embed', true);
    run(() => api('/settings/site', { method: 'PUT', body: siteValue() }), 'Clinic info saved');
  };
  $('#saveBk', el).onclick = () => {
    const n = id => Number(fv(el, id));
    run(() => api('/settings/booking', { method: 'PUT', body: { onlineBookingEnabled: fv(el, 'b_on'), autoConfirm: fv(el, 'b_auto'), openHour: n('b_oh'), closeHour: n('b_ch'), slotStep: n('b_ss'), buffer: n('b_bf'), minNoticeMin: n('b_mn'),
      cancelHours: n('b_cx'), maxAdvanceDays: n('b_ad'), closedDays: $$('.b_cd:checked', el).map(x => Number(x.value)), consult: { label: fv(el, 'b_cl'), duration: n('b_cd'), price: n('b_cp'), description: fv(el, 'b_cdesc') } } }), 'Booking rules saved');
  };
  $('#saveTp', el).onclick = () => run(() => api('/settings/templates', { method: 'PUT', body: s.templates.map((x, i) => ({ ...x, subject: fv(el, 'tp_s' + i), body: fv(el, 'tp_b' + i) })) }), 'Templates saved');
  $('#h_up', el).onclick = async () => { const f = $('#h_img', el).files[0]; if (!f) return toast('Choose a photo first', true); const fd = new FormData(); fd.append('photo', f); await run(() => api('/site-image', { method: 'POST', form: fd }), 'Hero photo updated'); VIEWS.site(el); };
  if ($('#h_rm', el)) $('#h_rm', el).onclick = async () => { await run(() => api('/site-image', { method: 'DELETE' }), 'Removed'); VIEWS.site(el); };
  if ($('#te_go', el)) $('#te_go', el).onclick = async () => { const r = await run(() => api('/test-email', { method: 'POST', body: { to: fv(el, 'te_to') } })); toast('Test email sent to ' + r.to + ' – check the inbox (and spam).'); };
};

VIEWS.users = async el => {
  const { users } = await run(() => api('/users'));
  el.innerHTML = `<div class="toolbar" style="justify-content:space-between"><p class="sub" style="margin:0"><b>Staff</b> handle bookings, blocked times and results photos. <b>Admins</b> can also change prices, website text, settings and accounts.</p><button class="btn" id="addU">${ic('plus')}Add account</button></div>
   <div class="box tw" style="padding:4px 8px"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th></tr></thead><tbody>
   ${users.map(u => `<tr class="click" data-eu="${u.id}"><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td style="text-transform:capitalize">${u.role}</td><td>${u.active ? '<span class="pill2">Active</span>' : '<span class="pill2 off">Disabled</span>'}</td><td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-PH') : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  const edit = u => {
    u = u || { name: '', email: '', role: 'staff', active: true };
    const d = drawer(u.id ? 'Edit account' : 'Add account', `<label class="f" style="margin-top:0">Name *</label><input type="text" id="u_n" value="${esc(u.name)}">
      <label class="f">Email *</label><input type="email" id="u_e" value="${esc(u.email)}" ${u.id ? 'disabled' : ''}>
      <label class="f">Role</label><select id="u_r"><option value="staff">Staff</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select>
      <label class="f">${u.id ? 'New password (leave blank to keep)' : 'Password *'} <span class="mini">10+ characters, letters and numbers</span></label><input type="password" id="u_p" autocomplete="new-password">
      ${u.id ? `<label class="chk"><input type="checkbox" id="u_a" ${u.active ? 'checked' : ''}><span>Account active (untick when someone leaves)</span></label>` : ''}
      <div class="nav-row">${u.id && u.id !== ME.id ? '<button class="btn sm danger" id="u_del">Delete</button>' : '<span></span>'}<button class="btn" id="u_go">Save</button></div>`);
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
  el.innerHTML = `<p class="sub">The last 300 changes made in the dashboard.</p><div class="box tw" style="padding:4px 8px"><table class="t"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th></tr></thead><tbody>
   ${entries.map(a => `<tr><td style="white-space:nowrap">${new Date(a.at).toLocaleString('en-PH')}</td><td>${esc(a.user_name)}</td><td>${esc(a.action)}</td><td>${esc(a.entity || '')} ${esc(a.entity_id || '')}<br><span class="mini">${esc(a.details ? JSON.stringify(a.details) : '')}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing yet.</td></tr>'}</tbody></table></div>`;
};

VIEWS.account = el => {
  el.innerHTML = `<div class="box" style="max-width:480px"><h3>Change your password</h3><label class="f">Current password</label><input type="password" id="pw0" autocomplete="current-password">
   <label class="f">New password <span class="mini">10+ characters, letters and numbers</span></label><input type="password" id="pw1" autocomplete="new-password">
   <label class="f">Repeat new password</label><input type="password" id="pw2" autocomplete="new-password"><div class="nav-row"><span></span><button class="btn" id="pwgo">Change password</button></div></div>`;
  $('#pwgo', el).onclick = async () => {
    if (fv(el, 'pw1') !== fv(el, 'pw2')) return toast('New passwords do not match', true);
    await run(() => api('/me/password', { method: 'POST', body: { current: fv(el, 'pw0'), password: fv(el, 'pw1') } }), 'Password changed');
    $$('input', el).forEach(i => { i.value = ''; });
  };
};

boot();
})();

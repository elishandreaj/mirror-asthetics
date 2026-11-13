/* Mirror Aesthetics – customer site. All content and availability come from the server (/api). */
(() => {
'use strict';

/* ---------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fmtTime = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + pad(mm) + ' ' + (h < 12 ? 'AM' : 'PM'); };
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const peso = n => '₱' + Number(n).toLocaleString('en-PH');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(m) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3200); }

async function api(path, body, isForm) {
  const opts = body === undefined ? {} : { method: 'POST', body: isForm ? body : JSON.stringify(body), headers: isForm ? {} : { 'Content-Type': 'application/json' } };
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw Object.assign(new Error('No internet connection. Please check your connection and try again.'), { status: 0 }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, fields: data.fields });
  return data;
}

/* ---------------------------------------------------------------- data from server */
let S = null;                 // full site payload
let TREAT = {};               // id -> treatment
let PRACS = [];
const getT = id => TREAT[id];

/* ---------------------------------------------------------------- language */
const I18N = {
  en: { nav_home: 'Home', nav_treat: 'Treatments', nav_results: 'Results', nav_team: 'Team', nav_faq: 'FAQ', nav_contact: 'Contact', nav_manage: 'Manage booking', nav_book: 'Book now',
    cta: 'Book a Consultation', h_top: 'Our most-loved treatments', see_all: 'See all treatments', h_pack: 'Packages & promos', bookthis: 'Book this', next: 'Continue', back: 'Back' },
  fil: { nav_home: 'Home', nav_treat: 'Mga Treatment', nav_results: 'Resulta', nav_team: 'Koponan', nav_faq: 'Mga Tanong', nav_contact: 'Makipag-ugnayan', nav_manage: 'I-manage ang booking', nav_book: 'Mag-book',
    cta: 'Mag-book ng Konsultasyon', h_top: 'Mga paboritong treatment', see_all: 'Tingnan lahat', h_pack: 'Mga package at promo', bookthis: 'I-book ito', next: 'Magpatuloy', back: 'Bumalik' },
};
let LANG = 'en';
try { LANG = localStorage.getItem('ma_lang') === 'fil' ? 'fil' : 'en'; } catch {}
const t = k => I18N[LANG][k] || I18N.en[k] || k;
function applyLang() {
  $$('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.documentElement.lang = LANG === 'en' ? 'en' : 'fil';
  $('#langBtn').textContent = LANG === 'en' ? 'EN | FIL' : 'FIL | EN';
  if (S) { $('#tagline').textContent = LANG === 'fil' && S.site.taglineFil ? S.site.taglineFil : S.site.tagline; renderTreatments(); renderTop(); if (curPage() === 'book') renderBook(); }
}
$('#langBtn').onclick = () => { LANG = LANG === 'en' ? 'fil' : 'en'; try { localStorage.setItem('ma_lang', LANG); } catch {} applyLang(); };

/* ---------------------------------------------------------------- static content */
function bindContent() {
  const site = S.site;
  const val = path => path.split('.').reduce((o, k) => (o ? o[k] : ''), site) ?? '';
  $$('[data-bind]').forEach(e => { e.textContent = val(e.dataset.bind); });
  const parts = site.name.split(' '); const last = parts.pop();
  $('#logo').innerHTML = esc(parts.join(' ')) + (parts.length ? ' ' : '') + '<span>' + esc(last) + '</span>';
  document.title = `${site.name} – ${site.tagline}`;
  $('meta[name=description]').setAttribute('content', site.metaDescription || '');
  const tel = site.phone.replace(/\D/g, '').replace(/^0/, '+63');
  $('#telLink').href = 'tel:' + tel; $('#telLink').textContent = site.phone;
  $('#mailLink').href = 'mailto:' + site.email; $('#mailLink').textContent = site.email;
  $('#cxHrs').textContent = S.booking.cancelHours;
  $('#yr').textContent = new Date().getFullYear();
  if (site.mapEmbedUrl && /^https:\/\/(www\.)?google\.com\/maps\/embed/.test(site.mapEmbedUrl))
    $('#mapBox').innerHTML = `<iframe class="map" src="${esc(site.mapEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map to ${esc(site.name)}" allowfullscreen></iframe>`;
  const soc = [['Facebook', site.social.facebook], ['Instagram', site.social.instagram], ['TikTok', site.social.tiktok]].filter(x => x[1]);
  $('#social').innerHTML = soc.length ? soc.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join(' · ') : 'Coming soon';
  const ch = site.chat || {}, items = [];
  if (ch.whatsapp) items.push(`<a style="background:#1f7a4d" href="https://wa.me/${esc(ch.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (ch.viber) items.push(`<a style="background:#6b4fb3" href="viber://chat?number=${encodeURIComponent(ch.viber)}">Viber</a>`);
  if (ch.messenger) items.push(`<a style="background:#2468d8" href="https://m.me/${esc(ch.messenger)}" target="_blank" rel="noopener">Messenger</a>`);
  items.push(`<a style="background:var(--green)" href="tel:${tel}">Call us</a>`);
  $('#chatItems').innerHTML = items.join('');
  $('#badges').innerHTML = (site.badges || []).map(b => `<div class="badge"><i>${esc(b.icon)}</i><div><b>${esc(b.title)}</b><br><small>${esc(b.text)}</small></div></div>`).join('');
  $('#promos').innerHTML = S.promos.map(p => `<div class="card fade">${p.chip ? `<span class="chip">${esc(p.chip)}</span>` : ''}<h3 style="margin-top:8px">${esc(p.title)}</h3><p class="lead" style="margin:6px 0 14px">${esc(p.body)}</p><a class="btn sm" href="#book">Book</a></div>`).join('');
  $('#promoBlock').classList.toggle('hide', !S.promos.length);
  $('#testimonials').innerHTML = S.testimonials.map(x => `<div class="card"><blockquote>“${esc(x.quote)}”</blockquote><p class="eyebrow" style="margin-top:8px">— ${esc(x.author)}</p></div>`).join('');
  $('#testiBlock').classList.toggle('hide', !S.testimonials.length);
  $('#faqs').innerHTML = S.faqs.map(f => `<details><summary>${esc(f.question)}</summary><p class="pre-line">${esc(f.answer)}</p></details>`).join('');
  $('#gallery').innerHTML = S.gallery.length ? S.gallery.map(g => `<div class="fade"><div class="ba">
      <figure><img src="${g.before}" alt="Before – ${esc(g.title)}" loading="lazy"><figcaption>Before</figcaption></figure>
      <figure><img src="${g.after}" alt="After – ${esc(g.title)}" loading="lazy"><figcaption>After</figcaption></figure></div>
      <p class="gcap"><b>${esc(g.title)}</b>${g.treatment ? `<small>${esc(g.treatment)}</small>` : ''}${g.caption ? `<small>${esc(g.caption)}</small>` : ''}</p></div>`).join('')
    : '<p class="lead">Photos of real client results are coming soon.</p>';
  $('#teamList').innerHTML = S.practitioners.map(p => `<div class="card fade"><div class="avatar">${p.photo ? `<img src="${p.photo}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name[0])}</div>
      <h3>${esc(p.name)}</h3><p class="eyebrow">${esc(p.role)}</p>${p.credentials ? `<p style="margin-top:6px">🎓 ${esc(p.credentials)}</p>` : ''}${p.specialties ? `<p>✨ ${esc(p.specialties)}</p>` : ''}</div>`).join('');
  if (!S.booking.onlineBookingEnabled) { $('#banner').textContent = `Online booking is paused right now. Please call ${site.phone} or message us to book.`; $('#banner').classList.remove('hide'); }
}

function tCard(tr) {
  return `<div class="card tcard fade"><h3>${esc(tr.name)}</h3><p>${esc(tr.description)}</p>
   <div class="row"><div><span class="price">${tr.price ? 'Starting at ' + peso(tr.price) : 'Free'}</span><br><small>⏱ ${tr.duration_min} min</small></div>
   <a class="btn sm" href="#book" data-book="${tr.id}">${t('bookthis')}</a></div></div>`;
}
function renderTreatments() {
  $('#treatList').innerHTML = S.categories.map(c => `<div class="cat"><h2>${esc(c.name)}</h2><div class="grid g3">${c.treatments.map(tCard).join('')}</div></div>`).join('');
}
function renderTop() {
  const all = S.categories.flatMap(c => c.treatments);
  const top = all.filter(x => x.featured); $('#topTreat').innerHTML = (top.length ? top : all.slice(0, 3)).slice(0, 6).map(tCard).join('');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-book]'); if (b) { resetBooking(); B.type = 'treatment'; B.sel = [Number(b.dataset.book)]; B.step = 2; } });

/* ---------------------------------------------------------------- router */
const curPage = () => { const h = (location.hash || '#home').slice(1).split('?')[0]; return $('#p-' + h) ? h : 'home'; };
function route() {
  if (!S) return;
  const id = curPage();
  $$('.page').forEach(p => p.classList.toggle('show', p.id === 'p-' + id));
  $$('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
  if (id === 'book') renderBook();
  if (id === 'manage') renderManage();
  setTimeout(observe, 50);
}
window.addEventListener('hashchange', route);
$('#menuBtn').onclick = e => { const o = $('#nav').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); };
$('#chatBtn').onclick = () => $('#chat').classList.toggle('open');
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 }) : null;
function observe() { $$('.fade:not(.in)').forEach(e => (io ? io.observe(e) : e.classList.add('in'))); }

/* ---------------------------------------------------------------- booking flow */
// Steps: 1 Service · 2 Specialist · 3 Date · 4 Time · 5 Details · 6 Confirm
const STEPS = ['Service', 'Specialist', 'Date', 'Time', 'Details', 'Confirm'];
let B, calMonth, busy = false;
const monthCache = {};
function resetBooking() {
  B = { type: 'treatment', sel: [], prac: 'any', date: null, time: null, step: 1, form: {}, photo: null, done: null, resched: null, slots: null };
  const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1);
}
resetBooking();
const bookDuration = () => (B.resched ? B.resched.duration : B.type === 'consult' ? S.booking.consult.duration : B.sel.reduce((s, id) => s + (getT(id)?.duration_min || 0), 0));
const bookPrice = () => (B.resched ? B.resched.price : B.type === 'consult' ? S.booking.consult.price : B.sel.reduce((s, id) => s + Number(getT(id)?.price || 0), 0));
const svcBody = () => (B.resched ? { code: B.resched.code, phone: B.resched.phone } : { type: B.type, treatmentIds: B.sel });
const pracName = id => (PRACS.find(p => p.id === Number(id)) || { name: 'No preference' }).name;

function renderBook() {
  const box = $('#bookBox'), st = $('#stepper');
  if (!S.booking.onlineBookingEnabled && !B.done) { st.innerHTML = ''; box.innerHTML = `<p class="note">Online booking is paused right now. Please call <a href="tel:${esc(S.site.phone)}">${esc(S.site.phone)}</a> or message us to book.</p>`; return; }
  st.innerHTML = STEPS.map((s, i) => `<li class="${i + 1 < B.step ? 'done' : i + 1 === B.step ? 'cur' : ''}">${i + 1}. ${s}</li>`).join('');
  if (B.done) return renderConfirmation(box);
  const nav = (canNext, label) => `<div class="nav-row">${B.step > 1 && !(B.resched && B.step === 3) ? `<button class="btn ghost" id="bBack">${t('back')}</button>` : '<span></span>'}<button class="btn" id="bNext" ${canNext ? '' : 'disabled'}>${label || t('next')}</button></div>`;

  if (B.step === 1) {
    const c = S.booking.consult;
    box.innerHTML = `<h3>What would you like to book?</h3>
    <label class="opt"><input type="radio" name="type" value="consult" ${B.type === 'consult' ? 'checked' : ''}><span><b>${esc(c.label)} ${c.price ? '(' + peso(c.price) + ')' : '(Free)'}</b><small>${c.duration} min · ${esc(c.description || '')}</small></span></label>
    <label class="opt"><input type="radio" name="type" value="treatment" ${B.type === 'treatment' ? 'checked' : ''}><span><b>Treatment</b><small>Book one or more treatments directly.</small></span></label>
    <div id="tpick" class="${B.type === 'treatment' ? '' : 'hide'}">${S.categories.map(cat => `<details ${cat.treatments.some(x => B.sel.includes(x.id)) ? 'open' : ''} style="margin-top:8px"><summary>${esc(cat.name)}</summary><div style="padding:0 10px 10px">
      ${cat.treatments.map(x => `<label class="opt"><input type="checkbox" value="${x.id}" ${B.sel.includes(x.id) ? 'checked' : ''}><span><b>${esc(x.name)}</b><small>${x.duration_min} min · from ${peso(x.price)}</small></span></label>`).join('')}</div></details>`).join('')}</div>
    <p class="sum" id="tot"></p>${nav(false)}`;
    const upd = () => {
      B.type = $('input[name=type]:checked').value; B.sel = $$('#tpick input:checked').map(i => Number(i.value));
      $('#tpick').classList.toggle('hide', B.type !== 'treatment');
      $('#tot').innerHTML = B.type === 'consult' ? `${esc(S.booking.consult.label)} · ${S.booking.consult.duration} min`
        : (B.sel.length ? `<b>${B.sel.length} selected</b> · ${bookDuration()} min · from ${peso(bookPrice())}` : 'Select at least one treatment.');
      const tooMany = B.sel.length > 8;
      if (tooMany) $('#tot').innerHTML += '<br><span class="err">Please choose up to 8 treatments per booking.</span>';
      $('#bNext').disabled = (B.type === 'treatment' && !B.sel.length) || tooMany; B.date = B.time = null;
    };
    box.onchange = upd; upd();
  }
  if (B.step === 2) {
    const list = [{ id: 'any', name: 'No preference', role: 'First available' }].concat(PRACS.filter(p => p.bookable));
    box.innerHTML = `<h3>Choose your specialist</h3>${list.map(p => `<label class="opt"><input type="radio" name="pr" value="${p.id}" ${String(B.prac) === String(p.id) ? 'checked' : ''}><span><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span></label>`).join('')}${nav(true)}`;
    box.onchange = () => { B.prac = $('input[name=pr]:checked').value; B.date = B.time = null; };
  }
  if (B.step === 3) { box.onchange = null; renderCalendar(box, nav); }
  if (B.step === 4) { box.onchange = null; renderSlots(box, nav); }
  if (B.step === 5) { box.onchange = null; renderForm(box, nav); }
  if (B.step === 6) {
    box.onchange = null;
    box.innerHTML = `<h3>Review &amp; confirm</h3>${summaryHTML({ type: B.type, service: serviceName(), practitioner: B.prac === 'any' ? 'First available' : pracName(B.prac), date: B.date, start: B.time, duration: bookDuration(), price: bookPrice(), client: B.resched ? null : B.form })}
      <p class="note">Cancellation policy: ${S.booking.cancelHours} hours' notice required to cancel or reschedule.</p>
      <div class="nav-row"><button class="btn ghost" id="bBack">${t('back')}</button><button class="btn gold" id="bConfirm">${B.resched ? 'Confirm new time' : 'Confirm booking'}</button></div>`;
    $('#bConfirm').onclick = confirmBooking;
  }
  wireNav();
}
function wireNav() {
  const bn = $('#bNext'), bb = $('#bBack');
  if (bn) bn.onclick = () => { if (B.step === 5 && !validateForm()) return; B.step = B.resched && B.step === 4 ? 6 : B.step + 1; renderBook(); scrollTo(0, 0); };
  if (bb) bb.onclick = () => { if (B.step === 5) collectForm(); B.step = B.resched && B.step === 6 ? 4 : B.step - 1; renderBook(); scrollTo(0, 0); };
}
const serviceName = () => (B.resched ? B.resched.service : B.type === 'consult' ? S.booking.consult.label : B.sel.map(id => getT(id)?.name).join(', '));

async function renderCalendar(box, nav) {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const now = new Date(), thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now); last.setDate(last.getDate() + S.booking.maxAdvanceDays);
  const head = `<h3>Pick a date</h3><div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0">
    <button class="btn ghost sm" id="pm" aria-label="Previous month" ${calMonth <= thisMonth ? 'disabled' : ''}>‹</button><b>${calMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</b>
    <button class="btn ghost sm" id="nm" aria-label="Next month" ${new Date(y, m + 1, 1) > last ? 'disabled' : ''}>›</button></div>`;
  box.innerHTML = head + '<div class="spin"></div>';
  const key = [y, m + 1, bookDuration(), B.prac, B.resched?.code || ''].join('|');
  let days;
  try { days = monthCache[key] || (monthCache[key] = (await api('/availability/month', { year: y, month: m + 1, prac: B.prac, ...svcBody() })).days); }
  catch (e) { box.innerHTML = head + `<p class="err">${esc(e.message)}</p>` + nav(false); wire(); wireNav(); return; }
  if (B.step !== 3) return;
  const first = new Date(y, m, 1).getDay(), dn = new Date(y, m + 1, 0).getDate();
  let cells = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= dn; d++) { const ds = y + '-' + pad(m + 1) + '-' + pad(d); cells += `<button class="day ${B.date === ds ? 'sel' : ''}" data-d="${ds}" ${days[ds] ? '' : 'disabled'} aria-label="${fmtDate(ds)}">${d}</button>`; }
  const closed = (S.booking.closedDays || []).map(i => ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][i]).join(', ');
  box.innerHTML = head + `<div class="cal">${cells}</div><p class="note" style="margin-top:12px">Greyed-out days are ${closed ? 'closed (' + closed + '), ' : ''}past, blocked or fully booked.</p>${nav(!!B.date)}`;
  wire(); wireNav();
  $$('.day').forEach(b => b.onclick = () => { B.date = b.dataset.d; B.time = null; B.slots = null; B.step = 4; renderBook(); });
  function wire() { $('#pm').onclick = () => { calMonth = new Date(y, m - 1, 1); renderBook(); }; $('#nm').onclick = () => { calMonth = new Date(y, m + 1, 1); renderBook(); }; }
}

async function renderSlots(box, nav) {
  box.innerHTML = `<h3>Choose a time</h3><p class="lead" style="margin:4px 0">${fmtDate(B.date)} · appointment length ${bookDuration()} min</p><div class="spin"></div>`;
  try { if (!B.slots) B.slots = (await api('/availability/day', { date: B.date, prac: B.prac, ...svcBody() })).slots; }
  catch (e) { box.innerHTML += `<p class="err">${esc(e.message)}</p>` + nav(false); wireNav(); return; }
  if (B.step !== 4) return;
  const sl = B.slots;
  box.innerHTML = `<h3>Choose a time</h3><p class="lead" style="margin:4px 0">${fmtDate(B.date)} · appointment length ${bookDuration()} min</p>
    <div class="slots">${sl.map(s => `<button class="slot ${B.time === s.t ? 'sel' : ''}" data-t="${s.t}" ${s.ok ? '' : 'disabled'}>${fmtTime(s.t)}</button>`).join('')}</div>
    ${sl.some(s => s.ok) ? '' : '<p class="err">No times left on this day. Please pick another date.</p>'}${nav(B.time != null)}`;
  $$('.slot').forEach(b => b.onclick = () => { B.time = Number(b.dataset.t); $$('.slot').forEach(x => x.classList.toggle('sel', x === b)); $('#bNext').disabled = false; });
  wireNav();
}

function summaryHTML(b) {
  return `<dl class="sum"><dt>Booking type</dt><dd>${b.type === 'consult' ? 'Consultation' : 'Treatment'}</dd><dt>Service</dt><dd>${esc(b.service)}</dd>
  <dt>Specialist</dt><dd>${esc(b.practitioner)}</dd><dt>Date &amp; time</dt><dd>${fmtDate(b.date)}, ${fmtTime(b.start)} – ${fmtTime(b.start + b.duration)}</dd>
  <dt>Estimated total</dt><dd>${b.price ? peso(b.price) + ' (payable at the clinic)' : 'Free'}</dd>${b.client ? `<dt>Client</dt><dd>${esc(b.client.name)} · ${esc(b.client.phone)} · ${esc(b.client.email)}</dd>` : ''}</dl>`;
}

/* ---- intake form ---- */
function renderForm(box, nav) {
  const f = B.form || {}; const v = k => esc(f[k] || '');
  box.innerHTML = `<h3>Your details</h3><form id="frm" novalidate>
  <label class="f" for="name">Full name *</label><input type="text" id="name" autocomplete="name" maxlength="120" value="${v('name')}"><div class="err" data-e="name"></div>
  <label class="f" for="phone">Mobile number *</label><input type="tel" id="phone" autocomplete="tel" placeholder="09XX XXX XXXX" value="${v('phone')}"><div class="err" data-e="phone"></div>
  <label class="f" for="email">Email *</label><input type="email" id="email" autocomplete="email" value="${v('email')}"><div class="err" data-e="email"></div>
  <label class="f" for="age">Age *</label><input type="number" id="age" min="12" max="100" inputmode="numeric" value="${v('age')}"><div class="err" data-e="age"></div>
  <label class="f" for="concerns">Skin / body concerns *</label><textarea id="concerns" maxlength="1500" placeholder="e.g. acne scars, dark underarms, unwanted hair">${v('concerns')}</textarea><div class="err" data-e="concerns"></div>
  <label class="f" for="allergies">Allergies or medical conditions * <small>(write “None” if none)</small></label><textarea id="allergies" maxlength="1500">${v('allergies')}</textarea><div class="err" data-e="allergies"></div>
  <label class="f">Pregnant or breastfeeding? *</label>
  <label class="opt"><input type="radio" name="preg" value="No" ${f.pregnant === 'No' ? 'checked' : ''}><span>No</span></label>
  <label class="opt"><input type="radio" name="preg" value="Yes" ${f.pregnant === 'Yes' ? 'checked' : ''}><span>Yes</span></label><div class="err" data-e="preg"></div>
  <label class="f" for="meds">Current medications * <small>(write “None” if none)</small></label><input type="text" id="meds" maxlength="1000" value="${v('meds')}"><div class="err" data-e="meds"></div>
  <label class="f" for="notes">Notes (optional)</label><textarea id="notes" maxlength="1500">${v('notes')}</textarea>
  <label class="f" for="photo">Photo of concern (optional)</label><input type="file" id="photo" accept="image/*"><small style="color:var(--muted)">${B.photo ? 'Selected: ' + esc(B.photo.name) + '. ' : ''}Only our clinic team can see this photo.</small><div class="err" data-e="photo"></div>
  <div class="hp" aria-hidden="true"><label for="website">Website</label><input type="text" id="website" tabindex="-1" autocomplete="off"></div>
  <label class="opt" style="margin-top:16px"><input type="checkbox" id="c1" ${f.c1 ? 'checked' : ''}><span>I agree to the <a href="#privacy" target="_blank">Data Privacy policy</a> and consent to my health information being used for my care. *</span></label><div class="err" data-e="c1"></div>
  <label class="opt"><input type="checkbox" id="c2" ${f.c2 ? 'checked' : ''}><span>I understand treatment results vary, I have disclosed my medical history truthfully, and I accept the treatment disclaimer. *</span></label><div class="err" data-e="c2"></div>
  </form>${nav(true, 'Review booking')}`;
  $('#photo').onchange = e => { const fl = e.target.files[0]; if (fl && fl.size > 8 * 1024 * 1024) { $('[data-e=photo]').textContent = 'Photo is too large (max 8 MB).'; e.target.value = ''; return; } $('[data-e=photo]').textContent = ''; B.photo = fl || null; };
}
function collectForm() {
  const g = id => $('#' + id).value.trim();
  B.form = { name: g('name'), phone: g('phone'), email: g('email'), age: g('age'), concerns: g('concerns'), allergies: g('allergies'),
    pregnant: ($('input[name=preg]:checked') || {}).value || '', meds: g('meds'), notes: g('notes'), c1: $('#c1').checked, c2: $('#c2').checked, website: g('website') };
}
function showErrors(E) {
  $$('[data-e]').forEach(e => { e.textContent = E[e.dataset.e] || ''; });
  $$('#frm input,#frm textarea').forEach(i => i.classList.toggle('bad', !!E[i.id === 'meds' ? 'meds' : i.id]));
  const first = Object.keys(E)[0];
  if (first) { const el = $('[data-e=' + first + ']'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Please fix the highlighted fields.'); }
}
function validateForm() {
  collectForm(); const f = B.form, E = {};
  if (f.name.length < 2) E.name = 'Please enter your full name.';
  else if (!/^[A-Za-zÀ-ÿñÑ.\-' ]{2,}$/.test(f.name)) E.name = "Names can only contain letters, spaces and . - '";
  if (!/^(\+?63|0)9\d{9}$/.test(f.phone.replace(/[\s-]/g, ''))) E.phone = 'Enter a valid PH mobile number, e.g. 0927 650 7729.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) E.email = 'Please enter a valid email like name@example.com.';
  const a = +f.age; if (!f.age || a < 12 || a > 100) E.age = 'Please enter an age between 12 and 100.'; else if (a < 18) E.age = 'Clients under 18 need a parent or guardian. Please call us to book.';
  if (f.concerns.length < 3) E.concerns = "Tell us briefly what you'd like help with.";
  if (!f.allergies) E.allergies = 'Please list allergies/conditions, or write “None”.';
  if (!f.pregnant) E.preg = 'Please choose Yes or No.';
  if (!f.meds) E.meds = 'Please list medications, or write “None”.';
  if (!f.c1) E.c1 = 'Please accept the data privacy agreement to continue.';
  if (!f.c2) E.c2 = 'Please accept the treatment disclaimer to continue.';
  showErrors(E); return !Object.keys(E).length;
}

async function confirmBooking() {
  if (busy) return; busy = true;
  const btn = $('#bConfirm'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    let res;
    if (B.resched) {
      res = await api('/bookings/reschedule', { code: B.resched.code, phone: B.resched.phone, date: B.date, start: B.time, prac: B.prac });
    } else {
      const f = B.form;
      const data = { type: B.type, treatmentIds: B.sel, prac: B.prac, date: B.date, start: B.time, website: f.website,
        client: { name: f.name, phone: f.phone, email: f.email, age: f.age, concerns: f.concerns, allergies: f.allergies, pregnant: f.pregnant, medications: f.meds, notes: f.notes, c1: f.c1, c2: f.c2 } };
      if (B.photo) { const fd = new FormData(); fd.append('data', JSON.stringify(data)); fd.append('photo', B.photo); res = await api('/bookings', fd, true); }
      else res = await api('/bookings', data);
    }
    B.done = res.booking; Object.keys(monthCache).forEach(k => delete monthCache[k]);
    renderBook(); scrollTo(0, 0);
  } catch (e) {
    if (e.status === 409) { toast(e.message); B.slots = null; B.time = null; B.step = 4; Object.keys(monthCache).forEach(k => delete monthCache[k]); renderBook(); }
    else if (e.status === 422 && e.fields) { B.step = 5; renderBook(); showErrors(e.fields); }
    else { toast(e.message); btn.disabled = false; btn.textContent = B.resched ? 'Confirm new time' : 'Confirm booking'; }
  } finally { busy = false; }
}

function gcalLink(b) {
  const f = m => b.date.replace(/-/g, '') + 'T' + pad(Math.floor(m / 60)) + pad(m % 60) + '00';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(S.site.name + ': ' + b.service) + '&dates=' + f(b.start) + '/' + f(b.end) +
    '&details=' + encodeURIComponent('Ref: ' + b.code + '. Cancellation needs ' + S.booking.cancelHours + 'h notice.') + '&location=' + encodeURIComponent(S.site.address) + '&ctz=Asia/Manila';
}
function renderConfirmation(box) {
  const b = B.done;
  $('#stepper').innerHTML = '';
  box.innerHTML = `<div style="text-align:center"><div style="font-size:2.4rem">✨</div><h3>${B.resched ? 'Booking rescheduled' : "You're booked!"}</h3>
  <p class="lead" style="margin:6px auto">Status: <b>${b.status === 'confirmed' ? 'Confirmed' : 'Pending'}</b>. We'll confirm shortly. Save your reference code:</p><div class="code">${esc(b.code)}</div></div>
  ${summaryHTML({ ...b, practitioner: b.practitioner })}<h3>Before your visit</h3><ul style="padding-left:20px;margin:8px 0 16px">${(S.site.preTreatment || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <p class="note">Need to change plans? Use “Manage booking” with your code and phone number. ${S.booking.cancelHours} hours' notice please.</p>
  <div class="nav-row" style="justify-content:center"><a class="btn gold" target="_blank" rel="noopener" href="${gcalLink(b)}">Add to Google Calendar</a><a class="btn ghost" href="#home" id="doneBtn">Back to home</a></div>
  ${b.client?.email ? `<p style="text-align:center;margin-top:14px;color:var(--muted);font-size:.85rem">A copy of your booking will be sent to ${esc(b.client.email)}.</p>` : ''}`;
  $('#doneBtn').onclick = () => resetBooking();
}

/* ---------------------------------------------------------------- manage booking */
function renderManage() {
  const box = $('#manageBox');
  box.innerHTML = `<label class="f" for="rc">Reference code</label><input type="text" id="rc" placeholder="MA-XXXXXX" autocomplete="off" style="text-transform:uppercase">
  <label class="f" for="rp">Phone number used for booking</label><input type="tel" id="rp" autocomplete="tel"><div class="err" id="re"></div>
  <div class="nav-row"><span></span><button class="btn" id="rfind">Find my booking</button></div><div id="rres"></div>`;
  const find = async () => {
    const code = $('#rc').value.trim().toUpperCase(), phone = $('#rp').value.trim();
    if (!code || !phone) { $('#re').textContent = 'Enter your reference code and phone number.'; return; }
    $('#rfind').disabled = true; $('#re').textContent = '';
    try {
      const { booking: b, canChange } = await api('/bookings/lookup', { code, phone });
      $('#rres').innerHTML = summaryHTML(b) + `<p>Status: <span class="st ${b.status}">${b.status}</span></p>` +
        (!canChange.ok ? `<p class="note">${esc(canChange.reason)} ${esc(S.site.phone)}</p>`
          : `<div class="nav-row"><button class="btn ghost" id="rres_b">Reschedule</button><button class="btn danger" id="rcan_b">Cancel booking</button></div>`);
      if (!canChange.ok) return;
      $('#rcan_b').onclick = async () => {
        if (!confirm('Cancel this booking?')) return;
        try { await api('/bookings/cancel', { code, phone }); toast('Booking cancelled.'); find(); } catch (e) { toast(e.message); }
      };
      $('#rres_b').onclick = () => {
        resetBooking();
        B.resched = { code, phone, duration: b.duration, price: b.price, service: b.service };
        B.type = b.type; B.prac = 'any'; B.step = 3; location.hash = '#book'; if (curPage() === 'book') renderBook();
      };
    } catch (e) { $('#re').textContent = e.message; $('#rres').innerHTML = ''; }
    finally { $('#rfind').disabled = false; }
  };
  $('#rfind').onclick = find;
  $('#rp').onkeydown = e => { if (e.key === 'Enter') find(); };
}

/* ---------------------------------------------------------------- start */
(async function init() {
  try {
    S = await api('/site');
    S.categories.forEach(c => c.treatments.forEach(x => { TREAT[x.id] = x; }));
    PRACS = S.practitioners;
    $('#loading').remove();
    bindContent(); applyLang(); renderTreatments(); renderTop(); route(); observe();
  } catch (e) {
    $('#loading').innerHTML = `<div style="text-align:center;padding:20px"><p>Sorry, we couldn't load the site.</p><p class="lead">${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => location.reload();
  }
})();
})();

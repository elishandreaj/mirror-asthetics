/* Mirror Aesthetics – customer website. Content & availability come from the server (/api). */
(() => {
'use strict';

/* ================================================================ helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const fmtTime = m => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + pad(mm) + ' ' + (h < 12 ? 'AM' : 'PM'); };
const fmtHour = h => fmtTime(h * 60);
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const peso = n => '₱' + Number(n).toLocaleString('en-PH');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function toast(m) { const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3400); }

const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', menu: '<path d="M4 9h16M4 15h16"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', chevL: '<path d="M15 6l-6 6 6 6"/>', chevR: '<path d="M9 6l6 6-6 6"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14z"/><path d="M5 19l7.5-7.5"/>',
  drop: '<path d="M12 3c3.6 4.4 6 7.7 6 10.6a6 6 0 0 1-12 0C6 10.7 8.4 7.4 12 3z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.3a11 11 0 0 0 5.7 5.7l1.3-2 4.5 1.5v3A2.5 2.5 0 0 1 18 20 15 15 0 0 1 4 6a2.5 2.5 0 0 1 2.5-2.5z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M4 5.5h16v11H9l-5 4z"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>', swap: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/>',
};
const FILLED = {
  facebook: '<path d="M13.5 21v-7.4h2.5l.4-3h-2.9V8.8c0-.9.3-1.5 1.5-1.5h1.5V4.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.3H8.1v3h2.5V21h2.9z"/>',
  tiktok: '<path d="M16.6 3c.3 2.2 1.6 3.7 3.9 3.9v3c-1.5.1-2.9-.4-3.9-1.1v6c0 3.4-2.6 5.7-5.7 5.7-3.2 0-5.6-2.5-5.6-5.6 0-3.4 2.9-6 6.4-5.5v3.1c-1.6-.4-3.3.6-3.3 2.4 0 1.4 1.1 2.5 2.5 2.5 1.5 0 2.6-1.1 2.6-2.8V3h3.1z"/>',
};
const ic = (n, cls = '') => FILLED[n] ? `<svg class="icon fill ${cls}" viewBox="0 0 24 24" aria-hidden="true">${FILLED[n]}</svg>` : `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
function paintIcons(root = document) { $$('[data-ic]', root).forEach(e => { e.outerHTML = ic(e.dataset.ic); }); }

async function api(path, body, isForm) {
  const opts = body === undefined ? {} : { method: 'POST', body: isForm ? body : JSON.stringify(body), headers: isForm ? {} : { 'Content-Type': 'application/json' } };
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw Object.assign(new Error('No internet connection. Please check your connection and try again.'), { status: 0 }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, fields: data.fields });
  return data;
}

/* ================================================================ data */
let S = null, TREAT = {}, CATS = [], PRACS = [];
const getT = id => TREAT[id];

/* ================================================================ language */
const I18N = {
  en: { nav_treat: 'Treatments', nav_results: 'Results', nav_team: 'Our team', nav_faq: 'FAQ', nav_visit: 'Visit us', nav_manage: 'My booking', nav_book: 'Book now',
    consult: 'Book a consultation', explore: 'Explore treatments', book_this: 'Book', next: 'Continue', back: 'Back', all: 'All' },
  fil: { nav_treat: 'Mga treatment', nav_results: 'Resulta', nav_team: 'Ang team', nav_faq: 'Mga tanong', nav_visit: 'Bisitahin kami', nav_manage: 'Aking booking', nav_book: 'Mag-book',
    consult: 'Mag-book ng konsultasyon', explore: 'Tingnan ang mga treatment', book_this: 'I-book', next: 'Magpatuloy', back: 'Bumalik', all: 'Lahat' },
};
let LANG = 'en';
try { LANG = localStorage.getItem('ma_lang') === 'fil' ? 'fil' : 'en'; } catch {}
const t = k => I18N[LANG][k] || I18N.en[k] || k;
function applyLang() {
  $$('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  $$('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
  document.documentElement.lang = LANG === 'en' ? 'en' : 'fil';
}
$$('.lang button').forEach(b => b.onclick = () => {
  LANG = b.dataset.lang; try { localStorage.setItem('ma_lang', LANG); } catch {}
  applyLang(); if (S) { renderAll(); route(true); }
});

/* ================================================================ clinic hours */
function manilaNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
function openStatus() {
  const b = S.booking, n = manilaNow(), openDay = d => !b.closedDays.includes(d);
  if (openDay(n.day) && n.min >= b.openHour * 60 && n.min < b.closeHour * 60) return { open: true, text: `Open today · until ${fmtHour(b.closeHour)}` };
  if (openDay(n.day) && n.min < b.openHour * 60) return { open: false, text: `Opens today at ${fmtHour(b.openHour)}` };
  for (let i = 1; i <= 7; i++) { const d = (n.day + i) % 7; if (openDay(d)) return { open: false, text: `Closed now · opens ${i === 1 ? 'tomorrow' : DAYS[d]} at ${fmtHour(b.openHour)}` }; }
  return { open: false, text: 'Closed' };
}
function hoursRows() {
  const b = S.booking, today = manilaNow().day;
  return [1, 2, 3, 4, 5, 6, 0].map(d => `<tr class="${d === today ? 'today' : ''}"><td>${DAYS[d]}</td><td>${b.closedDays.includes(d) ? 'Closed' : fmtHour(b.openHour) + ' – ' + fmtHour(b.closeHour)}</td></tr>`).join('');
}
const mapSrc = () => (S.site.mapEmbedUrl && /^https:\/\/(www\.)?google\.com\/maps\/embed/.test(S.site.mapEmbedUrl))
  ? S.site.mapEmbedUrl : `https://maps.google.com/maps?q=${encodeURIComponent(S.site.name + ', ' + S.site.address)}&z=16&output=embed`;
const dirUrl = () => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(S.site.name + ', ' + S.site.address)}`;
const telHref = () => 'tel:' + S.site.phone.replace(/\D/g, '').replace(/^0/, '+63');
function chatLinks() {
  const c = S.site.chat || {}, out = [];
  if (c.messenger) out.push(['Messenger', `https://m.me/${encodeURIComponent(c.messenger)}`]);
  if (c.viber) out.push(['Viber', `viber://chat?number=${encodeURIComponent(c.viber)}`]);
  if (c.whatsapp) out.push(['WhatsApp', `https://wa.me/${c.whatsapp.replace(/\D/g, '')}`]);
  return out;
}

/* ================================================================ shell: header, footer, fab */
function renderShell() {
  const site = S.site, words = site.name.trim().split(/\s+/);
  const A = words.length > 1 ? words.slice(0, -1).join(' ') : words[0], Bw = words.length > 1 ? words[words.length - 1] : '';
  $$('[data-bind=brandA]').forEach(e => { e.textContent = A; }); $$('[data-bind=brandB]').forEach(e => { e.textContent = Bw; });
  $$('[data-bind=name]').forEach(e => { e.textContent = site.name; }); $$('[data-bind=city]').forEach(e => { e.textContent = site.city; });
  document.title = `${site.name} – ${site.tagline}`;
  $('meta[name=description]').setAttribute('content', site.metaDescription || '');
  $('#yr').textContent = new Date().getFullYear();
  $('#footBlurb').textContent = `${site.tagline}. Facials, laser, body and spa care in ${site.city}.`;
  const soc = [['facebook', 'Facebook', site.social.facebook], ['instagram', 'Instagram', site.social.instagram], ['tiktok', 'TikTok', site.social.tiktok]].filter(x => x[2]);
  $('#socials').innerHTML = soc.map(([k, n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${n}" title="${n}">${ic(k)}</a>`).join('');
  $('#footMap').innerHTML = `<iframe src="${esc(mapSrc())}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map to ${esc(site.name)}"></iframe>`;
  $('#footDir').href = dirUrl();
  $('#menuBtn').innerHTML = ic('menu'); $('#sheetClose').innerHTML = ic('close');
  $('#fabBtn').innerHTML = ic('chat');
  $('#fabMenu').innerHTML = `<p>Talk to us</p>${chatLinks().map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${ic('chat')}${n}</a>`).join('')}
    <a href="${telHref()}">${ic('phone')}Call ${esc(site.phone)}</a><a href="mailto:${esc(site.email)}">${ic('mail')}Email us</a>`;
  if (!S.booking.onlineBookingEnabled) { $('#banner').textContent = `Online booking is paused right now. Please call ${site.phone} or message us to book.`; $('#banner').classList.remove('hide'); }
  paintIcons();
}
const sheet = $('#sheet');
const setSheet = open => { sheet.classList.toggle('open', open); sheet.setAttribute('aria-hidden', !open); $('#menuBtn').setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : ''; };
$('#menuBtn').onclick = () => setSheet(true); $('#sheetClose').onclick = () => setSheet(false);
sheet.addEventListener('click', e => { if (e.target.closest('a')) setSheet(false); });
$('#fabBtn').onclick = () => { const o = $('#fab').classList.toggle('open'); $('#fabBtn').setAttribute('aria-expanded', o); };
document.addEventListener('click', e => { if (!e.target.closest('#fab')) $('#fab').classList.remove('open'); });
window.addEventListener('scroll', () => $('#head').classList.toggle('scrolled', scrollY > 8), { passive: true });

/* ================================================================ pages */
const bookLink = id => `<a class="link" href="#book" data-book="${id}"><span>${t('book_this')}</span>${ic('arrow')}</a>`;
const priceTag = p => (Number(p) ? `<small>from</small>${peso(p)}` : 'Free');

function renderHome() {
  const site = S.site, st = openStatus();
  const all = CATS.flatMap(c => c.treatments), feat = all.filter(x => x.featured);
  const sig = (feat.length ? feat : all.slice(0, 4)).slice(0, 5);
  const badgeIc = b => ({ '🩺': 'shield', '🌿': 'leaf', '✨': 'drop' }[b.icon] || (ICONS[b.icon] ? b.icon : 'check'));
  $('#p-home').innerHTML = `
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(site.city)} · Aesthetic clinic</p>
      <h1>${esc(site.heroTitle || site.tagline).replace(/(\S+\.?)$/, '<em>$1</em>')}</h1>
      <p class="lead">${esc(site.heroText || '')}</p>
      <div class="hero-cta"><a class="btn" href="#book" data-consult="1">${t('consult')}</a><a class="link" href="#treatments"><span>${t('explore')}</span>${ic('arrow')}</a></div>
      <div class="status"><span class="dot ${st.open ? 'open' : 'closed'}"></span>${esc(st.text)}</div>
    </div>
    <div class="hero-art reveal">
      <div class="arch">${site.heroImage ? `<img src="${site.heroImage}" alt="${esc(site.name)}">` : `<div class="arch-cap">${esc(LANG === 'fil' && site.taglineFil ? site.taglineFil : site.tagline)}<small>${esc(site.name)}</small></div>`}</div>
      ${S.booking.consult && !Number(S.booking.consult.price) ? `<div class="tag"><b>Free consultation</b>Skin assessment and a plan made for you.</div>` : ''}
    </div>
  </div></section>

  <section class="sec tight white"><div class="wrap trust">
    ${(site.badges || []).map(b => `<div class="reveal">${ic(badgeIc(b))}<h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></div>`).join('')}
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Signature treatments</p><h2>Most loved by our clients</h2></div><a class="link" href="#treatments"><span>See the full menu</span>${ic('arrow')}</a></div>
    <div class="sig">${sig.map((x, i) => `<a href="#book" data-book="${x.id}" class="reveal"><span class="n">${pad(i + 1)}</span><div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p></div><div class="pr">${Number(x.price) ? '<span>from</span><b>' + peso(x.price) + '</b>' : '<b>Free</b>'}</div></a>`).join('')}</div>
    <p class="muted" style="margin-top:16px;font-size:.88rem">${esc(site.topIntro || '')}</p>
  </div></section>

  ${S.promos.length ? `<section class="sec blush"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Offers</p><h2>Packages &amp; promos</h2></div></div>
    <div class="offers">${S.promos.map(p => `<div class="offer reveal">${p.chip ? `<span class="eyebrow">${esc(p.chip)}</span>` : ''}<h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><a class="link" href="#book"><span>Book now</span>${ic('arrow')}</a></div>`).join('')}</div>
  </div></section>` : ''}

  ${S.testimonials.length ? `<section class="sec"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">Kind words</p><h2>From our clients</h2></div></div>
    <div class="quotes">${S.testimonials.slice(0, 3).map(q => `<blockquote class="quote reveal"><p>${esc(q.quote)}</p><cite>${esc(q.author)}</cite></blockquote>`).join('')}</div>
  </div></section>` : ''}

  <section class="sec white"><div class="wrap split">
    <div><p class="eyebrow">Rewards</p><h2 style="margin:10px 0 14px">${esc(site.loyalty.title)}</h2><p class="lead">${esc(site.loyalty.text)}</p></div>
    <div class="card reveal"><h3>${esc(site.loyalty.cardTitle)}</h3><p class="muted" style="margin-top:6px">${esc(site.loyalty.cardText)}</p>
      <div class="stamps">${Array.from({ length: 10 }, (_, i) => `<span>${i === 9 ? 'free' : i + 1}</span>`).join('')}</div></div>
  </div></section>

  <section class="cta-band"><div class="wrap">
    <div><h2>Not sure what your skin needs? <em>Start with a conversation.</em></h2><p>${Number(S.booking.consult.price) ? 'Book a consultation' : 'Our consultation is free'} – we'll look at your skin, listen to your goals and suggest a plan.</p></div>
    <a class="btn light" href="#book" data-consult="1">${t('consult')}</a>
  </div></section>`;
}

/* ---- treatments menu ---- */
const TF = { q: '', cat: 'all', open: new Set() };
function renderTreatmentsPage() {
  $('#p-treatments').innerHTML = `<div class="wrap page-head"><p class="eyebrow">The menu</p><h1>Treatments</h1><p class="lead">${esc(S.site.treatmentsIntro)}</p></div>
  <section class="wrap" style="padding-bottom:90px">
    <div class="tools"><div class="search">${ic('search')}<input type="search" id="tq" placeholder="Search treatments, e.g. underarm" aria-label="Search treatments"></div>
      <div class="chips" id="tchips"></div></div>
    <div id="tlist"></div>
  </section>`;
  if (!TF.open.size && CATS[0]) TF.open.add(CATS[0].id);
  $('#tq').value = TF.q;
  $('#tq').oninput = e => { TF.q = e.target.value.trim().toLowerCase(); drawMenu(); };
  drawMenu();
}
function drawMenu() {
  $('#tchips').innerHTML = [`<button class="chip ${TF.cat === 'all' ? 'on' : ''}" data-c="all">${t('all')}</button>`]
    .concat(CATS.map(c => `<button class="chip ${String(TF.cat) === String(c.id) ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</button>`)).join('');
  $$('#tchips .chip').forEach(b => b.onclick = () => {
    TF.cat = b.dataset.c === 'all' ? 'all' : Number(b.dataset.c);
    if (TF.cat !== 'all') TF.open.add(TF.cat);
    drawMenu();
  });
  const q = TF.q, matches = x => !q || (x.name + ' ' + x.description).toLowerCase().includes(q);
  const cats = CATS.filter(c => TF.cat === 'all' || c.id === TF.cat).map(c => ({ ...c, rows: c.treatments.filter(matches) })).filter(c => c.rows.length);
  $('#tlist').innerHTML = cats.length ? cats.map((c, i) => {
    const open = q || TF.cat !== 'all' || TF.open.has(c.id);
    return `<section class="tcat ${open ? 'open' : ''}" data-id="${c.id}">
      <button class="tcat-head" aria-expanded="${open}"><span class="num">${pad(CATS.indexOf(CATS.find(x => x.id === c.id)) + 1)}</span><h2>${esc(c.name)}</h2><span class="cnt">${c.rows.length} ${c.rows.length === 1 ? 'treatment' : 'treatments'}</span><span class="chev">${ic('plus')}</span></button>
      <div class="tcat-body"><div>${c.rows.map(x => `<div class="trow"><div><h3>${esc(x.name)}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ''}</div>
        <div class="side"><span class="price">${priceTag(x.price)}</span>${bookLink(x.id)}</div></div>`).join('')}<div class="pad"></div></div></div></section>`;
  }).join('') : `<p class="empty-note">No treatments match “${esc(TF.q)}”. Try another word, or <a href="#visit">ask us</a>.</p>`;
  $$('#tlist .tcat-head').forEach(h => h.onclick = () => {
    const sec = h.parentElement, id = Number(sec.dataset.id), open = !sec.classList.contains('open');
    sec.classList.toggle('open', open); h.setAttribute('aria-expanded', open);
    if (open) TF.open.add(id); else TF.open.delete(id);
  });
}

/* ---- results ---- */
let RF = 'all';
function renderResults() {
  const g = S.gallery;
  const head = `<div class="wrap page-head"><p class="eyebrow">Before &amp; after</p><h1>Real results</h1><p class="lead">${esc(S.site.resultsNote)}</p></div>`;
  if (!g.length) {
    $('#p-results').innerHTML = head + `<section class="wrap" style="padding-bottom:90px"><div class="res-empty">
      <div class="ghost-pair reveal"><div>Before</div><div>After</div></div>
      <div><h2>Our gallery is being curated.</h2>
        <p class="lead" style="margin-top:14px">We only publish photos of real clients, and only with their written permission – so this page fills up slowly and honestly.</p>
        <ol class="steps-list"><li>Book a free consultation and tell us your goal.</li><li>We photograph your starting point – privately, for your record.</li><li>Track your progress with your therapist after every session.</li></ol>
        <div class="hero-cta"><a class="btn" href="#book" data-consult="1">${t('consult')}</a><a class="link" href="#treatments"><span>${t('explore')}</span>${ic('arrow')}</a></div></div>
    </div></section>`;
    return;
  }
  const cats = CATS.filter(c => g.some(x => x.categoryId === c.id));
  const list = g.filter(x => RF === 'all' || x.categoryId === RF);
  $('#p-results').innerHTML = head + `<section class="wrap" style="padding-bottom:90px">
    ${cats.length > 1 ? `<div class="chips" style="margin-bottom:28px"><button class="chip ${RF === 'all' ? 'on' : ''}" data-r="all">${t('all')}</button>${cats.map(c => `<button class="chip ${RF === c.id ? 'on' : ''}" data-r="${c.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
    <div class="results">${list.map(x => `<figure class="result reveal">
      <div class="compare"><img src="${x.before}" alt="Before – ${esc(x.treatment || x.title)}" loading="lazy"><img class="after" src="${x.after}" alt="After – ${esc(x.treatment || x.title)}" loading="lazy">
        <span class="bar"></span><span class="knob">${ic('swap')}</span><span class="lbl b">Before</span><span class="lbl a">After</span>
        <input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after"></div>
      <figcaption><h3>${esc(x.treatment || x.title)}</h3><p>${[x.sessions, x.caption].filter(Boolean).map(esc).join(' · ')}</p></figcaption></figure>`).join('')}</div>
    <p class="muted" style="margin-top:30px;font-size:.88rem">Shared with each client's written consent. Individual results vary.</p></section>`;
  $$('#p-results [data-r]').forEach(b => b.onclick = () => { RF = b.dataset.r === 'all' ? 'all' : Number(b.dataset.r); renderResults(); observe(); });
  $$('#p-results .compare input').forEach(r => r.oninput = () => r.parentElement.style.setProperty('--pos', r.value + '%'));
}

function renderTeam() {
  $('#p-team').innerHTML = `<div class="wrap page-head" style="text-align:center"><p class="eyebrow">The people behind the care</p><h1>Our team</h1><p class="lead" style="margin:0 auto">${esc(S.site.teamIntro)}</p></div>
  <section class="wrap" style="padding-bottom:90px"><div class="team">${S.practitioners.map(p => `<article class="member reveal">
    <div class="portrait">${p.photo ? `<img src="${p.photo}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name.trim()[0] || '')}</div>
    <h3>${esc(p.name)}</h3><p class="eyebrow">${esc(p.role)}</p>${p.credentials ? `<p class="cred">${esc(p.credentials)}</p>` : ''}
    ${p.specialties ? `<div class="tags">${p.specialties.split(/,|&| and /).map(s => s.trim()).filter(Boolean).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
  </article>`).join('')}</div></section>`;
}

function renderFaq() {
  const topics = [...new Set(S.faqs.map(f => f.topic || 'General'))];
  const chats = chatLinks();
  $('#p-faq').innerHTML = `<section class="wrap" style="padding:64px 20px 90px"><div class="faq-grid">
    <aside class="faq-aside"><p class="eyebrow">FAQ</p><h1 style="margin:10px 0 16px">Questions, answered.</h1>
      <p class="lead">The things clients ask us most before their first visit. If yours isn't here, just ask – a real person from our team will reply.</p>
      <div class="card"><h3>Still unsure?</h3><p class="muted">Message us with a photo of your concern and we'll tell you which treatment fits.</p>
        <div class="row">${chats[0] ? `<a class="btn sm" href="${esc(chats[0][1])}" target="_blank" rel="noopener">Message us</a>` : ''}<a class="btn sm line" href="${telHref()}">Call ${esc(S.site.phone)}</a></div></div>
    </aside>
    <div>${topics.map(tp => `<div class="topic"><span class="eyebrow">${esc(tp)}</span>${S.faqs.filter(f => (f.topic || 'General') === tp).map(f => `<details class="qa"><summary>${esc(f.question)}<span class="pm">${ic('plus')}</span></summary><div class="ans pre-line">${esc(f.answer)}</div></details>`).join('')}</div>`).join('')}</div>
  </div></section>`;
}

function renderVisit() {
  const site = S.site, st = openStatus(), chats = chatLinks();
  $('#p-visit').innerHTML = `<div class="wrap page-head"><p class="eyebrow">Visit us</p><h1>Come and see us</h1><p class="lead">We're at ${esc(site.address)}. Walk-ins are welcome when we have space, but booking ahead guarantees your time.</p></div>
  <section class="wrap" style="padding-bottom:90px"><div class="visit">
    <div class="info-list">
      <div class="info"><span class="ic">${ic('pin')}</span><div><span class="eyebrow">Address</span><b>${esc(site.address)}</b><div class="acts"><a class="link" href="${dirUrl()}" target="_blank" rel="noopener"><span>Get directions</span>${ic('arrow')}</a></div></div></div>
      <div class="info"><span class="ic">${ic('phone')}</span><div><span class="eyebrow">Call or text</span><b><a href="${telHref()}">${esc(site.phone)}</a></b>
        ${chats.length ? `<div class="acts">${chats.map(([n, u]) => `<a class="link" href="${esc(u)}" target="_blank" rel="noopener"><span>${n}</span>${ic('arrow')}</a>`).join('')}</div>` : ''}</div></div>
      <div class="info"><span class="ic">${ic('mail')}</span><div><span class="eyebrow">Email</span><b><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></b></div></div>
      <div class="info"><span class="ic">${ic('clock')}</span><div><span class="eyebrow">Opening hours</span><span class="pill"><span class="dot ${st.open ? 'open' : 'closed'}"></span>${esc(st.text)}</span>
        <table class="hours">${hoursRows()}</table>${site.hoursNote ? `<p class="muted" style="font-size:.85rem;margin-top:10px">${esc(site.hoursNote)}</p>` : ''}</div></div>
    </div>
    <div class="map-frame reveal"><iframe src="${esc(mapSrc())}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map to ${esc(site.name)}" allowfullscreen></iframe></div>
  </div></section>
  <section class="cta-band"><div class="wrap"><div><h2>Ready when you are.</h2><p>Book online in about two minutes – choose your treatment, your specialist and a time that suits you.</p></div><a class="btn light" href="#book">${t('nav_book')}</a></div></section>`;
}

function renderPrivacy() {
  $('#p-privacy').innerHTML = `<section class="wrap" style="padding:64px 20px 90px"><div class="legal"><p class="eyebrow">Legal</p><h1 style="margin:10px 0 10px">Privacy policy</h1>
    ${String(S.site.privacyText || '').split(/\n\s*\n/).map(p => `<p class="pre-line">${esc(p)}</p>`).join('')}</div></section>`;
}

function renderAll() { renderShell(); renderHome(); renderTreatmentsPage(); renderResults(); renderTeam(); renderFaq(); renderVisit(); renderPrivacy(); applyLang(); paintIcons(); }

/* ================================================================ router */
const pageOf = () => { const h = (location.hash || '#home').slice(1).split('?')[0]; return $('#p-' + h) ? h : 'home'; };
const hashParam = k => new URLSearchParams((location.hash.split('?')[1] || '')).get(k);
let lastPage = null;
function route(keepScroll) {
  if (!S) return;
  const id = pageOf();
  $$('.page').forEach(p => p.classList.toggle('show', p.id === 'p-' + id));
  $$('.main-nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  setSheet(false);
  if (!keepScroll && lastPage !== id) window.scrollTo(0, 0);
  lastPage = id;
  document.body.classList.toggle('no-fab', id === 'book' || id === 'manage');
  if (id === 'book') renderBook();
  if (id === 'manage') renderManage();
  setTimeout(observe, 30);
}
window.addEventListener('hashchange', () => route());
document.addEventListener('click', e => {
  const b = e.target.closest('[data-book]'); if (b) { resetBooking(); B.type = 'treatment'; B.sel = [Number(b.dataset.book)]; B.step = 2; }
  const c = e.target.closest('[data-consult]'); if (c) { resetBooking(); B.type = 'consult'; B.step = 2; }
});
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 }) : null;
function observe() { $$('.page.show .reveal:not(.in)').forEach(e => (io ? io.observe(e) : e.classList.add('in'))); }

/* ================================================================ booking */
const STEPS = ['Service', 'Specialist', 'Date', 'Time', 'Details', 'Confirm'];
let B, calMonth, busy = false;
const monthCache = {};
function resetBooking() {
  B = { type: 'treatment', sel: [], prac: 'any', date: null, time: null, step: 1, form: {}, photo: null, done: null, resched: null, slots: null };
  const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1);
}
resetBooking();
const bookPrice = () => (B.resched ? B.resched.price : B.type === 'consult' ? S.booking.consult.price : B.sel.reduce((s, id) => s + Number(getT(id)?.price || 0), 0));
const svcBody = () => (B.resched ? { code: B.resched.code, phone: B.resched.phone } : { type: B.type, treatmentIds: B.sel });
const serviceName = () => (B.resched ? B.resched.service : B.type === 'consult' ? S.booking.consult.label : B.sel.map(id => getT(id)?.name).join(', '));
const pracName = id => (PRACS.find(p => String(p.id) === String(id)) || { name: 'First available' }).name;

function bookShell() {
  const p = $('#p-book');
  if ($('#bookBox', p)) return;
  p.innerHTML = `<div class="wrap page-head" style="padding-bottom:20px"><p class="eyebrow">Online booking</p><h1 id="bookTitle">Book an appointment</h1></div>
  <section class="wrap" style="padding-bottom:90px"><div class="book-shell">
    <div><ol class="stepper" id="stepper"></ol><div class="panel" id="bookBox" aria-live="polite"></div></div>
    <aside class="book-side"><div class="card side-card"><h4>Good to know</h4><ul>
      <li>${ic('check')}<span>Pay at the clinic after your session – no online payment needed.</span></li>
      <li>${ic('check')}<span>Prices are starting rates; your final price is confirmed before we begin.</span></li>
      <li>${ic('calendar')}<span>Reschedule or cancel online up to ${S.booking.cancelHours} hours before.</span></li>
      <li>${ic('phone')}<span>Prefer to talk? Call <a href="${telHref()}">${esc(S.site.phone)}</a>.</span></li></ul></div></aside>
  </div></section>`;
}
function renderBook() {
  bookShell();
  const box = $('#bookBox'), st = $('#stepper');
  $('#bookTitle').textContent = B.resched ? 'Choose a new time' : 'Book an appointment';
  if (!S.booking.onlineBookingEnabled && !B.done) { st.innerHTML = ''; box.innerHTML = `<h3>Online booking is paused</h3><p class="muted">Please call <a href="${telHref()}">${esc(S.site.phone)}</a> or message us to book.</p>`; return; }
  st.innerHTML = STEPS.map((s, i) => `<li class="${i + 1 < B.step ? 'done' : i + 1 === B.step ? 'cur' : ''}">${s}</li>`).join('');
  if (B.done) return renderConfirmation(box);
  const nav = (canNext, label) => `<div class="nav-row">${B.step > 1 && !(B.resched && B.step === 3) ? `<button class="btn line" id="bBack">${t('back')}</button>` : '<span></span>'}<button class="btn" id="bNext" ${canNext ? '' : 'disabled'}>${label || t('next')}</button></div>`;
  box.onchange = null;

  if (B.step === 1) {
    const c = S.booking.consult;
    box.innerHTML = `<h3>What would you like to book?</h3><p class="muted">Choose a consultation, or pick one or more treatments.</p><div style="margin-top:18px">
    <label class="opt"><input type="radio" name="type" value="consult" ${B.type === 'consult' ? 'checked' : ''}><span><b>${esc(c.label)}</b><small>${esc(c.description || '')}</small></span><span class="right">${Number(c.price) ? peso(c.price) : 'Free'}</span></label>
    <label class="opt"><input type="radio" name="type" value="treatment" ${B.type === 'treatment' ? 'checked' : ''}><span><b>Treatments</b><small>Select from our menu below.</small></span></label></div>
    <div id="tpick" class="${B.type === 'treatment' ? '' : 'hide'}">${CATS.map(cat => `<details class="cat-group" ${cat.treatments.some(x => B.sel.includes(x.id)) ? 'open' : ''}><summary>${esc(cat.name)}${ic('chevD')}</summary><div class="inner">
      ${cat.treatments.map(x => `<label class="opt"><input type="checkbox" value="${x.id}" ${B.sel.includes(x.id) ? 'checked' : ''}><span><b>${esc(x.name)}</b></span><span class="right">${Number(x.price) ? peso(x.price) : 'Free'}</span></label>`).join('')}</div></details>`).join('')}</div>
    <p class="note" id="tot" style="margin-top:16px"></p>${nav(false)}`;
    const upd = () => {
      B.type = $('input[name=type]:checked').value; B.sel = $$('#tpick input:checked').map(i => Number(i.value));
      $('#tpick').classList.toggle('hide', B.type !== 'treatment');
      const tooMany = B.sel.length > 8;
      $('#tot').innerHTML = B.type === 'consult' ? `${esc(S.booking.consult.label)} selected.`
        : (B.sel.length ? `<b>${B.sel.length} selected</b> · estimated ${peso(bookPrice())}${tooMany ? '<br><span style="color:var(--danger)">Please choose up to 8 treatments per booking.</span>' : ''}` : 'Select at least one treatment.');
      $('#bNext').disabled = (B.type === 'treatment' && !B.sel.length) || tooMany; B.date = B.time = null; B.slots = null;
    };
    box.onchange = upd; upd();
  }
  if (B.step === 2) {
    const list = [{ id: 'any', name: 'No preference', role: 'First available specialist' }].concat(PRACS.filter(p => p.bookable));
    box.innerHTML = `<h3>Who would you like to see?</h3><p class="muted">Choose “No preference” for the most available times.</p><div style="margin-top:18px">${list.map(p => `<label class="opt"><input type="radio" name="pr" value="${p.id}" ${String(B.prac) === String(p.id) ? 'checked' : ''}><span><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span></label>`).join('')}</div>${nav(true)}`;
    box.onchange = () => { B.prac = $('input[name=pr]:checked').value; B.date = B.time = null; B.slots = null; };
  }
  if (B.step === 3) renderCalendar(box, nav);
  if (B.step === 4) renderSlots(box, nav);
  if (B.step === 5) renderForm(box, nav);
  if (B.step === 6) {
    box.innerHTML = `<h3>Review &amp; confirm</h3><p class="muted">Please check the details below.</p>${summaryHTML({ type: B.type, service: serviceName(), practitioner: B.prac === 'any' ? 'First available' : pracName(B.prac), date: B.date, start: B.time, price: bookPrice(), client: B.resched ? null : B.form })}
      <p class="note">Cancellation policy: please give at least ${S.booking.cancelHours} hours' notice to cancel or reschedule.</p>
      <div class="nav-row"><button class="btn line" id="bBack">${t('back')}</button><button class="btn gold" id="bConfirm">${B.resched ? 'Confirm new time' : 'Confirm booking'}</button></div>`;
    $('#bConfirm').onclick = confirmBooking;
  }
  wireNav();
}
function wireNav() {
  const bn = $('#bNext'), bb = $('#bBack');
  if (bn) bn.onclick = () => { if (B.step === 5 && !validateForm()) return; B.step = B.resched && B.step === 4 ? 6 : B.step + 1; renderBook(); scrollTo({ top: 0 }); };
  if (bb) bb.onclick = () => { if (B.step === 5) collectForm(); B.step = B.resched && B.step === 6 ? 4 : B.step - 1; renderBook(); scrollTo({ top: 0 }); };
}

async function renderCalendar(box, nav) {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const now = new Date(), thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now); last.setDate(last.getDate() + S.booking.maxAdvanceDays);
  const head = `<h3>Pick a date</h3><div class="calnav"><button class="icon-btn" id="pm" aria-label="Previous month" ${calMonth <= thisMonth ? 'disabled' : ''}>${ic('chevL')}</button><b>${calMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</b>
    <button class="icon-btn" id="nm" aria-label="Next month" ${new Date(y, m + 1, 1) > last ? 'disabled' : ''}>${ic('chevR')}</button></div>`;
  box.innerHTML = head + '<div class="spin"></div>';
  const wire = () => { $('#pm').onclick = () => { calMonth = new Date(y, m - 1, 1); renderBook(); }; $('#nm').onclick = () => { calMonth = new Date(y, m + 1, 1); renderBook(); }; };
  wire();
  const key = [y, m + 1, B.type, B.sel.join('.'), B.prac, B.resched?.code || ''].join('|');
  let days;
  try { days = monthCache[key] || (monthCache[key] = (await api('/availability/month', { year: y, month: m + 1, prac: B.prac, ...svcBody() })).days); }
  catch (e) { box.innerHTML = head + `<p class="err">${esc(e.message)}</p>` + nav(false); wire(); wireNav(); return; }
  if (B.step !== 3 || !$('#pm')) return;
  const first = new Date(y, m, 1).getDay(), dn = new Date(y, m + 1, 0).getDate();
  let cells = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="dow">${d}</div>`).join('') + '<span></span>'.repeat(first);
  for (let d = 1; d <= dn; d++) { const ds = y + '-' + pad(m + 1) + '-' + pad(d); cells += `<button class="day ${B.date === ds ? 'sel' : ''}" data-d="${ds}" ${days[ds] ? '' : 'disabled'} aria-label="${fmtDate(ds)}">${d}</button>`; }
  const any = Object.values(days).some(Boolean);
  const closed = (S.booking.closedDays || []).map(i => DAYS[i] + 's').join(', ');
  box.innerHTML = head + `<div class="cal">${cells}</div><p class="muted" style="margin-top:14px;font-size:.86rem">${any ? `Faded dates are ${closed ? 'closed (' + closed + '), ' : ''}fully booked or not yet open for booking.` : 'No free dates this month – try the next month.'}</p>${nav(!!B.date)}`;
  wire(); wireNav();
  $$('.day', box).forEach(b => b.onclick = () => { B.date = b.dataset.d; B.time = null; B.slots = null; B.step = 4; renderBook(); });
}

async function renderSlots(box, nav) {
  const head = `<h3>Choose a time</h3><p class="muted">${fmtDate(B.date)}</p>`;
  box.innerHTML = head + '<div class="spin"></div>';
  try { if (!B.slots) B.slots = (await api('/availability/day', { date: B.date, prac: B.prac, ...svcBody() })).slots; }
  catch (e) { box.innerHTML = head + `<p class="err">${esc(e.message)}</p>` + nav(false); wireNav(); return; }
  if (B.step !== 4) return;
  const sl = B.slots, groups = [['Morning', s => s.t < 720], ['Afternoon', s => s.t >= 720 && s.t < 1020], ['Evening', s => s.t >= 1020]];
  box.innerHTML = head + groups.map(([n, f]) => { const g = sl.filter(f); return g.length ? `<p class="eyebrow" style="margin-top:18px">${n}</p><div class="slots">${g.map(s => `<button class="slot ${B.time === s.t ? 'sel' : ''}" data-t="${s.t}" ${s.ok ? '' : 'disabled'}>${fmtTime(s.t)}</button>`).join('')}</div>` : ''; }).join('')
    + `${sl.some(s => s.ok) ? '' : '<p class="err" style="margin-top:14px">No times left on this day. Please go back and pick another date.</p>'}${nav(B.time != null)}`;
  $$('.slot', box).forEach(b => b.onclick = () => { B.time = Number(b.dataset.t); $$('.slot', box).forEach(x => x.classList.toggle('sel', x === b)); $('#bNext').disabled = false; });
  wireNav();
}

function summaryHTML(b) {
  return `<dl class="sum"><div><dt>Service</dt><dd>${esc(b.service)}</dd></div><div><dt>Specialist</dt><dd>${esc(b.practitioner)}</dd></div>
  <div><dt>Date</dt><dd>${fmtDate(b.date)}</dd></div><div><dt>Time</dt><dd>${fmtTime(b.start)}</dd></div>
  <div><dt>Estimated total</dt><dd>${Number(b.price) ? peso(b.price) + ' <span class="muted" style="font-weight:400">· pay at the clinic</span>' : 'Free'}</dd></div>
  ${b.client ? `<div><dt>Your details</dt><dd>${esc(b.client.name)}<br><span class="muted" style="font-weight:400">${esc(b.client.phone)} · ${esc(b.client.email)}</span></dd></div>` : ''}</dl>`;
}

function renderForm(box, nav) {
  const f = B.form || {}; const v = k => esc(f[k] || '');
  box.innerHTML = `<h3>Your details</h3><p class="muted">This helps us keep your treatment safe. Only our clinic team can see it.</p><form id="frm" novalidate>
  <label class="f" for="name">Full name *</label><input type="text" id="name" autocomplete="name" maxlength="120" value="${v('name')}"><div class="err" data-e="name"></div>
  <div class="row2" style="display:grid;gap:0 14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
   <div><label class="f" for="phone">Mobile number *</label><input type="tel" id="phone" autocomplete="tel" placeholder="09XX XXX XXXX" value="${v('phone')}"><div class="err" data-e="phone"></div></div>
   <div><label class="f" for="email">Email *</label><input type="email" id="email" autocomplete="email" value="${v('email')}"><div class="err" data-e="email"></div></div></div>
  <label class="f" for="age">Age *</label><input type="number" id="age" min="12" max="100" inputmode="numeric" style="max-width:140px" value="${v('age')}"><div class="err" data-e="age"></div>
  <label class="f" for="concerns">What would you like help with? *</label><textarea id="concerns" maxlength="1500" placeholder="e.g. acne scars, dark underarms, unwanted hair">${v('concerns')}</textarea><div class="err" data-e="concerns"></div>
  <label class="f" for="allergies">Allergies or medical conditions * <span class="muted" style="font-weight:400">– write “None” if none</span></label><textarea id="allergies" maxlength="1500">${v('allergies')}</textarea><div class="err" data-e="allergies"></div>
  <label class="f">Pregnant or breastfeeding? *</label>
  <div style="display:flex;gap:10px"><label class="opt" style="flex:1"><input type="radio" name="preg" value="No" ${f.pregnant === 'No' ? 'checked' : ''}><span>No</span></label><label class="opt" style="flex:1"><input type="radio" name="preg" value="Yes" ${f.pregnant === 'Yes' ? 'checked' : ''}><span>Yes</span></label></div><div class="err" data-e="preg"></div>
  <label class="f" for="meds">Current medications * <span class="muted" style="font-weight:400">– write “None” if none</span></label><input type="text" id="meds" maxlength="1000" value="${v('meds')}"><div class="err" data-e="meds"></div>
  <label class="f" for="notes">Anything else? <span class="muted" style="font-weight:400">(optional)</span></label><textarea id="notes" maxlength="1500">${v('notes')}</textarea>
  <label class="f" for="photo">Photo of your concern <span class="muted" style="font-weight:400">(optional)</span></label><input type="file" id="photo" accept="image/*"><p class="muted" style="font-size:.84rem;margin-top:6px">${B.photo ? 'Selected: ' + esc(B.photo.name) + '. ' : ''}Private – only our clinic team can see it.</p><div class="err" data-e="photo"></div>
  <div class="hp" aria-hidden="true"><label for="website">Website</label><input type="text" id="website" tabindex="-1" autocomplete="off"></div>
  <label class="opt" style="margin-top:20px"><input type="checkbox" id="c1" ${f.c1 ? 'checked' : ''}><span>I agree to the <a href="#privacy" target="_blank">privacy policy</a> and consent to my health information being used for my care. *</span></label><div class="err" data-e="c1"></div>
  <label class="opt"><input type="checkbox" id="c2" ${f.c2 ? 'checked' : ''}><span>I understand results vary, I have shared my medical history truthfully, and I accept the treatment disclaimer. *</span></label><div class="err" data-e="c2"></div>
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
  $$('#frm input,#frm textarea').forEach(i => i.classList.toggle('bad', !!E[i.id]));
  const first = Object.keys(E)[0];
  if (first) { const el = $('[data-e=' + first + ']'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Please check the highlighted fields.'); }
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
  if (!f.c1) E.c1 = 'Please accept the privacy policy to continue.';
  if (!f.c2) E.c2 = 'Please accept the treatment disclaimer to continue.';
  showErrors(E); return !Object.keys(E).length;
}

async function confirmBooking() {
  if (busy) return; busy = true;
  const btn = $('#bConfirm'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    let res;
    if (B.resched) res = await api('/bookings/reschedule', { code: B.resched.code, phone: B.resched.phone, date: B.date, start: B.time, prac: B.prac });
    else {
      const f = B.form;
      const data = { type: B.type, treatmentIds: B.sel, prac: B.prac, date: B.date, start: B.time, website: f.website,
        client: { name: f.name, phone: f.phone, email: f.email, age: f.age, concerns: f.concerns, allergies: f.allergies, pregnant: f.pregnant, medications: f.meds, notes: f.notes, c1: f.c1, c2: f.c2 } };
      if (B.photo) { const fd = new FormData(); fd.append('data', JSON.stringify(data)); fd.append('photo', B.photo); res = await api('/bookings', fd, true); }
      else res = await api('/bookings', data);
    }
    B.done = res.booking; Object.keys(monthCache).forEach(k => delete monthCache[k]);
    renderBook(); scrollTo({ top: 0 });
  } catch (e) {
    if (e.status === 409) { toast(e.message); B.slots = null; B.time = null; B.step = 4; Object.keys(monthCache).forEach(k => delete monthCache[k]); renderBook(); }
    else if (e.status === 422 && e.fields) { B.step = 5; renderBook(); showErrors(e.fields); }
    else { toast(e.message); btn.disabled = false; btn.textContent = B.resched ? 'Confirm new time' : 'Confirm booking'; }
  } finally { busy = false; }
}
function gcalLink(b) {
  const f = m => b.date.replace(/-/g, '') + 'T' + pad(Math.floor(m / 60)) + pad(m % 60) + '00';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(S.site.name + ': ' + b.service) + '&dates=' + f(b.start) + '/' + f(b.end) +
    '&details=' + encodeURIComponent('Reference code: ' + b.code) + '&location=' + encodeURIComponent(S.site.address) + '&ctz=Asia/Manila';
}
function renderConfirmation(box) {
  const b = B.done, confirmed = b.status === 'confirmed';
  $('#stepper').innerHTML = '';
  box.innerHTML = `<div class="done-head"><div class="seal">${ic('check')}</div><h3>${B.resched ? 'Your booking has been moved' : confirmed ? "You're booked" : 'Booking received'}</h3>
  <p class="muted">${confirmed ? 'Your appointment is confirmed.' : 'Status: pending – our team will confirm it shortly.'} Keep your reference code:</p><div class="code">${esc(b.code)}</div></div>
  ${summaryHTML({ ...b })}
  <p class="eyebrow" style="margin:24px 0 8px">Before your visit</p><ul style="padding-left:18px;color:var(--ink-2);font-size:.94rem">${(S.site.preTreatment || []).map(x => `<li style="margin:6px 0">${esc(x)}</li>`).join('')}</ul>
  <div class="nav-row"><a class="btn line" target="_blank" rel="noopener" href="${gcalLink(b)}">${ic('calendar')}Add to Google Calendar</a><a class="btn" href="#home" id="doneBtn">Done</a></div>
  ${b.client?.email ? `<p class="muted" style="text-align:center;margin-top:18px;font-size:.86rem">We'll email the details to ${esc(b.client.email)}. To change your booking, use “My booking” with your code and mobile number.</p>` : ''}`;
  $('#doneBtn').onclick = () => resetBooking();
}

/* ================================================================ my booking (manage) */
function renderManage() {
  const p = $('#p-manage');
  p.innerHTML = `<section class="wrap" style="padding:64px 20px 90px"><div class="manage-grid">
    <div><p class="eyebrow">My booking</p><h1 style="margin:10px 0 16px">Check, move or cancel.</h1>
      <p class="lead">Enter the reference code from your confirmation (it starts with <b>MA-</b>) and the mobile number you booked with.</p>
      <p class="note" style="margin-top:24px">Changes are possible up to ${S.booking.cancelHours} hours before your appointment. After that, please call <a href="${telHref()}">${esc(S.site.phone)}</a>.</p></div>
    <div><div class="panel"><form id="mf" novalidate><label class="f" for="rc" style="margin-top:0">Reference code</label><input type="text" id="rc" placeholder="MA-XXXXXX" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.08em">
      <label class="f" for="rp">Mobile number</label><input type="tel" id="rp" autocomplete="tel" placeholder="09XX XXX XXXX"><div class="err" id="re"></div>
      <div class="nav-row"><span></span><button class="btn" id="rfind">Find my booking</button></div></form></div>
      <div id="rres" style="margin-top:18px"></div></div>
  </div></section>`;
  const code0 = hashParam('code'); if (code0) $('#rc').value = code0.toUpperCase();
  const find = async e => {
    e && e.preventDefault();
    const code = $('#rc').value.trim().toUpperCase(), phone = $('#rp').value.trim();
    if (!code || !phone) { $('#re').textContent = 'Enter your reference code and mobile number.'; return; }
    $('#rfind').disabled = true; $('#re').textContent = '';
    try {
      const { booking: b, canChange } = await api('/bookings/lookup', { code, phone });
      $('#rres').innerHTML = `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">${esc(b.code)}</h3><span class="st ${b.status}">${b.status === 'noshow' ? 'no-show' : b.status}</span></div>
        ${summaryHTML({ ...b, client: null })}
        ${!canChange.ok ? `<p class="note">${esc(canChange.reason)} <a href="${telHref()}">${esc(S.site.phone)}</a></p>`
          : `<div class="nav-row"><button class="btn danger" id="rcan">Cancel booking</button><button class="btn" id="rmove">Choose a new time</button></div>`}</div>`;
      if (!canChange.ok) return;
      $('#rcan').onclick = async () => {
        if (!confirm(`Cancel your ${b.service} on ${fmtDate(b.date)} at ${fmtTime(b.start)}?`)) return;
        $('#rcan').disabled = true;
        try { await api('/bookings/cancel', { code, phone }); toast('Your booking has been cancelled.'); find(); } catch (er) { toast(er.message); $('#rcan').disabled = false; }
      };
      $('#rmove').onclick = () => {
        resetBooking();
        B.resched = { code, phone, price: b.price, service: b.service };
        B.type = b.type; B.prac = 'any'; B.step = 3; location.hash = '#book';
      };
    } catch (er) { $('#re').textContent = er.message; $('#rres').innerHTML = ''; }
    finally { $('#rfind').disabled = false; }
  };
  $('#mf').onsubmit = find;
}

/* ================================================================ start */
(async function init() {
  applyLang();
  try {
    S = await api('/site');
    CATS = S.categories; CATS.forEach(c => c.treatments.forEach(x => { TREAT[x.id] = x; }));
    PRACS = S.practitioners;
    $('#loading').remove();
    renderAll(); route(); observe();
  } catch (e) {
    $('#loading').innerHTML = `<div style="text-align:center;padding:20px"><h2>We couldn't load the page.</h2><p class="muted" style="margin:10px 0 20px">${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => location.reload();
  }
})();
})();

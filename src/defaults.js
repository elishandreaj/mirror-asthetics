// Starting content for a brand-new database. Everything here can be changed later
// from the admin dashboard – you never need to edit this file after first launch.

const site = {
  name: 'Mirror Aesthetics',
  city: 'Bacolod City',
  tagline: 'Reflect your Beauty',
  taglineFil: 'Ipakita ang iyong Ganda',
  metaDescription: 'Mirror Aesthetics, Bacolod City. Facials, slimming, laser hair removal, whitening and spa. Book online.',
  address: 'Door 116 North point Atrium Bldg., B.S Aquino Drive, Bacolod City',
  phone: '0927 650 7729',
  email: 'mgr.mirror@gmail.com',
  hoursShort: 'Mon–Sat · 10:00 AM – 7:00 PM',
  hoursLong: 'Mon–Sat: 10:00 AM – 7:00 PM\nSunday: Closed',
  topIntro: 'Gentle, effective care designed around you.',
  treatmentsIntro: 'Prices are starting rates. Final price is confirmed after consultation.',
  resultsNote: 'Individual results vary depending on skin type, lifestyle, and number of sessions.',
  teamIntro: 'Our licensed and certified team will take care of you.',
  badges: [
    { icon: '🩺', title: 'Licensed doctors', text: 'Care guided by qualified professionals' },
    { icon: '🌿', title: 'Safe products', text: 'Trusted, skin-friendly products' },
    { icon: '✨', title: 'Hygienic clinic', text: 'Sanitised tools and clean rooms' },
  ],
  loyalty: {
    title: 'Refer a friend, earn rewards',
    text: 'Refer a friend and you both get ₱200 off your next treatment. Every 10th visit earns a free Foot Spa.',
    cardTitle: 'Loyalty card',
    cardText: 'Collect a stamp for every completed visit. Ask our team to start your card.',
  },
  mapEmbedUrl: '', // paste the "src" link from Google Maps > Share > Embed a map
  social: { facebook: '', instagram: '', tiktok: '' },
  chat: { whatsapp: '639276507729', viber: '+639276507729', messenger: '' }, // messenger = page username
  preTreatment: [
    'Avoid retinol, AHA/BHA and strong exfoliants for 3 days before facials, laser or microdermabrasion.',
    'Avoid sun exposure and tanning for 1–2 weeks before laser or whitening treatments.',
    'For laser hair removal: shave the area 12–24 hours before. Do not wax or pluck for 4 weeks.',
    'Come with clean skin, no heavy makeup, lotion or perfume on the treatment area.',
    'Drink water and avoid a heavy meal before slimming/cavitation sessions.',
    'Arrive 10 minutes early for your first visit.',
  ],
  privacyText:
    'We collect your name, contact details and health information solely to provide safe treatment and manage appointments. ' +
    'Health information is sensitive personal information under the Philippine Data Privacy Act (RA 10173). It is kept confidential, ' +
    'accessible only to authorised staff, and not shared without your consent. You may request access, correction or deletion of your data ' +
    'by emailing mgr.mirror@gmail.com.\n\nPlease have this policy reviewed by your Data Protection Officer or lawyer before going live.',
};

const booking = {
  openHour: 10, closeHour: 19,      // 10:00 AM – 7:00 PM
  closedDays: [0],                  // 0 = Sunday … 6 = Saturday
  slotStep: 30,                     // minutes between possible start times
  buffer: 15,                       // cleaning/prep minutes after every appointment
  minNoticeMin: 60,                 // earliest online booking = now + this many minutes
  cancelHours: 24,                  // customers can self-cancel/reschedule up to this many hours before
  maxAdvanceDays: 60,               // how far ahead customers can book
  onlineBookingEnabled: true,
  consult: { label: 'Consultation', duration: 30, price: 0, description: 'Skin assessment and treatment plan. Best for first-timers.' },
};

const templates = [
  { key: 'received', name: 'Booking received (auto-email to client)', subject: 'We received your booking – {code}',
    body: 'Hi {name}!\n\nThank you for booking with Mirror Aesthetics. Your request is PENDING – we will confirm it shortly.\n\nService: {service}\nSpecialist: {specialist}\nDate: {date}\nTime: {time}\nReference code: {code}\n\nNeed to change plans? Visit {manage_link} with your code. Please give {cancel_hours} hours\' notice.\n\nSee you soon! ✨\nMirror Aesthetics · {clinic_phone}' },
  { key: 'confirmed', name: 'Booking confirmed (auto-email when staff confirms)', subject: 'Your appointment is confirmed – {date} {time}',
    body: 'Hi {name}! Your {service} at Mirror Aesthetics is CONFIRMED for {date} at {time}. Ref: {code}.\n\nAddress: {clinic_address}\nReschedule/cancel with {cancel_hours}h notice: {manage_link}\n\nSee you soon! ✨' },
  { key: 'reminder', name: '24-hour reminder (auto-email day before)', subject: 'Reminder: your appointment tomorrow at {time}',
    body: 'Hi {name}, a gentle reminder of your appointment tomorrow, {date} at {time} at Mirror Aesthetics, {clinic_address}.\n\nNeed to reschedule? Use code {code} at {manage_link}.' },
  { key: 'rescheduled', name: 'Booking rescheduled (auto-email)', subject: 'Your booking was moved – {date} {time}',
    body: 'Hi {name}, your booking {code} is now on {date} at {time} with {specialist}. Status: {status}.\n\nMirror Aesthetics · {clinic_phone}' },
  { key: 'cancelled', name: 'Booking cancelled (auto-email)', subject: 'Your booking {code} was cancelled',
    body: 'Hi {name}, your booking {code} for {date} at {time} has been cancelled. We hope to see you soon – book again anytime at {site_link}.' },
  { key: 'aftercare', name: 'Post-treatment aftercare (copy & send)', subject: 'Aftercare tips from Mirror Aesthetics',
    body: 'Thank you for visiting, {name}! Aftercare: wear SPF 30+, avoid hot showers/saunas for 24h, skip retinol and exfoliants for 3 days, and keep skin moisturised. Questions? {clinic_phone}.' },
  { key: 'followup', name: 'Follow-up & review request (copy & send)', subject: 'How is your skin feeling?',
    body: 'Hi {name}, how is your skin feeling? We\'d love your feedback — a quick review helps others find us. Book your next session to keep your glow going 💛 {site_link}' },
];

// [name, minutes, price PHP, description, featured]
const catalog = [
  { name: 'Facial & Skin', items: [
    ['Classic Facial', 60, 599, 'Deep cleansing, steam, extraction and relaxing massage.', true],
    ['Hydra Facial', 60, 999, 'Cleanse, exfoliate and hydrate for instant glow.', true],
    ['Classic + Hydra Facial', 90, 1399, 'Our classic facial followed by a hydrating boost.'],
    ['Whitening Facial', 60, 899, 'Brightening care for an even, radiant tone.'],
    ['Anti-aging Facial', 60, 1099, 'Firming and smoothing for fine lines.'],
    ['Anti-acne Facial', 60, 999, 'Calming, purifying care for breakout-prone skin.'],
    ['Galvanic Facial', 45, 799, 'Gentle galvanic current to deep-clean and infuse serums.']] },
  { name: 'Slimming & Toning (Cavitation)', items: [
    ['Radio Frequency – Face', 45, 699, 'Skin tightening and lifting for the face.'],
    ['RF + Cavitation – Arms', 45, 799, 'Tone and contour the upper arms.'],
    ['RF + Cavitation – Tummy', 60, 999, 'Target stubborn tummy fat and firm skin.'],
    ['RF – Love Handles', 45, 699, 'Contouring for the waist sides.'],
    ['RF + Cavitation – Thigh', 60, 999, 'Smoothing and slimming for thighs.'],
    ['RF – Bra Line', 45, 699, 'Tighten and smooth the bra-line area.'],
    ['Eye Bag Reducer', 30, 599, 'Depuffs and brightens the eye area.']] },
  { name: 'Diode Laser Hair Removal – Women', items: [
    ['Upper Lip', 15, 299, 'Quick, gentle laser for fine facial hair.'],
    ['Face', 30, 599, 'Full-face laser hair reduction.'],
    ['Underarm', 15, 399, 'Smooth, long-lasting underarm results.'],
    ['Upper / Lower Arms', 30, 899, 'Full-arm hair reduction.'],
    ['Brazilian', 30, 999, 'Full intimate-area laser treatment.'],
    ['Bikini Line', 30, 699, 'Tidy bikini-line hair removal.'],
    ['Upper / Lower Legs', 45, 1499, 'Full-leg hair reduction.', true]] },
  { name: 'Diode Laser Hair Removal – Men', items: [
    ['Mustache', 15, 299, 'Precise laser for the mustache area.'],
    ['Beard', 30, 699, 'Shape and reduce beard growth.'],
    ['Face (Men)', 30, 599, 'Full-face laser hair reduction.'],
    ['Upper / Lower Arms (Men)', 30, 999, 'Full-arm hair reduction.'],
    ['Under Arms (Men)', 15, 399, 'Smooth underarm results.'],
    ['Chest / Abdomen', 45, 1299, 'Chest and abdomen hair reduction.'],
    ['Upper / Lower Legs (Men)', 45, 1599, 'Full-leg hair reduction.']] },
  { name: 'Whitening Treatments (Micro Dermabrasion)', items: [
    ['Face', 45, 699, 'Exfoliates dull skin for a brighter complexion.'],
    ['Neck', 30, 499, 'Brightens and smooths the neck.'],
    ['Underarm', 30, 499, 'Lightens dark underarms.'],
    ['Elbow', 20, 349, 'Softens and lightens elbows.'],
    ['Knee', 20, 349, 'Softens and lightens knees.'],
    ['Bikini Line (Whitening)', 30, 549, 'Gentle brightening for the bikini line.'],
    ['Butt', 40, 699, 'Evens tone and smooths skin.']] },
  { name: 'Spa Services', items: [
    ['Basic Manicure', 30, 199, 'Nail shaping, cuticle care and polish.'],
    ['Basic Pedicure', 45, 249, 'Nail care, scrub and polish for feet.'],
    ['Foot Spa', 30, 299, 'Soak, scrub and moisturise.'],
    ['Foot Massage', 30, 299, 'Relaxing foot massage.'],
    ['Manicure + Pedicure', 75, 399, 'Hands and feet pampering.'],
    ['Pedicure + Foot Spa', 75, 499, 'Pedicure with a luxurious foot spa.'],
    ['Manicure + Pedicure + Foot Spa', 105, 649, 'The complete hands-and-feet treat.'],
    ['Back Massage (30 mins)', 30, 349, 'Eases tension in the back and shoulders.'],
    ['Foot Massage (30 mins)', 30, 349, 'Half-hour reflexology-style foot massage.'],
    ['Swedish Massage (1 hr full body)', 60, 699, 'Classic relaxing full-body massage.'],
    ['Swedish + Shiatsu (1 hr full body)', 60, 799, 'Swedish strokes with shiatsu pressure.'],
    ['Ventosa (30 mins + 15 mins Swedish)', 45, 499, 'Cupping therapy plus a short Swedish massage.'],
    ['Ventosa + Swedish Massage', 60, 699, 'Cupping therapy with a full Swedish massage.']] },
];

const practitioners = [
  { name: 'Jasmine', role: 'Aesthetic Therapist', credentials: 'Certified Aesthetician', specialties: 'Facials, whitening, skin analysis' },
  { name: 'Nicole', role: 'Laser & Body Specialist', credentials: 'Certified Laser Technician', specialties: 'Diode laser, RF & cavitation' },
  { name: 'Nicole Joy', role: 'Spa & Wellness Therapist', credentials: 'Licensed Massage Therapist', specialties: 'Massage, ventosa, nails & foot spa' },
];

const promos = [
  { chip: 'PROMO', title: 'Buy 5, get 1 free', body: 'On any laser hair removal area. Use within 6 months.' },
  { chip: 'PACKAGE', title: 'Glow Bundle', body: '3 Hydra Facials + 1 Whitening Facial at a bundled rate.' },
  { chip: 'NEW CLIENT', title: 'Free consultation', body: 'Skin assessment and a personalised plan, on us.' },
];

const testimonials = [
  { quote: 'My skin has never felt this calm and glowing.', author: 'Client, Bacolod' },
  { quote: 'Clean clinic, very gentle team. Painless laser!', author: 'Client, Talisay' },
  { quote: 'Booking online was so easy from my phone.', author: 'Client, Silay' },
];

const faqs = [
  ['Is there downtime?', 'Most facials, slimming and spa services have none. Mild redness after microdermabrasion or laser usually settles within hours to a day or two.'],
  ['Does it hurt?', 'Most clients feel mild warmth or a light snapping sensation with laser. Cooling is used for comfort. Tell your practitioner if you need a break.'],
  ['Are treatments safe?', 'Yes. We use trusted products, sanitised equipment and screen every client first. Share your full medical history and allergies when booking.'],
  ['Can I get treated if pregnant or breastfeeding?', 'Laser, cavitation, radio frequency and some massage techniques are not advised during pregnancy. Please tell us when you book and we will suggest safe options. A doctor\'s clearance may be required.'],
  ['What aftercare do I need?', 'Avoid direct sun, wear SPF 30+, skip hot showers/saunas for 24 hours, and avoid retinol or exfoliants for 3 days unless advised. You\'ll get a full aftercare message after your visit.'],
  ['How do I reschedule or cancel?', 'Use the “Manage booking” page with your reference code. Please give at least 24 hours\' notice.'],
];

module.exports = { site, booking, templates, catalog, practitioners, promos, testimonials, faqs };

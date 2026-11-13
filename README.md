# Mirror Aesthetics – Website, Online Booking & Staff Dashboard

A complete, production-ready website for **Mirror Aesthetics (Bacolod City)**, built from your original design.

| Part | What it does |
|---|---|
| **Customer website** (`/`) | Home, Treatments & prices, Before/After results, Team, FAQ, Contact + map, Privacy, EN/FIL toggle, floating chat (WhatsApp/Viber/Messenger/Call) |
| **Online booking** (`/#book`) | 6-step booking: service → specialist → date → time → intake form (with optional photo) → confirm. Real-time availability, no double-booking, reference code, Google Calendar button |
| **Manage booking** (`/#manage`) | Clients reschedule or cancel with their code + phone (respects your cancellation window) |
| **Staff dashboard** (`/admin`, or your private `ADMIN_PATH`) | Collapsible sidebar, today view, bookings list & search, calendar, manual/walk-in bookings, confirm/complete/cancel/no-show, staff notes, reschedule, copy-paste message templates, CSV export, block holidays/time off, **before & after photos picked per treatment**, edit treatments & prices, team (with photos), promos, reviews, FAQ, all website text & contact details, booking rules, staff accounts, activity log |
| **Emails (optional)** | Booking received, confirmed, rescheduled, cancelled, 24-hour reminder, plus a "new booking" alert to the clinic |

**Tech:** Node.js 20 + Express · PostgreSQL · plain HTML/CSS/JS (no build step). Photos are resized automatically and stored in the database, so you only need **two things** to run it: the app and a Postgres database.

---

## Contents
1. [Run it on your computer (5 minutes)](#1-run-it-on-your-computer)
2. [Put it online – Option A: Render + Neon (easiest, recommended)](#2-option-a--render--neon-recommended)
3. [Put it online – Option B: Your own VPS with Docker](#3-option-b--your-own-vps-docker)
4. [Connect your domain name](#4-connect-your-domain-name)
5. [Turn on emails](#5-turn-on-emails)
6. [First login & go-live checklist](#6-first-login--go-live-checklist)
7. [Backups, updates & maintenance](#7-backups-updates--maintenance)
8. [Security & privacy notes](#8-security--privacy-notes)
9. [Troubleshooting](#9-troubleshooting)
10. [Project structure & API](#10-project-structure--api)

**Already deployed an earlier version?** See **[docs/UPDATE-YOUR-SITE.md](docs/UPDATE-YOUR-SITE.md)**.

**Want to host it for ₱0?** Follow **[docs/DEPLOY-FREE.md](docs/DEPLOY-FREE.md)** (Render free + Neon free + Brevo free + a keep-awake monitor).

Staff instructions are in **[docs/STAFF-GUIDE.md](docs/STAFF-GUIDE.md)** – print it for the front desk.

---

## 1. Run it on your computer

**You need:** [Node.js 20+](https://nodejs.org) and a PostgreSQL database. The quickest way to get a database is a free [Neon](https://neon.tech) project (copy its connection string), or install PostgreSQL locally / run `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mirror postgres:16`.

```bash
cd mirror-aesthetics
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env` for local use:

```ini
NODE_ENV=development
PUBLIC_URL=http://localhost:3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mirror   # or your Neon URL
DATABASE_SSL=false            # true if using Neon
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=SomethingStrong123
```

```bash
npm run dev
```

Open **http://localhost:3000** (website) and **http://localhost:3000/admin** (staff dashboard).
On first start the app automatically creates all tables, loads your treatments/team/FAQ from the original design, and creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 2. Option A – Render + Neon (recommended)

Best for a small clinic: no server to maintain, automatic HTTPS, automatic deploys from GitHub. Both have free tiers to try it out; for a real business use Render's paid **Starter** instance so the site never "sleeps" (check current prices on [render.com/pricing](https://render.com/pricing) and [neon.tech/pricing](https://neon.tech/pricing)).

### Step 1 – Put the code on GitHub
1. Create a free account at [github.com](https://github.com) → **New repository** → name it `mirror-aesthetics` → **Private** → Create.
2. Upload the project (drag-and-drop the folder contents on the repo page, **except** `node_modules` and `.env`), or with Git:
   ```bash
   git init && git add . && git commit -m "Mirror Aesthetics website"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/mirror-aesthetics.git
   git push -u origin main
   ```

### Step 2 – Create the database (Neon)
1. Sign up at [neon.tech](https://neon.tech) → **Create project** → name `mirror` → region **Asia Pacific (Singapore)** → Postgres 16.
2. On the dashboard click **Connect**, copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`).

### Step 3 – Create the web service (Render)
1. Sign up at [render.com](https://render.com) with your GitHub account.
2. **New → Blueprint** → choose your `mirror-aesthetics` repo. Render reads `render.yaml` and asks for the secret values:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `PUBLIC_URL` | for now `https://mirror-aesthetics.onrender.com` (change after adding your domain) |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the owner's login (10+ chars, letters and numbers) |
   | `SMTP_*`, `MAIL_FROM` | leave empty for now – see [section 5](#5-turn-on-emails) |

   `JWT_SECRET` is generated automatically.
   *(Alternative without Blueprint: **New → Web Service** → repo → Runtime Node → Build `npm ci --omit=dev` → Start `node src/server.js` → Region Singapore → add the variables above plus `NODE_ENV=production`, `DATABASE_SSL=true`, `TZ=Asia/Manila`, and a 64-character random `JWT_SECRET`.)*
3. Click **Apply / Create**. After 2–3 minutes the log shows `Mirror Aesthetics running…`. Open the `.onrender.com` link – your site is live.

From now on, every change you push to GitHub redeploys automatically.

---

## 3. Option B – Your own VPS (Docker)

Use this if you prefer one fixed monthly server (e.g. DigitalOcean, Vultr, Linode, Hostinger VPS, AWS Lightsail). 1 GB RAM / 1 vCPU / Ubuntu 22.04 or 24.04 is enough. Choose a **Singapore** location.

```bash
# 1. On the server (as root or with sudo)
curl -fsSL https://get.docker.com | sh
git clone https://github.com/YOUR-USERNAME/mirror-aesthetics.git /opt/mirror-aesthetics
cd /opt/mirror-aesthetics

# 2. Settings
cp .env.example .env
nano .env
#   PUBLIC_URL=https://www.yourdomain.ph
#   POSTGRES_PASSWORD=<long random password>
#   JWT_SECRET=<run: openssl rand -hex 48>
#   ADMIN_EMAIL / ADMIN_PASSWORD
#   (DATABASE_URL and DATABASE_SSL are set by docker-compose – you can leave them)

# 3. Your domain
nano Caddyfile          # replace mirroraesthetics.ph with your domain

# 4. Start everything (app + database + HTTPS)
docker compose up -d --build
docker compose logs -f app     # Ctrl+C to exit the log
```

Point your domain to the server's IP first (section 4) – Caddy then gets a free HTTPS certificate automatically.

Firewall: allow only ports 22, 80 and 443 (`ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`).

---

## 4. Connect your domain name

Buy a domain (e.g. `mirroraesthetics.ph` from dot.ph, or a `.com` from Namecheap/Cloudflare/GoDaddy), then in its **DNS settings**:

**Render:** in Render → your service → **Settings → Custom Domains** → add `www.yourdomain.ph` and `yourdomain.ph`. Render shows the exact records, usually:

| Type | Name | Value |
|---|---|---|
| CNAME | `www` | `mirror-aesthetics.onrender.com` |
| A (or ALIAS/ANAME) | `@` | the IP Render shows |

**VPS:** two **A** records, `@` and `www`, pointing to your server's IP.

DNS can take a few minutes up to 24 hours. Then **update `PUBLIC_URL`** to `https://www.yourdomain.ph` (Render → Environment, or `.env` on the VPS followed by `docker compose up -d`) so links in emails are correct.

Also recommended:
- Add the site to **Google Search Console** and **Google Business Profile** (put the website link on your Maps listing).
- Put the website link on your Facebook/Instagram pages.

---

## 5. Turn on emails

> **On Render's free plan, SMTP (Gmail) is blocked** – use the Brevo API option instead: set `BREVO_API_KEY` and `MAIL_FROM` (see docs/DEPLOY-FREE.md, step 5). Brevo also works on paid plans/VPS.

Emails are optional – without them staff use **"Copy message"** in a booking and send it by SMS/Viber/Messenger. With them, clients get automatic confirmations and a 24-hour reminder, and the clinic gets a "new booking" alert.

**Easiest: Gmail (good for up to ~100 emails/day)**
1. Use the clinic Gmail (e.g. `mgr.mirror@gmail.com`). Turn on **2-Step Verification** in your Google Account.
2. Go to **myaccount.google.com/apppasswords**, create an App Password named "Website", copy the 16 letters.
3. Set these variables (Render → Environment, or `.env` on VPS) and redeploy/restart:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=mgr.mirror@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM="Mirror Aesthetics <mgr.mirror@gmail.com>"
   ```

**More professional / higher volume:** a transactional email service such as Brevo, Mailgun, Postmark or Amazon SES with your own domain (they give you SMTP host/user/password – use port 587, `SMTP_SECURE=false`). Add the SPF/DKIM DNS records they give you so emails don't land in spam.

Edit the wording of every email in **Dashboard → Clinic info & settings → Message templates**.

---

## 6. First login & go-live checklist

1. Open `https://yourdomain/admin` (or your `ADMIN_PATH`), sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The public site has no link to it – bookmark it.
2. **My password** → change the password (then you can remove `ADMIN_PASSWORD` from the environment variables).
3. **Staff accounts** → create one login **per employee** (role *Staff*; only owners/managers get *Admin*).
4. **Clinic info & settings** → check address, phone, hours, social & chat links, paste the **Google Maps embed link**, review the **privacy policy**, set the **booking rules** (opening hours, closed days, buffer, cancellation hours).
5. **Treatments & prices** → confirm every price and duration (the starting prices from the design are placeholders).
6. **Team** → real names, credentials and photos; untick "Takes bookings" for anyone who shouldn't be booked online.
7. **Results photos** → upload real before/after photos (with written client consent).
8. **Promos · Reviews · FAQ** → update or remove the sample text. Use **real** client reviews only.
9. **Block times** → add upcoming holidays.
10. Make a **test booking** on your phone, confirm it in the dashboard, then delete it (Bookings → Open → Delete permanently).
11. Have your **Data Protection Officer / lawyer review the privacy policy** (RA 10173 – health information is sensitive personal information) and consider registering with the National Privacy Commission if required.

---

## 7. Backups, updates & maintenance

**Backups**
- **Neon:** has automatic point-in-time restore (history length depends on your plan). For extra safety, once a month: Neon → your project → **Backup & Restore**, or run `pg_dump "<DATABASE_URL>" > backup.sql` from any computer with PostgreSQL tools.
- **VPS:** run `scripts/backup.sh` daily with cron (`crontab -e` → `0 2 * * * /opt/mirror-aesthetics/scripts/backup.sh`). Copy the `backups/` folder off the server regularly (e.g. to Google Drive). Restore: `gunzip -c backups/FILE.sql.gz | docker compose exec -T db psql -U mirror mirror`.
- Staff can also download bookings any time: **Bookings → Export CSV**.

**Updating the site**
- **Render:** push changes to GitHub → it redeploys automatically.
- **VPS:** `cd /opt/mirror-aesthetics && git pull && docker compose up -d --build`.
- Database changes are applied automatically on start (`src/migrations/*.sql`, run once each, in order). To add one, create `002_something.sql` – never edit an old migration.

**Forgot the admin password?** Another admin can reset it in *Staff accounts*. If nobody can log in, run this on the server, or on any computer with the project and `DATABASE_URL` set (Render's free plan has no shell):
`npm run create-admin -- owner@example.com "Owner Name" "NewPassword123"`

**Health check:** `https://yourdomain/healthz` returns `{"ok":true}` when the app and database are fine; `/ping` answers without touching the database (use it for keep-awake monitors). Free uptime monitors (UptimeRobot, Better Stack) can watch this URL and text you if the site goes down.

---

## 8. Security & privacy notes

What's built in:
- Staff passwords hashed with bcrypt; login sessions in secure, HTTP-only cookies; login rate-limited; inactive accounts can be disabled instantly.
- Two roles: **Staff** (bookings, blocks, results photos) and **Admin** (everything incl. prices, website text, settings, accounts).
- Activity log of every staff change.
- Clients' health details and concern photos are **only visible inside the dashboard**; concern photos are never publicly reachable. Uploaded photos have location/EXIF data removed.
- Prices and durations are always calculated on the server; bookings use a database lock so two people can never take the same slot.
- Security headers (CSP, HSTS, etc.), request size limits, booking/lookup rate limits, a spam-bot honeypot, and all user text is escaped (no HTML injection).
- "Delete permanently" in a booking removes the client's data (for data-deletion requests).

Your responsibilities:
- Use HTTPS only (automatic on Render / with Caddy).
- One account per employee; disable accounts when someone leaves.
- Only publish before/after photos with **written consent**.
- Keep `JWT_SECRET`, database and SMTP passwords secret; never commit `.env` to GitHub.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Render log: `Startup failed – check DATABASE_URL` | Wrong connection string, or `DATABASE_SSL` should be `true` for Neon. |
| `FATAL: JWT_SECRET must be set` | Add a random 32+ character `JWT_SECRET` (Render generates it with the Blueprint). |
| "No users yet" in log / can't log in | Set `ADMIN_EMAIL` + `ADMIN_PASSWORD` and restart, or run `npm run create-admin`. |
| All days greyed out in booking | Check Settings → booking rules (opening hours, closed days, "Online booking is ON"), Team → at least one person "Takes bookings", and Block times. |
| Times are off by 8 hours | Make sure `TZ=Asia/Manila` is set. |
| Emails not arriving | Check SMTP variables; Gmail needs an **App Password**; look in spam; Render log shows `Email failed: …`. |
| Site slow to open the first time | Render **free** plan sleeps when idle – upgrade to Starter. |
| Map doesn't show | Use Google Maps → Share → **Embed a map** and paste only the link inside `src="…"` (starts with `https://www.google.com/maps/embed`). |
| Photo upload fails | Max 8 MB (change `MAX_UPLOAD_MB`); JPG/PNG/WEBP/HEIC only. |

---

## 10. Project structure & API

```
mirror-aesthetics/
├─ public/                 ← what the browser loads
│  ├─ index.html           customer website (your design)
│  ├─ admin/index.html     staff dashboard
│  └─ assets/              site.css, site.js, admin.css, admin.js, favicon
├─ src/
│  ├─ server.js            web server, security headers, routes
│  ├─ config.js            reads environment variables
│  ├─ db.js                database connection + automatic migrations
│  ├─ defaults.js          starting content (only used for a brand-new database)
│  ├─ seed.js              loads starting content + first admin
│  ├─ migrations/          database tables (SQL)
│  ├─ routes/public.js     /api – site content, availability, bookings
│  ├─ routes/admin.js      /api/admin – everything in the dashboard
│  └─ lib/                 availability engine, bookings, auth, email, images, reminders
├─ scripts/                migrate, seed, create-admin, backup.sh
├─ Dockerfile, docker-compose.yml, Caddyfile   ← VPS deployment
├─ render.yaml             ← Render deployment
└─ .env.example            ← all settings explained
```

**Public API** (used by the website): `GET /api/site` · `POST /api/availability/month` · `POST /api/availability/day` · `POST /api/bookings` · `POST /api/bookings/lookup` · `POST /api/bookings/cancel` · `POST /api/bookings/reschedule` · `GET /media/:id` · `GET /healthz`

**Admin API** (`/api/admin/*`, needs login cookie + `X-Requested-With: fetch` header on changes): login/logout/me, dashboard, bookings (list/get/create/update/reschedule/delete/message/email/export.csv), availability, calendar, blocks, gallery, catalog/categories/treatments, practitioners, promos, testimonials, faqs, settings, users, audit.

**How availability works:** an appointment blocks its specialist from `start` to `start + duration + cleaning buffer`. A time is offered if it's inside opening hours, not blocked, at least *minimum notice* from now, and at least one bookable specialist (or the chosen one) is free. "No preference" assigns the first free specialist.

**Google Calendar:** not needed. Clients get an “Add to Google Calendar” button after booking (a plain link, no setup). Staff use the dashboard calendar.

**Ideas for later:** SMS reminders (Semaphore / Twilio), online deposits (PayMongo / GCash), packages & loyalty stamps tracked per client, Google Calendar sync for staff, Facebook Pixel / Google Analytics (add the domains to the CSP in `src/server.js`).

# Deploy Mirror Aesthetics for FREE (₱0/month)

About 30–45 minutes, no coding needed. You'll create **4 free accounts**:

| Service | Used for | Free allowance (check their pages – limits can change) |
|---|---|---|
| **GitHub** | stores the code | free private repositories |
| **Neon** | the database (bookings, content, photos) | 1 GB storage per project, 100 compute-hours/month, sleeps after 5 min idle |
| **Render** | runs the website, free HTTPS, custom domain | 750 instance-hours/month (≈ one site running all month), sleeps after 15 min with no visitors |
| **Brevo** *(optional)* | sends booking emails | 300 emails/day |
| **UptimeRobot** *(optional)* | keeps the site awake + alerts you if it goes down | 5-minute checks |

You only pay if you later buy a **domain name** (optional – you get a free `…onrender.com` address).

> **Honest trade-offs of free hosting**
> - If nobody visits for 15 minutes, Render puts the site to sleep; the next visitor waits ~1 minute. **Step 6 (UptimeRobot) prevents this.**
> - Render free blocks normal email (SMTP), so email goes through **Brevo's API** (step 5).
> - No guaranteed uptime/support. When the clinic is busy, upgrading Render to the paid Starter plan is a one-click change – nothing else changes.

---

## Step 1 – Put the code on GitHub (5 min)
1. Unzip `mirror-aesthetics.zip` on your computer.
2. Go to **github.com** → sign up / log in → top-right **+** → **New repository**.
   - Name: `mirror-aesthetics` · select **Private** · **Create repository**.
3. On the new repo page click **uploading an existing file**.
4. Open the unzipped `mirror-aesthetics` folder, select **everything inside it** (folders `docs`, `public`, `scripts`, `src` and all files) and drag them onto the page.
   *Mac tip: press `Cmd+Shift+.` in Finder to show hidden files like `.gitignore` so they upload too (nice to have, not required).*
5. Wait for the upload to finish → **Commit changes**.
   Check the repo shows `package.json`, `render.yaml`, `src/`, `public/` at the top level (not inside another folder).

## Step 2 – Create the free database on Neon (5 min)
1. Go to **neon.tech** → **Sign up** (you can use your GitHub account).
2. Create a project: name `mirror` · Postgres version **16 or newer** · region **AWS Asia Pacific (Singapore)**.
3. On the project dashboard click **Connect** → copy the **connection string**. It looks like:
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
4. Paste it into a note – you'll need it in Step 3. **Keep it secret** (it's the database password).

## Step 3 – Deploy the website on Render (10 min)
1. Go to **render.com** → **Get Started** → sign up with **GitHub**. Allow Render to see the `mirror-aesthetics` repo.
2. In the Render dashboard: **New +** → **Blueprint** → select `mirror-aesthetics` → **Connect**.
3. Render reads `render.yaml` and asks for values. Fill in:

   | Key | What to type |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 2 |
   | `PUBLIC_URL` | `https://mirror-aesthetics.onrender.com` (you'll confirm the exact address in a moment) |
   | `ADMIN_PATH` | a private address for the staff dashboard, e.g. `mirror-staff-7Q2` (leave empty for `/admin`) |
   | `ADMIN_EMAIL` | the owner's email, e.g. `mgr.mirror@gmail.com` |
   | `ADMIN_PASSWORD` | a strong password, **10+ characters with letters and numbers** |
   | `BREVO_API_KEY` | leave **empty** for now (Step 5) |
   | `MAIL_FROM` | leave **empty** for now |

   (`JWT_SECRET` is created automatically.)
4. Click **Apply**. The first build takes ~3–5 minutes. Open the service → **Logs**; you're done when you see:
   ```
   Migrated 001_init.sql
   Seeded starting content (treatments, team, promos, FAQs).
   Created first admin account: ...
   Mirror Aesthetics running on ...
   ```
5. At the top of the service page you'll see your address, e.g. `https://mirror-aesthetics.onrender.com` (if that name was taken, Render adds letters). If it's different from what you typed, go to **Environment** → edit `PUBLIC_URL` → **Save, rebuild and deploy**.

**Your site is live!** 🎉
- Website: `https://YOUR-ADDRESS.onrender.com`
- Staff dashboard: `https://YOUR-ADDRESS.onrender.com/admin` (or `/your-ADMIN_PATH`). It is **not linked anywhere on the website** – bookmark it on the clinic devices.

> No Blueprint option? Use **New + → Web Service** → pick the repo → Language **Node** → Region **Singapore** → Build Command `npm ci --omit=dev` → Start Command `node src/server.js` → Instance Type **Free** → **Advanced → Health Check Path** `/ping` → add environment variables: the table above plus `NODE_ENV=production`, `DATABASE_SSL=true`, `TZ=Asia/Manila`, and `JWT_SECRET` (click **Generate**).

## Step 4 – First login (5 min)
1. Open your staff address (`/admin` or your `ADMIN_PATH`), sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **My password** → change it. Then in Render → Environment you can delete `ADMIN_PASSWORD` (it's only used the very first time).
3. **Staff accounts** → add a login for each employee.
4. Work through the go-live checklist in the README (prices, team photos, results photos, map, privacy policy, holidays).
5. Make a test booking from your phone, confirm it in the dashboard, then delete it.

## Step 5 – Free booking emails with Brevo (optional, 10 min)
Without this the site works fine – staff use **Copy message** to send confirmations by SMS/Viber/Messenger.
1. Go to **brevo.com** → sign up (free plan).
2. **Senders, domains & dedicated IPs → Senders → Add a sender**: name `Mirror Aesthetics`, email = the clinic email (e.g. `mgr.mirror@gmail.com`) → enter the code Brevo emails you.
3. **SMTP & API → API Keys → Generate a new API key** → name `website` → copy it (starts with `xkeysib-`).
4. In Render → your service → **Environment**:
   - `BREVO_API_KEY` = the key
   - `MAIL_FROM` = `Mirror Aesthetics <mgr.mirror@gmail.com>` (the sender you verified)
   → **Save, rebuild and deploy**.
5. Test: in the dashboard go to **Clinic info & settings → Email → Send test email**. Then make a booking with your own email. You should get "We received your booking", and the clinic email gets "New booking …". In the dashboard the yellow "Email is not set up" note disappears.

**Automatic confirmation:** by default new online bookings arrive as *pending* and the client gets a "we received your booking" email; when staff press **Confirm**, the client gets the "confirmed" email. If you'd rather confirm everyone instantly, switch on **Clinic info & settings → Booking rules → Confirm online bookings automatically** (clients then get the confirmed email straight away).

**Avoiding spam folders:** sending from a free Gmail address through another service can sometimes land in spam. If that happens, get a domain (Step 7) and authenticate it in Brevo (**Senders, domains → Domains → Add a domain**, then add the DNS records it shows) and send from e.g. `bookings@yourdomain.ph`.

## Step 6 – Keep the site awake + get downtime alerts (5 min)
1. Go to **uptimerobot.com** → sign up (free).
2. **+ New monitor** → type **HTTP(s)** → URL: `https://YOUR-ADDRESS.onrender.com/ping` → interval **5 minutes** → alert contact: your email → **Create**.

This visits the site every 5 minutes so it never falls asleep, and emails you if it goes down.
Why `/ping`? It answers **without touching the database**, so the free Neon database can still sleep when nobody is booking (which keeps you well inside Neon's free compute hours).

*Hours check:* one site running all month is about 720–744 hours, which fits within Render's 750 free hours. Run **only this one** free service on your Render account, or the hours may run out before the month ends (then the site pauses until the 1st).

## Step 7 – Your own domain name (optional, the only paid part)
A domain costs roughly a few hundred to ~₱2,000 per year depending on the ending (`.com`, `.ph`, `.com.ph`). Buy from any registrar (e.g. Cloudflare, Namecheap, Porkbun, dot.ph).
1. Render → your service → **Settings → Custom Domains → + Add** → `www.yourdomain.com`, then add `yourdomain.com` too.
2. In your registrar's **DNS** page add the records Render shows (usually a **CNAME** `www` → `YOUR-ADDRESS.onrender.com`, and an **A**/ALIAS record for the root).
3. Wait until Render shows **Verified** and **Certificate issued** (minutes to a few hours).
4. Update `PUBLIC_URL` to `https://www.yourdomain.com` and the UptimeRobot monitor URL.

Free alternative: keep the `onrender.com` address and link to it from your Facebook page, Instagram bio and Google Business Profile.

---

## Keeping it free & safe
- **Backups:** Neon's free plan only keeps a short restore history (hours). Once a week, an admin should do **Bookings → Export CSV** (wide date range) and save it to Google Drive. For a full database copy, from any computer with PostgreSQL tools: `pg_dump "YOUR_NEON_URL" > mirror-backup.sql`.
- **Storage:** photos are compressed (~100–300 KB each), so 1 GB holds thousands of photos and years of bookings. Neon's dashboard shows usage.
- **Monthly check:** Render → Billing → instance hours; Neon → Usage. If you get close to a limit, upgrade only that service.
- **Updates:** change files on GitHub (edit in the browser or upload) → Render redeploys automatically in ~3 minutes.

## When to upgrade (still cheap)
- Render **Starter**: no sleeping, faster, normal SMTP email allowed.
- Neon **Launch**: more compute & longer backups.
Nothing in the code needs to change – only the plan.

## Troubleshooting
| Problem | Fix |
|---|---|
| Build fails | Check `package.json` is at the top of the GitHub repo (not inside a sub-folder). |
| Log says `Startup failed – check DATABASE_URL` | Re-copy the Neon string (must include `?sslmode=require`); `DATABASE_SSL` must be `true`. |
| Log says `No users yet` | `ADMIN_EMAIL`/`ADMIN_PASSWORD` were empty → add them in Environment → redeploy. |
| Site takes ~1 minute to open | It was asleep – set up Step 6. |
| Site says "suspended" near month end | Free hours ran out (more than one free service?). Delete extra free services or upgrade. |
| Emails not sent | Check Render logs for `Brevo 401` (wrong key) or `Brevo 400` (sender not verified). |
| Forgot admin password | Another admin can reset it in **Staff accounts**. If no admin can log in: on any computer with Node.js, unzip the project, open a terminal in the folder and run `npm install`, then `DATABASE_URL="YOUR_NEON_URL" DATABASE_SSL=true npm run create-admin -- owner@example.com "Owner Name" "NewPassword123"` (Windows PowerShell: set the two variables first with `$env:DATABASE_URL="..."; $env:DATABASE_SSL="true"`). |

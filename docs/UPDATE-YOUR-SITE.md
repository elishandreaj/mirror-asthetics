# Updating your live site to the new version

You already deployed the **first version** on Render. Follow this once to switch to the new design and features.
Your bookings, staff accounts, treatments and prices are **kept** – the database is upgraded automatically when the new version starts.

## Does GitHub update the website automatically?
**Yes.** Render watches your GitHub repository. Every time you save (commit) a change there, Render rebuilds and publishes the site in about 3–5 minutes.
To check: Render → your service → **Settings → Build & Deploy → Auto-Deploy** should say **On Commit**. You can follow progress under **Events** / **Logs**.

## Step 1 – Replace the files on GitHub (10 min)
1. Unzip the new `mirror-aesthetics.zip`.
2. Open your repository on github.com.
3. **Delete the old staff page folder** (it moved): open the `public` folder → `admin` folder → `index.html` → click the **⋯** (or trash icon) → **Delete file** → **Commit changes**.
4. Back on the repository's main page click **Add file → Upload files**.
5. Open the unzipped `mirror-aesthetics` folder, select **everything inside it** (`docs`, `public`, `scripts`, `src` and all files) and drag it onto the page. Files with the same name are replaced; new ones are added.
6. Write a message like "New design" → **Commit changes**.

Render now starts deploying. In **Logs** you should see:
```
Migrated 002_results_and_faq_topics.sql
Upgraded FAQ to the new grouped version.
Mirror Aesthetics running on ...
```

## Step 2 – New settings on Render (5 min)
Render → your service → **Environment** → **Add Environment Variable** for each, then **Save, rebuild and deploy**:

| Key | Value | Why |
|---|---|---|
| `ADMIN_PATH` | something private, e.g. `mirror-staff-7Q2` | The staff dashboard moves to `yoursite.onrender.com/mirror-staff-7Q2`. The old `/admin` address then just goes to the home page. Skip this to keep `/admin`. |
| `BREVO_API_KEY` | your Brevo key | Automatic confirmation & reminder emails (see below). |
| `MAIL_FROM` | `Mirror Aesthetics <mgr.mirror@gmail.com>` | The sender clients see (must be verified in Brevo). |

Also: **Settings → Health Check Path** → `/ping` (if it's empty).

## Step 3 – Turn on automatic emails (10 min)
Render's free plan blocks normal Gmail sending, so the site sends through **Brevo** (free, 300 emails/day):
1. Sign up at **brevo.com** (free plan).
2. **Senders, domains & dedicated IPs → Senders → Add a sender** → name `Mirror Aesthetics`, email = clinic email → confirm the code Brevo emails you.
3. **SMTP & API → API Keys → Generate a new API key** → copy it (starts with `xkeysib-`).
4. Put it in Render as `BREVO_API_KEY` (Step 2) and set `MAIL_FROM`.
5. In the dashboard: **Clinic info & settings → Email → Send test email**.

What clients receive:
- Right after booking: "We received your booking" (or "Confirmed" if you turn on *Confirm online bookings automatically*).
- When staff press **Confirm**, move or cancel a booking: an email about the change.
- The day before: a reminder.
- The clinic inbox gets a "New booking" alert.

## Step 4 – Fill in the new bits (10 min)
In the dashboard (**Clinic info & settings**):
- **Social & chat** → paste your Facebook page link (Instagram/TikTok later – their icons appear in the footer once you add the links). Add your Messenger page username so the chat button and FAQ "Message us" work.
- **Clinic details** → check the address – the footer and Visit page map uses it automatically. If the pin lands in the wrong spot, paste an exact Google Maps embed link.
- **Home page** → optional hero photo (shows inside the arch), headline and text.
- **Booking rules** → choose whether to *confirm online bookings automatically*.

## Do I need to connect Google Calendar?
No. After booking, clients see an **Add to Google Calendar** button – it's a simple link that works without any setup. Your team uses the dashboard's **Calendar**.

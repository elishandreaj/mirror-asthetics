-- Mirror Aesthetics – initial schema
-- Times are stored as minutes from midnight (Asia/Manila clinic time); dates as DATE.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Images (gallery, team photos, client concern photos). Stored in Postgres so the
-- app needs no separate file storage. Private images are only served to staff.
CREATE TABLE IF NOT EXISTS media (
  id         UUID PRIMARY KEY,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  width      INT,
  height     INT,
  bytes      INT,
  private    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL,
  sort   INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS treatments (
  id           SERIAL PRIMARY KEY,
  category_id  INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  duration_min INT NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
  price        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  featured     BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort         INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS treatments_cat_idx ON treatments(category_id);

CREATE TABLE IF NOT EXISTS practitioners (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  credentials TEXT NOT NULL DEFAULT '',
  specialties TEXT NOT NULL DEFAULT '',
  photo_id    UUID REFERENCES media(id) ON DELETE SET NULL,
  bookable    BOOLEAN NOT NULL DEFAULT TRUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id                SERIAL PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  type              TEXT NOT NULL CHECK (type IN ('consult','treatment')),
  practitioner_id   INT REFERENCES practitioners(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  start_min         INT NOT NULL,
  duration_min      INT NOT NULL,
  total_min         INT NOT NULL,           -- duration + buffer (blocks the practitioner)
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','completed','cancelled','noshow')),
  source            TEXT NOT NULL DEFAULT 'online',  -- online | walk-in | phone | admin
  client_name       TEXT NOT NULL,
  client_phone      TEXT NOT NULL,
  client_phone_norm TEXT NOT NULL,
  client_email      TEXT NOT NULL DEFAULT '',
  client_age        INT,
  concerns          TEXT NOT NULL DEFAULT '',
  allergies         TEXT NOT NULL DEFAULT '',
  pregnant          TEXT NOT NULL DEFAULT '',
  medications       TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  photo_id          UUID REFERENCES media(id) ON DELETE SET NULL,
  staff_notes       TEXT NOT NULL DEFAULT '',
  consent_at        TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  reminder_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings(date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);

-- Snapshot of treatments on a booking (keeps history even if prices change later)
CREATE TABLE IF NOT EXISTS booking_items (
  id           SERIAL PRIMARY KEY,
  booking_id   INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  treatment_id INT REFERENCES treatments(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  duration_min INT NOT NULL,
  price        NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_items_booking_idx ON booking_items(booking_id);

CREATE TABLE IF NOT EXISTS blocks (
  id              SERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  from_min        INT NOT NULL DEFAULT 0,
  to_min          INT NOT NULL DEFAULT 1440,
  practitioner_id INT REFERENCES practitioners(id) ON DELETE CASCADE, -- NULL = whole clinic
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (to_min > from_min)
);
CREATE INDEX IF NOT EXISTS blocks_date_idx ON blocks(date);

CREATE TABLE IF NOT EXISTS gallery (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  treatment_label  TEXT NOT NULL DEFAULT '',
  caption          TEXT NOT NULL DEFAULT '',
  before_id        UUID REFERENCES media(id) ON DELETE SET NULL,
  after_id         UUID REFERENCES media(id) ON DELETE SET NULL,
  consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  published        BOOLEAN NOT NULL DEFAULT TRUE,
  sort             INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS promos (
  id     SERIAL PRIMARY KEY,
  chip   TEXT NOT NULL DEFAULT '',
  title  TEXT NOT NULL,
  body   TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS testimonials (
  id     SERIAL PRIMARY KEY,
  quote  TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faqs (
  id       SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort     INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id        SERIAL PRIMARY KEY,
  user_id   INT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  details   JSONB,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

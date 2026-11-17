ALTER TABLE bookings
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN aftercare_sent_at TIMESTAMPTZ,
  ADD COLUMN followup_sent_at TIMESTAMPTZ;

CREATE INDEX bookings_completion_email_idx
  ON bookings (completed_at)
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
    AND (aftercare_sent_at IS NULL OR followup_sent_at IS NULL);

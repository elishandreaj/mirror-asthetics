-- v2: link before/after results to a treatment, add session count, group FAQs by topic
ALTER TABLE gallery ADD COLUMN IF NOT EXISTS treatment_id INT REFERENCES treatments(id) ON DELETE SET NULL;
ALTER TABLE gallery ADD COLUMN IF NOT EXISTS sessions TEXT NOT NULL DEFAULT '';
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'General';
CREATE INDEX IF NOT EXISTS gallery_treatment_idx ON gallery(treatment_id);

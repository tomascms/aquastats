-- Migration 005: data imported from official meet files (Lenex / start lists / results PDFs).
-- meet_results.extra: reaction time, source. meet_entries.extra: heat, lane, entry time, event number, session.
ALTER TABLE meet_results ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';
ALTER TABLE meet_entries ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '{}';

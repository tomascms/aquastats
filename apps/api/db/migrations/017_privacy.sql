-- Migration 017: GDPR for minors — parental consent, accepted terms, inactive-account retention.
--
-- * parental_consents: an athlete under 13 (Lei 58/2019, art. 16.º) needs someone with parental responsibility
--   to authorise the processing of health and wellbeing data (sleep, RPE, recovery, heart rate). Until then
--   the API stores none of it (domain/privacy.py). The birth date declared when consent was asked is kept
--   here, so editing the profile later does not lift the block.
--   Read: the user, and the coaches of their team (a coach's heart-rate upload checks the athlete's consent).
--   Write: only the auth flows (aquastats_auth with the bypass): signup, the guardian's link, withdrawal.
-- * users.terms_version / terms_accepted_at: which terms the account accepted, and when.
-- * users.inactivity_notice_at: the 30-day warning before an account inactive for 3 years is deleted.
-- Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_notice_at timestamptz;

CREATE TABLE IF NOT EXISTS parental_consents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date date NOT NULL,
  guardian_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'withdrawn')),
  -- Rotated on every new request: links from older emails stop working.
  nonce text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON parental_consents TO aquastats_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON parental_consents TO aquastats_auth;

ALTER TABLE parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parental_consents_read ON parental_consents;
DROP POLICY IF EXISTS parental_consents_write ON parental_consents;
-- Permissive policies are OR'ed: SELECT sees self + team (coach), writes need the bypass.
CREATE POLICY parental_consents_read ON parental_consents FOR SELECT
  USING (app_bypass_rls() OR user_id = app_user_id() OR (app_role() = 'coach' AND user_id IN (
    SELECT user_id FROM team_members WHERE team_id = app_team_id())));
CREATE POLICY parental_consents_write ON parental_consents
  USING (app_bypass_rls())
  WITH CHECK (app_bypass_rls());

DROP TRIGGER IF EXISTS set_updated_at ON parental_consents;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON parental_consents FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

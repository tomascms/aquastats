-- Migration 017: a version on each account, carried in the access token and checked on every request.
-- Logout, "end all sessions" and a password change or reset bump it, so a 15-minute access token stops
-- working at once instead of when it expires. Tokens signed before this migration carry no version and
-- count as 0, the default here: nobody is logged out by the deploy.
-- RLS: no change. The existing users policies and table grants (011, 012) cover the new column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

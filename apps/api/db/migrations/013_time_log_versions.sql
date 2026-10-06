-- Migration 013: order concurrent edits of the same rep by when they were made on the device.
-- PUT /times is now one INSERT ... ON CONFLICT DO UPDATE (two coaches timing the same cell, a double tap or an
-- offline queue replaying no longer fail with a duplicate key), and an edit older than the stored one is not
-- applied: a late retry from a phone that was offline cannot overwrite a newer time.
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS client_updated_at timestamptz;

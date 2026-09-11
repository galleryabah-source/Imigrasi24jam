-- Imigrasi24jam migration 0008 — inbox leases/recovery
-- Additive. Production execution requires migration verification first.

ALTER TABLE message_inbox
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_message_inbox_claimable
  ON message_inbox (processing_status, received_at, lease_expires_at);

-- A worker may claim RECEIVED messages or reclaim PROCESSING messages whose lease expired.

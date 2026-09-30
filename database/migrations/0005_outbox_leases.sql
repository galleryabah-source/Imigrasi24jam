-- Imigrasi24jam migration 0005 — outbox leases/concurrency safety
-- Additive. Production execution requires migration verification first.

ALTER TABLE message_outbox
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_message_outbox_claimable
  ON message_outbox (delivery_state, next_attempt_at, lease_expires_at);

-- A worker may claim a job when it is pending/retry, or when a previous lease expired.

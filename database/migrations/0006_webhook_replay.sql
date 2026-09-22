-- Imigrasi24jam migration 0006 — durable webhook replay admission
-- Additive. Production execution requires migration verification and owner approval.

CREATE TABLE IF NOT EXISTS webhook_replay (
  key_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_replay_expires_at ON webhook_replay(expires_at);

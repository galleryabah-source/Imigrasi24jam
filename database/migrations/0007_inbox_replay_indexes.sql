-- Supporting indexes for the atomic webhook -> inbox path.
-- Additive only; production execution remains gated by migration verification.
CREATE INDEX IF NOT EXISTS idx_message_inbox_provider_received
  ON message_inbox(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_replay_expires
  ON webhook_replay(expires_at);

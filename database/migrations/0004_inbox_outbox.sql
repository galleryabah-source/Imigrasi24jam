-- Imigrasi24jam migration 0004 — durable inbox/outbox
-- Additive. Production execution requires migration verification first.

CREATE TABLE IF NOT EXISTS message_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  conversation_id text NOT NULL,
  sender text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, provider_message_id)
);

CREATE TABLE IF NOT EXISTS message_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  reply_to_message_id uuid REFERENCES message_inbox(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_state text NOT NULL DEFAULT 'PENDING' CHECK (delivery_state IN ('PENDING','PROCESSING','SENT','RETRY','FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_message_inbox_processing ON message_inbox(processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_message_outbox_delivery ON message_outbox(delivery_state, next_attempt_at);

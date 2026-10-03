-- Imigrasi24jam migration 0006 — hardening four production gates
-- Additive only. Production execution requires migration verification first.

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id text PRIMARY KEY,
  user_id text,
  state text NOT NULL CHECK (state IN ('NEW','CLARIFICATION','RETRIEVAL','ANSWERING','ESCALATION','CLOSED')),
  scope text,
  intent text,
  sub_intent text,
  pending_question text,
  turn_count integer NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_state_updated
  ON conversations (state, updated_at);

CREATE TABLE IF NOT EXISTS conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation
  ON conversation_events (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversation_events_correlation
  ON conversation_events (correlation_id, created_at);

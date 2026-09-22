-- Imigrasi24jam migration 0009 — durable conversation state
-- Additive. Production execution requires migration verification first.

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL UNIQUE,
  user_id text,
  state text NOT NULL DEFAULT 'NEW' CHECK (state IN ('NEW','CLARIFICATION','RETRIEVAL','ANSWERING','ESCALATION','CLOSED')),
  scope text,
  intent text,
  sub_intent text,
  pending_question text,
  turn_count integer NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- One durable row per provider conversation key. Application code uses optimistic
-- versioning so concurrent workers cannot silently overwrite newer state.

-- Imigrasi24jam migration 0010 — audit integrity chain
-- TEST-ONLY / REVIEW. Do not execute against production until approved.
-- Additive only: no DROP/TRUNCATE and no changes to existing audit semantics.

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS sequence_no bigint,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS event_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_events_sequence_no
  ON audit_events(sequence_no)
  WHERE sequence_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_created_id
  ON audit_events(created_at, id);

-- Existing legacy rows intentionally remain unchained (NULL sequence/hash).
-- New chained events must be written transactionally by the audit repository.

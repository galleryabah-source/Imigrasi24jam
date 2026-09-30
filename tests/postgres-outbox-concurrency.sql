-- PostgreSQL integration-test scenario for outbox leasing.
-- Execute against a real PostgreSQL instance after migrations 0004 and 0005.
-- Two sessions should run the CLAIM statement concurrently.

-- Seed independent jobs:
INSERT INTO message_outbox (conversation_id, provider, payload_json)
VALUES ('CONCURRENCY-TEST', 'test-provider', '{"text":"job-1"}'::jsonb),
       ('CONCURRENCY-TEST', 'test-provider', '{"text":"job-2"}'::jsonb),
       ('CONCURRENCY-TEST', 'test-provider', '{"text":"job-3"}'::jsonb);

-- Session A / B: each worker uses a distinct :worker_id parameter.
-- The claim must be atomic and must not return the same active row to two workers.
WITH candidate AS (
  SELECT id
  FROM message_outbox
  WHERE (delivery_state IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
     OR (delivery_state = 'PROCESSING' AND lease_expires_at <= now())
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE message_outbox o
SET delivery_state='PROCESSING',
    lease_owner=:worker_id,
    lease_expires_at=now() + interval '60 seconds',
    attempt_count=o.attempt_count + 1
FROM candidate c
WHERE o.id=c.id
RETURNING o.id, o.lease_owner, o.attempt_count;

-- Recovery assertion after setting lease_expires_at in a test row to the past:
-- SELECT id FROM message_outbox WHERE delivery_state='PROCESSING' AND lease_expires_at <= now();

-- Ownership assertion: finalization must include lease_owner in its WHERE clause.
-- A worker that does not own the lease must update zero rows.

export const CLAIM_PENDING_OUTBOX_SQL = `
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
    lease_owner=$1,
    lease_expires_at=now() + ($2 * interval '1 second'),
    attempt_count=o.attempt_count + 1
FROM candidate c
WHERE o.id=c.id
RETURNING o.*;
`;

export function assertClaimQuerySafety(sql = CLAIM_PENDING_OUTBOX_SQL) {
  const required = ['FOR UPDATE SKIP LOCKED', 'lease_owner', 'lease_expires_at', 'attempt_count'];
  return Object.freeze({ valid: required.every((term) => sql.includes(term)), required });
}

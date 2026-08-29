import test from 'node:test';
import assert from 'node:assert/strict';
import { CLAIM_PENDING_OUTBOX_SQL, assertClaimQuerySafety } from '../src/core/outbox-claim-sql.js';

test('atomic claim contract contains row locking and lease ownership', () => {
  const check = assertClaimQuerySafety(CLAIM_PENDING_OUTBOX_SQL);
  assert.equal(check.valid, true);
});

test('unsafe claim query is rejected by contract check', () => {
  assert.equal(assertClaimQuerySafety('SELECT id FROM message_outbox LIMIT 1').valid, false);
});

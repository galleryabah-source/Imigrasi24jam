import test from 'node:test';
import assert from 'node:assert/strict';
import { requireIdempotencyKey, withIdempotency } from '../src/core/idempotency.js';

function store() {
  const values = new Map();
  return { get: async (key) => values.get(key), set: async (key, value) => values.set(key, value) };
}

test('idempotency key must be bounded and non-empty', () => {
  assert.throws(() => requireIdempotencyKey('short'), /INVALID_IDEMPOTENCY_KEY/);
  assert.doesNotThrow(() => requireIdempotencyKey('1234567890123456'));
});

test('replayed operation returns stored result without executing again', async () => {
  const s = store(); let executions = 0;
  const first = await withIdempotency(s, '1234567890123456', async () => { executions++; return { id: 'K1' }; });
  const second = await withIdempotency(s, '1234567890123456', async () => { executions++; return { id: 'K2' }; });
  assert.equal(first.replay, false);
  assert.equal(second.replay, true);
  assert.deepEqual(second.result, { id: 'K1' });
  assert.equal(executions, 1);
});

test('idempotency store is mandatory', async () => {
  await assert.rejects(() => withIdempotency({}, '1234567890123456', async () => ({})), /IDEMPOTENCY_STORE_REQUIRED/);
});

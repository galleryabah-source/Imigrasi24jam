import test from 'node:test';
import assert from 'node:assert/strict';
import { requireIdempotencyKey, withIdempotency } from '../src/core/idempotency.js';

function atomicStore() {
  const values = new Map();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => values.set(key, value),
    async executeOnce(key, operation) {
      if (values.has(key)) return { replay: true, result: values.get(key) };
      const result = await operation();
      if (values.has(key)) return { replay: true, result: values.get(key) };
      values.set(key, result);
      return { replay: false, result };
    }
  };
}

test('idempotency key must be bounded and non-empty', () => {
  assert.throws(() => requireIdempotencyKey('short'), /INVALID_IDEMPOTENCY_KEY/);
  assert.doesNotThrow(() => requireIdempotencyKey('1234567890123456'));
});

test('replayed operation returns stored result without executing again', async () => {
  const s = atomicStore(); let executions = 0;
  const first = await withIdempotency(s, '1234567890123456', async () => { executions++; return { id: 'K1' }; });
  const second = await withIdempotency(s, '1234567890123456', async () => { executions++; return { id: 'K2' }; });
  assert.equal(first.replay, false);
  assert.equal(second.replay, true);
  assert.deepEqual(second.result, { id: 'K1' });
  assert.equal(executions, 1);
});

test('non-atomic idempotency stores are rejected', async () => {
  const nonAtomic = { get: async () => undefined, set: async () => {} };
  await assert.rejects(() => withIdempotency(nonAtomic, '1234567890123456', async () => ({})), /ATOMIC_IDEMPOTENCY_STORE_REQUIRED/);
});

test('concurrent calls require the atomic store contract', async () => {
  const s = atomicStore(); let executions = 0;
  const operation = async () => {
    executions += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { id: 'ONLY-ONCE' };
  };
  const results = await Promise.all([
    withIdempotency(s, '1234567890123456', operation),
    withIdempotency(s, '1234567890123456', operation)
  ]);
  assert.equal(executions, 1);
  assert.deepEqual(results.map((item) => item.result), [{ id: 'ONLY-ONCE' }, { id: 'ONLY-ONCE' }]);
});

test('idempotency store is mandatory', async () => {
  await assert.rejects(() => withIdempotency({}, '1234567890123456', async () => ({})), /IDEMPOTENCY_STORE_REQUIRED/);
});

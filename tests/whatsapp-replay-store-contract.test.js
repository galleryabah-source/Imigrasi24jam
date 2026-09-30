import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayStoreContract } from '../src/integrations/whatsapp/replay-store-contract.js';

test('replay store requires atomic acceptIfAbsent', async () => {
  const calls = [];
  const store = createReplayStoreContract({
    acceptIfAbsent: async (key, ttl) => { calls.push([key, ttl]); return true; }
  });
  assert.equal(await store.acceptIfAbsent('wa:M1', 300), true);
  assert.deepEqual(calls, [['wa:M1', 300]]);
});

test('invalid replay-store input is rejected', async () => {
  const store = createReplayStoreContract({ acceptIfAbsent: async () => true });
  assert.equal(await store.acceptIfAbsent('', 300), false);
  assert.equal(await store.acceptIfAbsent('wa:M1', 0), false);
});

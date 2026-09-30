import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresDeliveryIdentityResolver, createPostgresDeliveryPersistence } from '../src/core/postgres-delivery-reconciliation.js';

test('postgres delivery identity resolver binds outbox to its inbound message', async () => {
  const queries = [];
  const db = { async query(sql, params) {
    queries.push({ sql, params });
    return { rows: [{
      outbox_id:'O1', conversation_id:'C1', provider:'wa',
      outbound_provider_message_id:'WA-OUT-1', attempt_count:3, inbound_id:'I1',
      inbound_provider_message_id:'WA-IN-1'
    }] };
  }};
  const identity = await createPostgresDeliveryIdentityResolver(db, { provider:'wa' })({
    provider_message_id:'WA-OUT-1'
  });
  assert.equal(identity.inbound_provider_message_id, 'WA-IN-1');
  assert.equal(identity.correlation_id, 'wa:WA-IN-1');
  assert.equal(identity.outbound_provider_message_id, 'WA-OUT-1');
  assert.equal(identity.outbox_id, 'O1');
  assert.equal(identity.attempt, 3);
  assert.equal(identity.idempotency_key, 'wa:O1:C1:3');
  assert.match(queries[0].sql, /JOIN message_inbox/);
});

test('postgres delivery persistence delegates only through canonical outbox repository', async () => {
  let input;
  const persistence = createPostgresDeliveryPersistence({
    async reconcileProviderDelivery(value) { input = value; return { id:'O1', delivery_state:'SENT' }; }
  });
  const result = await persistence({
    identity:{ outbox_id:'O1', idempotency_key:'wa:O1:C1:0', outbound_provider_message_id:'WA-OUT-1' },
    result:{ normalized:{ delivery_state:'SENT' } }
  });
  assert.equal(result.id, 'O1');
  assert.deepEqual(input, {
    outboxId:'O1',
    providerMessageId:'WA-OUT-1',
    idempotencyKey:'wa:O1:C1:0',
    deliveryState:'SENT'
  });
});

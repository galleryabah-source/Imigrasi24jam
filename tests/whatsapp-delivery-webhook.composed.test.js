import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWhatsAppDeliveryWebhook } from '../src/core/whatsapp-delivery-webhook.js';

function makeComposedDb({ terminal = false, auditFailure = false } = {}) {
  const calls = [];
  const state = {
    delivery_state: terminal ? 'SENT' : 'PROCESSING',
    provider_message_id: 'WA-OUT-1',
    attempt_count: 3
  };

  const db = {
    transaction: async (fn) => {
      calls.push('BEGIN');
      try {
        const result = await fn({
          async query(sql, params = []) {
            calls.push({ sql, params });

            if (/FROM message_outbox/.test(sql)) {
              return {
                rows: [{
                  outbox_id: 'O1',
                  conversation_id: 'C1',
                  provider: 'wa',
                  outbound_provider_message_id: state.provider_message_id,
                  inbound_id: 'I1',
                  inbound_provider_message_id: 'WA-IN-1',
                  attempt_count: state.attempt_count
                }]
              };
            }

            if (/UPDATE message_outbox/.test(sql)) {
              if (terminal) return { rows: [] };
              state.delivery_state = params[3];
              return {
                rows: [{
                  id: 'O1',
                  delivery_state: state.delivery_state,
                  provider_message_id: state.provider_message_id
                }]
              };
            }

            if (/SELECT id, delivery_state/.test(sql)) {
              return terminal
                ? { rows: [{ id: 'O1', delivery_state: state.delivery_state, provider_message_id: state.provider_message_id }] }
                : { rows: [] };
            }

            if (/INSERT INTO audit_events/.test(sql)) {
              if (auditFailure) throw new Error('AUDIT_WRITE_FAILED');
              return { rows: [{ id: 'A1' }] };
            }

            throw new Error('UNEXPECTED_SQL');
          }
        });
        calls.push('COMMIT');
        return result;
      } catch (error) {
        calls.push('ROLLBACK');
        throw error;
      }
    }
  };

  return { db, calls, state };
}

function makeProvider(status) {
  return {
    verifyWebhook: async () => ({ valid: true }),
    parseInbound: async () => null,
    parseDeliveryStatus: async () => ({
      status,
      provider_message_id: 'WA-OUT-1',
      idempotency_key: 'wa:O1:C1:3'
    }),
    sendText: async () => ({ provider_message_id: 'WA-OUT-1' }),
    sendAttachment: async () => ({ provider_message_id: 'WA-OUT-1' })
  };
}

test('composed WhatsApp webhook reconciles every canonical provider status through one lifecycle', async () => {
  const expected = {
    ACCEPTED: { state: 'PROCESSING', event: 'DELIVERY_STATUS_RECONCILED' },
    SENT: { state: 'SENT', event: 'DELIVERY_SENT' },
    DELIVERED: { state: 'SENT', event: 'DELIVERY_SENT' },
    READ: { state: 'SENT', event: 'DELIVERY_SENT' },
    FAILED: { state: 'FAILED', event: 'DELIVERY_FAILED' }
  };

  for (const [status, expectation] of Object.entries(expected)) {
    const { db, calls, state } = makeComposedDb();
    const result = await handleWhatsAppDeliveryWebhook({
      db,
      providerAdapter: makeProvider(status),
      request: { raw: status }
    });

    assert.equal(result.status, 'RECONCILED', status);
    assert.equal(result.reconciliation.result.normalized.delivery_state, expectation.state, status);
    assert.equal(result.reconciliation.identity.correlation_id, 'wa:WA-IN-1', status);
    assert.equal(result.reconciliation.identity.idempotency_key, 'wa:O1:C1:3', status);
    assert.equal(result.reconciliation.audit.length, 1, status);
    assert.ok(calls.includes('BEGIN'), status);
    assert.ok(calls.includes('COMMIT'), status);
    assert.equal(state.delivery_state, expectation.state, status);
  }
});

test('composed webhook preserves terminal callback idempotency and emits no second audit', async () => {
  const { db, calls } = makeComposedDb({ terminal: true });
  const result = await handleWhatsAppDeliveryWebhook({
    db,
    providerAdapter: makeProvider('DELIVERED'),
    request: {}
  });

  assert.equal(result.status, 'RECONCILED');
  assert.equal(result.reconciliation.result.no_op, true);
  assert.deepEqual(result.reconciliation.audit, []);
  assert.equal(calls.filter((entry) => typeof entry === 'object' && /INSERT INTO audit_events/.test(entry.sql)).length, 0);
  assert.ok(calls.includes('COMMIT'));
});

test('audit failure rolls back the composed webhook transaction', async () => {
  const { db, calls, state } = makeComposedDb({ auditFailure: true });

  await assert.rejects(
    () => handleWhatsAppDeliveryWebhook({
      db,
      providerAdapter: makeProvider('DELIVERED'),
      request: {}
    }),
    /AUDIT_WRITE_FAILED/
  );

  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.includes('COMMIT'), false);
  assert.equal(state.delivery_state, 'SENT');
});

test('invalid provider status cannot mutate or audit the composed webhook lifecycle', async () => {
  const { db, calls, state } = makeComposedDb();

  await assert.rejects(
    () => handleWhatsAppDeliveryWebhook({
      db,
      providerAdapter: makeProvider('UNKNOWN'),
      request: {}
    }),
    /UNKNOWN_PROVIDER_DELIVERY_STATUS/
  );

  assert.equal(state.delivery_state, 'PROCESSING');
  assert.equal(calls.filter((entry) => typeof entry === 'object' && /UPDATE message_outbox/.test(entry.sql)).length, 0);
  assert.equal(calls.filter((entry) => typeof entry === 'object' && /INSERT INTO audit_events/.test(entry.sql)).length, 0);
  assert.ok(calls.includes('ROLLBACK'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runCanonicalInboundLifecycle } from '../src/core/canonical-message-lifecycle.js';

function makeDb({ duplicate = false, auditFailure = false } = {}) {
  const calls = [];
  const db = {
    async transaction(fn) {
      calls.push('BEGIN');
      try {
        const result = await fn({
          async query(sql, params = []) {
            calls.push({ sql, params });
            if (/INSERT INTO message_inbox/.test(sql)) {
              return duplicate
                ? { rows: [] }
                : { rows: [{
                  id:'00000000-0000-0000-0000-000000000001',
                  conversation_id:'C1',
                  provider_message_id:'WA-IN-1',
                  provider:'wa',
                  processing_status:'PROCESSING'
                }] };
            }
            if (/INSERT INTO message_outbox/.test(sql)) {
              return { rows: [{
                id:'00000000-0000-0000-0000-000000000002',
                conversation_id:'C1',
                reply_to_message_id:'00000000-0000-0000-0000-000000000001',
                delivery_state:'PENDING',
                attempt_count:0
              }] };
            }
            if (/INSERT INTO audit_events/.test(sql)) {
              if (auditFailure) throw new Error('AUDIT_WRITE_FAILED');
              return { rows: [{ id:'A1', created_at:'2026-09-28T00:00:00Z' }] };
            }
            if (/UPDATE message_inbox/.test(sql)) {
              return { rows: [{ id:'00000000-0000-0000-0000-000000000001', processing_status:'PROCESSED' }] };
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
  return { db, calls };
}

test('canonical lifecycle commits inbox → conversation → outbox → audit in one transaction', async () => {
  const { db, calls } = makeDb();
  const result = await runCanonicalInboundLifecycle(db, {
    message: {
      provider:'wa',
      providerMessageId:'WA-IN-1',
      conversationId:'C1',
      sender:'U1',
      text:'syarat paspor',
      correlationId:'CALLER-SUPPLIED-INCORRECT'
    },
    processConversation: async (inbound, context) => {
      assert.equal(inbound.conversation_id, 'C1');
      assert.equal(context.correlationId, 'wa:WA-IN-1');
      return { status:'ANSWER', state:'ANSWERING', conversation_id:'C1', intent:'SERVICE_REQUIREMENTS', text:'Syarat paspor.' };
    }
  });

  assert.equal(result.status, 'COMMITTED');
  assert.equal(result.identity.inbound_id, result.inbound.id);
  assert.equal(result.identity.conversation_id, result.conversation.conversation_id);
  assert.equal(result.identity.outbox_id, result.outbound.id);
  assert.equal(result.identity.correlation_id, 'wa:WA-IN-1');
  assert.equal(result.outbound.reply_to_message_id, result.inbound.id);
  assert.equal(result.audit.length, 4);
  assert.ok(calls.includes('BEGIN'));
  assert.ok(calls.includes('COMMIT'));
  assert.equal(calls.includes('ROLLBACK'), false);
});

test('conversation identity mismatch rolls back before outbox', async () => {
  const { db, calls } = makeDb();
  await assert.rejects(
    () => runCanonicalInboundLifecycle(db, {
      message:{ provider:'wa', providerMessageId:'WA-IN-MISMATCH', conversationId:'C1', sender:'U1', text:'halo' },
      processConversation: async () => ({ status:'ANSWER', state:'ANSWERING', conversation_id:'C2', text:'Jawaban.' })
    }),
    /CONVERSATION_IDENTITY_MISMATCH/
  );
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.some((x) => typeof x === 'object' && /INSERT INTO message_outbox/.test(x.sql)), false);
});

test('duplicate durable inbox admission stops before conversation and outbox', async () => {
  const { db, calls } = makeDb({ duplicate:true });
  let processed = false;
  const result = await runCanonicalInboundLifecycle(db, {
    message:{ provider:'wa', providerMessageId:'WA-IN-1', conversationId:'C1', sender:'U1', text:'halo' },
    processConversation: async () => { processed = true; return null; }
  });
  assert.equal(result.status, 'DUPLICATE');
  assert.equal(processed, false);
  assert.equal(calls.some(entry => typeof entry === 'object' && /message_outbox/.test(entry.sql)), false);
  assert.equal(calls.some(entry => typeof entry === 'object' && /audit_events/.test(entry.sql)), false);
});

test('audit failure rolls back canonical inbox lifecycle', async () => {
  const { db, calls } = makeDb({ auditFailure:true });
  await assert.rejects(
    () => runCanonicalInboundLifecycle(db, {
      message:{ provider:'wa', providerMessageId:'WA-IN-2', conversationId:'C2', sender:'U1', text:'halo' },
      processConversation: async () => ({ status:'ANSWER', state:'ANSWERING', conversation_id:'C2', text:'Jawaban.' })
    }),
    /AUDIT_WRITE_FAILED/
  );
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.includes('COMMIT'), false);
});

test('conversation failure prevents outbox and audit', async () => {
  const { db, calls } = makeDb();
  await assert.rejects(
    () => runCanonicalInboundLifecycle(db, {
      message:{ provider:'wa', providerMessageId:'WA-IN-3', conversationId:'C3', sender:'U1', text:'halo' },
      processConversation: async () => { throw new Error('CONVERSATION_FAILED'); }
    }),
    /CONVERSATION_FAILED/
  );
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.some(entry => typeof entry === 'object' && /message_outbox/.test(entry.sql)), false);
  assert.equal(calls.some(entry => typeof entry === 'object' && /audit_events/.test(entry.sql)), false);
});


test('caller-supplied correlation cannot diverge from canonical inbound identity', async () => {
  const { db } = makeDb();
  let observed;
  const result = await runCanonicalInboundLifecycle(db, {
    message:{ provider:'wa', providerMessageId:'WA-IN-CORR', conversationId:'C9', sender:'U1', text:'halo', correlationId:'WRONG' },
    processConversation: async (inbound, context) => {
      observed = context.correlationId;
      return { status:'ANSWER', state:'ANSWERING', conversation_id:'C9', text:'Jawaban.' };
    }
  });
  assert.equal(result.status, 'COMMITTED');
  assert.equal(observed, 'wa:WA-IN-CORR');
  assert.equal(result.identity.correlation_id, observed);
});

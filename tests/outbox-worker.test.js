import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRetry, createOutboxWorker } from '../src/core/outbox-worker.js';

test('retry uses bounded exponential-style schedule', () => {
  assert.deepEqual(calculateRetry(0), { terminal:false, delay_seconds:30 });
  assert.deepEqual(calculateRetry(1), { terminal:false, delay_seconds:120 });
  assert.deepEqual(calculateRetry(4), { terminal:false, delay_seconds:3600 });
  assert.equal(calculateRetry(5).terminal, true);
});

test('successful delivery marks only outbox as sent', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O1', attempt_count:0, provider:'wa', conversation_id:'C1', payload_json:{ text:'ok' } }; },
      async markOutboundSent(id, providerId, idempotencyKey){ calls.push(['sent',id,providerId,idempotencyKey]); },
      async scheduleOutboundRetry(){ calls.push(['retry']); },
      async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ return { provider_message_id:'P1' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'SENT', id:'O1' });
  assert.deepEqual(calls, [['sent','O1','P1','wa:O1:C1:0']]);
});

test('provider failure schedules retry without rerunning core', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O2', attempt_count:0, provider:'wa', conversation_id:'C2', payload_json:{ text:'retry' } }; },
      async markOutboundSent(){ calls.push(['sent']); },
      async scheduleOutboundRetry(id, delay){ calls.push(['retry',id,delay]); },
      async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(payload){ assert.equal(payload.idempotency_key, 'wa:O2:C2:0'); throw new Error('TIMEOUT'); } }
  });
  assert.deepEqual(await worker.processOne(), { status:'RETRY', id:'O2', delay_seconds:30 });
  assert.deepEqual(calls, [['retry','O2',30]]);
});


test('worker does not report delivery state committed after losing lease ownership', async () => {
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O3', attempt_count:0, provider:'wa', conversation_id:'C3', payload_json:{ text:'lease' } }; },
      async markOutboundSent(){ return false; },
      async scheduleOutboundRetry(){ return false; },
      async markOutboundFailed(){ return false; }
    },
    provider: { async send(){ return { provider_message_id:'P3' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'LEASE_LOST', id:'O3' });
});


test('provider response without delivery identity is rejected before state commit', async () => {
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O4', attempt_count:0, provider:'wa', conversation_id:'C4', payload_json:{ text:'identity' } }; },
      async markOutboundSent(){ throw new Error('MUST_NOT_COMMIT'); },
      async scheduleOutboundRetry(){ throw new Error('MUST_NOT_RETRY'); }
    },
    provider: { async send(payload){ assert.equal(payload.idempotency_key, 'wa:O4:C4:0'); return {}; } }
  });
  await assert.rejects(() => worker.processOne(), /PROVIDER_DELIVERY_IDENTITY_REQUIRED/);
});

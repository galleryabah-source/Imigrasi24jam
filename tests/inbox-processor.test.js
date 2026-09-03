import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxProcessor } from '../src/core/inbox-processor.js';

function answerKnowledge() {
  return [{
    id: 'k1',
    intent: 'PASSPORT_REQUIREMENTS',
    status: 'PUBLISHED',
    direct_answer: 'Silakan siapkan dokumen persyaratan paspor sesuai ketentuan yang berlaku.',
    question_patterns: ['persyaratan paspor'],
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_until: null
  }];
}

test('inbox processor queues an answered message through atomic completion', async () => {
  const calls = [];
  const repository = {
    async claimPendingInbound() {
      return {
        id: 'inbox-1',
        provider: 'whatsapp',
        provider_message_id: 'wamid-1',
        conversation_id: '628123',
        sender: '628123',
        payload_json: { text: 'persyaratan paspor' },
        received_at: new Date().toISOString()
      };
    },
    async completeInboundWithOutbound(input) {
      calls.push(input);
      return { id: 'outbox-1', delivery_state: 'PENDING' };
    },
    async markInboundProcessed() { throw new Error('must use atomic completion for answer'); },
    async markInboundFailed() { throw new Error('unexpected failure'); }
  };

  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => answerKnowledge() });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });

  assert.equal(result.status, 'QUEUED');
  assert.equal(result.inboxId, 'inbox-1');
  assert.equal(result.outboxId, 'outbox-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, 'whatsapp');
  assert.equal(calls[0].replyToMessageId, 'inbox-1');
  assert.equal(calls[0].payload.delivery_state, 'PENDING');
  assert.match(calls[0].payload.text, /persyaratan paspor/i);
});

test('inbox processor never fabricates an answer when retrieval is unavailable', async () => {
  const repository = {
    async claimPendingInbound() {
      return {
        id: 'inbox-2',
        provider: 'whatsapp',
        provider_message_id: 'wamid-2',
        conversation_id: '628124',
        sender: '628124',
        payload_json: { text: 'persyaratan paspor' },
        received_at: new Date().toISOString()
      };
    },
    async markInboundProcessed(id) { assert.equal(id, 'inbox-2'); },
    async markInboundFailed() { throw new Error('unexpected failure'); },
    async completeInboundWithOutbound() { throw new Error('must not queue fallback'); }
  };

  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => [] });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });

  assert.equal(result.status, 'NO_MATCH');
  assert.equal(result.inboxId, 'inbox-2');
});

test('inbox processor marks processing failures without leaking error details to caller', async () => {
  let failedId = null;
  const repository = {
    async claimPendingInbound() {
      return {
        id: 'inbox-3',
        provider: 'whatsapp',
        provider_message_id: 'wamid-3',
        conversation_id: '628125',
        sender: '628125',
        payload_json: { text: 'persyaratan paspor' },
        received_at: new Date().toISOString()
      };
    },
    async markInboundProcessed() {},
    async markInboundFailed(id) { failedId = id; },
    async completeInboundWithOutbound() { throw new Error('db secret failure'); }
  };

  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => { throw new Error('sensitive internal detail'); } });
  const result = await processor.processOne();

  assert.equal(result.status, 'FAILED');
  assert.equal(result.inboxId, 'inbox-3');
  assert.equal(result.reason, 'PROCESSING_ERROR');
  assert.equal(failedId, 'inbox-3');
  assert.equal('message' in result, false);
});

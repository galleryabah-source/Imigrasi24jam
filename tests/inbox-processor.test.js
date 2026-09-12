import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxProcessor } from '../src/core/inbox-processor.js';

function answerKnowledge() {
  return {
    items: [{
      id: 'k1', intent: 'PASSPORT_REQUIREMENTS', status: 'PUBLISHED',
      direct_answer: 'Silakan siapkan dokumen persyaratan paspor sesuai ketentuan yang berlaku.',
      question_patterns: ['persyaratan paspor'], effective_from: '2026-01-01T00:00:00.000Z', effective_until: null
    }],
    evidenceByKnowledgeId: { k1: [{ id: 'e1', status: 'VERIFIED', verified: true, authority: 'Direktorat Jenderal Imigrasi' }] }
  };
}

test('inbox processor queues an answered message through atomic completion', async () => {
  const calls = [];
  const repository = {
    async claimPendingInbound() { return { id: 'inbox-1', provider: 'whatsapp', provider_message_id: 'wamid-1', conversation_id: '628123', sender: '628123', payload_json: { text: 'persyaratan paspor' }, received_at: new Date().toISOString() }; },
    async completeInboundWithOutbound(input) { calls.push(input); return { id: 'outbox-1', delivery_state: 'PENDING' }; },
    async markInboundProcessed() { throw new Error('must use atomic completion for answer'); },
    async markInboundFailed() { throw new Error('unexpected failure'); }
  };
  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => answerKnowledge() });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });
  assert.equal(result.status, 'QUEUED'); assert.equal(result.inboxId, 'inbox-1'); assert.equal(result.outboxId, 'outbox-1');
  assert.equal(calls.length, 1); assert.equal(calls[0].provider, 'whatsapp'); assert.equal(calls[0].replyToMessageId, 'inbox-1');
  assert.equal(calls[0].payload.delivery_state, 'PENDING'); assert.match(calls[0].payload.text, /persyaratan paspor/i);
});

test('inbox processor persists durable conversation and inbox completion atomically for non-answer outcomes', async () => {
  const calls = [];
  const repository = {
    async claimPendingInbound() { return { id: 'inbox-atomic-1', provider: 'whatsapp', provider_message_id: 'wamid-atomic-1', conversation_id: '628199', sender: '628199', payload_json: { text: 'halo' }, received_at: new Date().toISOString() }; },
    async completeInboundWithConversation(input) { calls.push(input); return { inboxId: input.inboxId }; },
    async completeInboundWithOutboundAndConversation() { throw new Error('answer atomic path must not be used'); },
    async markInboundProcessed() { throw new Error('must use durable atomic completion'); },
    async markInboundFailed() { throw new Error('unexpected failure'); },
    async completeInboundWithOutbound() { throw new Error('must not queue'); }
  };
  const conversationRepository = {
    async getOrCreate({ conversationId, userId }) {
      assert.equal(conversationId, '628199'); assert.equal(userId, null);
      return { conversation_id: conversationId, user_id: userId, state: 'NEW', scope: null, intent: null, sub_intent: null, pending_question: null, turn_count: 0, version: 4 };
    }
  };
  const processor = createInboxProcessor({ repository, conversationRepository, knowledgeProvider: async () => [] });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });
  assert.equal(result.status, 'NO_MATCH'); assert.equal(result.inboxId, 'inbox-atomic-1'); assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedConversationVersion, 4); assert.equal(calls[0].conversation.state, 'ESCALATION');
});

test('inbox processor exposes a controlled conflict outcome when conversation version changes concurrently', async () => {
  let failedId = null;
  const repository = {
    async claimPendingInbound() { return { id: 'inbox-concurrent-1', provider: 'whatsapp', provider_message_id: 'wamid-concurrent-1', conversation_id: '628199', sender: '628199', payload_json: { text: 'persyaratan paspor' }, received_at: new Date().toISOString() }; },
    async completeInboundWithOutboundAndConversation() { throw new Error('CONVERSATION_VERSION_CONFLICT'); },
    async completeInboundWithConversation() { throw new Error('CONVERSATION_VERSION_CONFLICT'); },
    async markInboundProcessed() { throw new Error('must not bypass optimistic locking'); },
    async markInboundFailed(id) { failedId = id; },
    async completeInboundWithOutbound() { throw new Error('must not bypass optimistic locking'); }
  };
  const conversationRepository = {
    async getOrCreate() {
      return { conversation_id: '628199', user_id: null, state: 'NEW', scope: null, intent: null, sub_intent: null, pending_question: null, turn_count: 0, version: 7 };
    }
  };
  const processor = createInboxProcessor({ repository, conversationRepository, knowledgeProvider: async () => answerKnowledge() });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.reason, 'PROCESSING_ERROR');
  assert.equal(result.inboxId, 'inbox-concurrent-1');
  assert.equal(failedId, 'inbox-concurrent-1');
});

test('inbox processor never fabricates an answer when retrieval is unavailable', async () => {
  const repository = {
    async claimPendingInbound() { return { id: 'inbox-2', provider: 'whatsapp', provider_message_id: 'wamid-2', conversation_id: '628124', sender: '628124', payload_json: { text: 'persyaratan paspor' }, received_at: new Date().toISOString() }; },
    async markInboundProcessed(id) { assert.equal(id, 'inbox-2'); }, async markInboundFailed() { throw new Error('unexpected failure'); },
    async completeInboundWithOutbound() { throw new Error('must not queue fallback'); }
  };
  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => [] });
  const result = await processor.processOne({ now: '2026-09-03T00:00:00.000Z' });
  assert.equal(result.status, 'NO_MATCH'); assert.equal(result.inboxId, 'inbox-2');
});

test('inbox processor marks processing failures without leaking error details to caller', async () => {
  let failedId = null;
  const repository = {
    async claimPendingInbound() { return { id: 'inbox-3', provider: 'whatsapp', provider_message_id: 'wamid-3', conversation_id: '628125', sender: '628125', payload_json: { text: 'persyaratan paspor' }, received_at: new Date().toISOString() }; },
    async markInboundProcessed() {}, async markInboundFailed(id) { failedId = id; }, async completeInboundWithOutbound() { throw new Error('db secret failure'); }
  };
  const processor = createInboxProcessor({ repository, knowledgeProvider: async () => { throw new Error('sensitive internal detail'); } });
  const result = await processor.processOne();
  assert.equal(result.status, 'FAILED'); assert.equal(result.inboxId, 'inbox-3'); assert.equal(result.reason, 'PROCESSING_ERROR'); assert.equal(failedId, 'inbox-3'); assert.equal('message' in result, false);
});

test('inbox processor fails closed when atomic completion is unavailable', () => {
  assert.throws(() => createInboxProcessor({ repository: { async claimPendingInbound() {}, async markInboundProcessed() {}, async markInboundFailed() {} }, knowledgeProvider: async () => [] }), /INBOX_PROCESSOR_REPOSITORY_REQUIRED/);
});

test('inbox processor fails closed when durable conversation completion contracts are incomplete', () => {
  assert.throws(() => createInboxProcessor({
    repository: { async claimPendingInbound() {}, async markInboundProcessed() {}, async markInboundFailed() {}, async completeInboundWithOutbound() {} },
    conversationRepository: { async getOrCreate() {} }, knowledgeProvider: async () => []
  }), /INBOX_CONVERSATION_ATOMIC_COMPLETION_REQUIRED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runTransactionalKnowledgeWorkflow, runApprovalPublicationTransaction } from '../src/db/transactional-workflow.js';

function fakeDb() {
  return { transaction: async (fn) => fn({}) };
}

test('knowledge ingestion workflow executes atomically in one transaction', async () => {
  const calls = [];
  const result = await runTransactionalKnowledgeWorkflow(fakeDb(), {
    createSource: async () => { calls.push('source'); return { id: 'S1' }; },
    createDocument: async (_tx, source) => { calls.push('document'); assert.equal(source.id, 'S1'); return { id: 'D1' }; },
    createValidation: async (_tx, document) => { calls.push('validation'); assert.equal(document.id, 'D1'); return { id: 'V1' }; },
    createCandidate: async (_tx, data) => { calls.push('candidate'); assert.equal(data.validation.id, 'V1'); return { id: 'K1' }; },
    createAudit: async () => { calls.push('audit'); return { id: 'A1' }; }
  });
  assert.deepEqual(calls, ['source', 'document', 'validation', 'candidate', 'audit']);
  assert.equal(result.candidate.id, 'K1');
});

test('database transaction is mandatory', async () => {
  await assert.rejects(() => runTransactionalKnowledgeWorkflow({}, {}), /DATABASE_TRANSACTION_REQUIRED/);
});

test('approval, publication and audit are atomic', async () => {
  const calls = [];
  const result = await runApprovalPublicationTransaction(fakeDb(), {
    approve: async () => { calls.push('approve'); return { id: 'AP1' }; },
    publish: async (_tx, approval) => { calls.push('publish'); assert.equal(approval.id, 'AP1'); return { id: 'P1' }; },
    createAudit: async () => { calls.push('audit'); return { id: 'A2' }; }
  });
  assert.deepEqual(calls, ['approve', 'publish', 'audit']);
  assert.equal(result.publication.id, 'P1');
});

test('invalid approval workflow is rejected', async () => {
  await assert.rejects(() => runApprovalPublicationTransaction(fakeDb(), {}), /INVALID_APPROVAL_WORKFLOW/);
});


test('message lifecycle keeps admission, conversation, outbox and audit in one transaction', async () => {
  const calls = [];
  const result = await (await import('../src/db/transactional-workflow.js')).runTransactionalMessageLifecycle(fakeDb(), {
    admitInbound: async () => { calls.push('inbound'); return { id: 'I1', conversation_id: 'C1' }; },
    processConversation: async (_tx, inbound) => { calls.push('conversation'); assert.equal(inbound.conversation_id, 'C1'); return { id: 'C1', status: 'ANSWERED', correlation_id: 'I1' }; },
    enqueueOutbound: async (_tx, data) => { calls.push('outbox'); assert.equal(data.inbound.id, 'I1'); assert.equal(data.conversation.id, 'C1'); return { id: 'O1' }; },
    writeAudit: async (_tx, data) => { calls.push('audit'); assert.equal(data.outbound.id, 'O1'); return [{ id: 'A1' }]; }
  });
  assert.equal(result.status, 'COMMITTED');
  assert.deepEqual(calls, ['inbound', 'conversation', 'outbox', 'audit']);
});

test('message lifecycle rejects incomplete workflow before opening transaction work', async () => {
  await assert.rejects(() => import('../src/db/transactional-workflow.js').then(({ runTransactionalMessageLifecycle }) => runTransactionalMessageLifecycle(fakeDb(), {})), /INVALID_MESSAGE_LIFECYCLE_WORKFLOW/);
});

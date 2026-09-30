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


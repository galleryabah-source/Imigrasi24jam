import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresKnowledgeProvider } from '../src/core/postgres-knowledge-provider.js';

test('postgres knowledge provider is read-only, parameterized, and returns only published public evidence', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'K1',
          intent: 'PASSPORT_NEW',
          status: 'PUBLISHED',
          effective_from: '2026-01-01T00:00:00Z',
          effective_until: null,
          source_id: 'S1',
          authority_name: 'Direktorat Jenderal Imigrasi',
          source_title: 'Persyaratan Paspor',
          reference_number: 'REF-1',
          source_url: 'https://example.test/ref-1',
          direct_answer: 'Informasi persyaratan paspor.',
          question_patterns: ['syarat paspor', 'persyaratan paspor'],
          verified_evidence: [{ id: 'E1', status: 'VERIFIED', document_id: 'D1' }]
        }]
      };
    }
  };

  const provider = createPostgresKnowledgeProvider(db);
  const result = await provider({
    message: { text: 'apa syarat paspor baru?' },
    now: '2026-09-12T00:00:00Z'
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /WHERE ki\.status = 'PUBLISHED'/);
  assert.match(calls[0].sql, /ei\.status = 'VERIFIED'/);
  assert.match(calls[0].sql, /d\.access_classification = \$3/);
  assert.match(calls[0].sql, /d\.quarantined = false/);
  assert.doesNotMatch(calls[0].sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
  assert.deepEqual(calls[0].params, ['PASSPORT_NEW', '2026-09-12T00:00:00Z', 'PUBLIC']);
  assert.equal(result.items[0].direct_answer, 'Informasi persyaratan paspor.');
  assert.equal(result.items[0].verified_evidence[0].status, 'VERIFIED');
  assert.equal(result.evidenceByKnowledgeId.K1[0].id, 'E1');
});

test('ambiguous and out-of-domain messages do not query PostgreSQL', async () => {
  let queryCount = 0;
  const provider = createPostgresKnowledgeProvider({
    async query() {
      queryCount++;
      return { rows: [] };
    }
  });

  const ambiguous = await provider({ message: { text: 'saya mau urus' } });
  const outOfDomain = await provider({ message: { text: 'resep nasi goreng' } });

  assert.equal(queryCount, 0);
  assert.equal(ambiguous.items.length, 0);
  assert.equal(outOfDomain.items.length, 0);
});

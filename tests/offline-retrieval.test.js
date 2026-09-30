import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieveOffline } from '../src/core/offline-retrieval.js';

const base = {
  id: 'K1', intent: 'PASSPORT', sub_intent: 'REQUIREMENTS', status: 'PUBLISHED',
  effective_from: '2026-01-01', question_patterns: ['syarat paspor', 'dokumen paspor'],
  verified_evidence: [{ id: 'E1' }]
};

test('offline retrieval resolves published effective knowledge without AI', () => {
  const result = retrieveOffline([base], { intent: 'PASSPORT', subIntent: 'REQUIREMENTS', query: 'apa syarat paspor', at: '2026-08-29' });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.items[0].item.id, 'K1');
});

test('draft and expired knowledge are excluded', () => {
  const result = retrieveOffline([{ ...base, status: 'DRAFT' }, { ...base, id: 'K2', effective_until: '2026-01-01' }], { intent: 'PASSPORT', query: 'syarat paspor', at: '2026-08-29' });
  assert.equal(result.status, 'NO_MATCH');
});

test('missing evidence lowers confidence to review', () => {
  const result = retrieveOffline([{ ...base, verified_evidence: [] }], { intent: 'PASSPORT', query: 'syarat paspor', at: '2026-08-29' });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.items[0].score >= 0.35, true);
});

test('wrong intent cannot retrieve another domain', () => {
  const result = retrieveOffline([base], { intent: 'VISA', query: 'syarat visa', at: '2026-08-29' });
  assert.equal(result.status, 'NO_MATCH');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveKnowledge, selectEffectiveKnowledge } from '../src/core/effective-knowledge-resolver.js';

const items = [
  { id: 'K1', intent: 'PASSPORT_NEW', status: 'PUBLISHED', effective_from: '2025-01-01T00:00:00Z', effective_until: '2026-01-01T00:00:00Z' },
  { id: 'K2', intent: 'PASSPORT_NEW', status: 'PUBLISHED', effective_from: '2026-01-01T00:00:00Z' },
  { id: 'K3', intent: 'PASSPORT_NEW', status: 'DRAFT', effective_from: '2027-01-01T00:00:00Z' }
];

test('resolver selects knowledge effective at requested time', () => {
  assert.equal(selectEffectiveKnowledge(items, '2025-06-01T00:00:00Z').item.id, 'K1');
  assert.equal(selectEffectiveKnowledge(items, '2026-06-01T00:00:00Z').item.id, 'K2');
});

test('draft knowledge is never effective', () => {
  assert.deepEqual(resolveEffectiveKnowledge(items, '2027-06-01T00:00:00Z').map((item) => item.id), ['K2']);
});

test('conflicting published versions trigger review', () => {
  const result = selectEffectiveKnowledge([
    { id: 'A', intent: 'VISA_GENERAL', status: 'PUBLISHED', effective_from: '2026-01-01T00:00:00Z' },
    { id: 'B', intent: 'VISA_GENERAL', status: 'PUBLISHED', effective_from: '2026-01-01T00:00:00Z' }
  ], '2026-06-01T00:00:00Z');
  assert.equal(result.status, 'CONFLICT_REVIEW');
});

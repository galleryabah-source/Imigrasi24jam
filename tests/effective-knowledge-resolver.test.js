import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveKnowledge, selectEffectiveKnowledge } from '../src/core/effective-knowledge-resolver.js';

const items = [
  { id: 'K1', intent: 'PASSPORT_NEW', status: 'PUBLISHED', effective_from: '2025-01-01T00:00:00Z', effective_until: '2026-01-01T00:00:00Z' },
  { id: 'K2', intent: 'PASSPORT_NEW', status: 'PUBLISHED', effective_from: '2026-01-01T00:00:00Z' },
  { id: 'K3', intent: 'VISA', status: 'PUBLISHED', effective_from: '2025-01-01T00:00:00Z' },
  { id: 'K4', intent: 'PASSPORT_NEW', status: 'DRAFT', effective_from: '2026-01-01T00:00:00Z' }
];

test('resolver selects knowledge effective at requested time and intent', () => {
  assert.equal(selectEffectiveKnowledge(items, '2025-06-01T00:00:00Z', 'PASSPORT_NEW').item.id, 'K1');
  assert.equal(selectEffectiveKnowledge(items, '2026-06-01T00:00:00Z', 'PASSPORT_NEW').item.id, 'K2');
});

test('future and non-published knowledge are excluded', () => {
  const result = resolveEffectiveKnowledge(items, { intent: 'PASSPORT_NEW', at: '2025-06-01T00:00:00Z' });
  assert.deepEqual(result.items.map((item) => item.id), ['K1']);
});

test('overlapping published versions trigger conflict review', () => {
  const result = resolveEffectiveKnowledge([
    ...items,
    { id: 'K5', intent: 'PASSPORT_NEW', status: 'PUBLISHED', effective_from: '2025-06-01T00:00:00Z' }
  ], { intent: 'PASSPORT_NEW', at: '2025-07-01T00:00:00Z' });
  assert.equal(result.status, 'CONFLICT_REVIEW');
});

test('different intents do not create a false conflict', () => {
  assert.equal(resolveEffectiveKnowledge(items, { intent: 'VISA', at: '2025-06-01T00:00:00Z' }).status, 'RESOLVED');
});

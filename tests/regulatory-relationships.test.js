import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegulatoryRelationship, resolveSupersession } from '../src/core/regulatory-relationships.js';

test('regulatory relationship requires evidence-ready provenance', () => {
  const relation = createRegulatoryRelationship({ sourceId: 'A', targetSourceId: 'B', relationship: 'REPLACES', evidenceId: 'E1' });
  assert.equal(relation.relationship, 'REPLACES');
  assert.equal(relation.status, 'REVIEW');
});

test('self relationship is rejected', () => {
  assert.throws(() => createRegulatoryRelationship({ sourceId: 'A', targetSourceId: 'A', relationship: 'REPLACES' }), /INVALID_REGULATORY_RELATIONSHIP/);
});

test('one effective published source resolves', () => {
  const result = resolveSupersession({ asOf: '2026-06-01', candidates: [{ id: 'A', status: 'PUBLISHED', effective_from: '2026-01-01' }] });
  assert.equal(result.status, 'RESOLVED');
});

test('overlapping effective sources trigger review', () => {
  const result = resolveSupersession({ asOf: '2026-06-01', candidates: [
    { id: 'A', status: 'PUBLISHED', effective_from: '2026-01-01' },
    { id: 'B', status: 'PUBLISHED', effective_from: '2026-05-01' }
  ] });
  assert.equal(result.status, 'CONFLICT_REVIEW');
});

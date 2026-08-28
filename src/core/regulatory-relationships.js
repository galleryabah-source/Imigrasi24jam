export const RELATIONSHIPS = Object.freeze([
  'AMENDS', 'REPEALS', 'REPLACES', 'PARTIALLY_REPLACES', 'IMPLEMENTS', 'REFERENCES', 'EXTENDS', 'EXPIRES'
]);

export function createRegulatoryRelationship({ sourceId, targetSourceId, relationship, evidenceId = null, effectiveFrom = null }) {
  if (!sourceId || !targetSourceId || sourceId === targetSourceId) throw new Error('INVALID_REGULATORY_RELATIONSHIP');
  if (!RELATIONSHIPS.includes(relationship)) throw new Error('INVALID_REGULATORY_RELATIONSHIP_TYPE');
  return Object.freeze({ source_id: sourceId, target_source_id: targetSourceId, relationship, evidence_id: evidenceId, effective_from: effectiveFrom, status: 'REVIEW' });
}

export function resolveSupersession({ candidates, asOf }) {
  const at = new Date(asOf).getTime();
  if (Number.isNaN(at)) return Object.freeze({ status: 'REVIEW', reason: 'INVALID_DATE', candidates: [] });
  const applicable = candidates.filter((c) => {
    const from = c.effective_from ? new Date(c.effective_from).getTime() : Number.NEGATIVE_INFINITY;
    const until = c.effective_until ? new Date(c.effective_until).getTime() : Number.POSITIVE_INFINITY;
    return c.status === 'PUBLISHED' && from <= at && at < until;
  });
  return Object.freeze({ status: applicable.length === 1 ? 'RESOLVED' : applicable.length === 0 ? 'NO_MATCH' : 'CONFLICT_REVIEW', candidates: applicable });
}

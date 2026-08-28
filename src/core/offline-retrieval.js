function effective(item, at) {
  const t = new Date(at).getTime();
  const from = item.effective_from ? new Date(item.effective_from).getTime() : Number.NEGATIVE_INFINITY;
  const until = item.effective_until ? new Date(item.effective_until).getTime() : Number.POSITIVE_INFINITY;
  return item.status === 'PUBLISHED' && from <= t && t < until;
}

function tokenSet(value) {
  return new Set(String(value ?? '').toLowerCase().normalize('NFKC').split(/\s+/).filter(Boolean));
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits++;
  return hits / Math.max(a.size, b.size);
}

export function retrieveOffline(candidates, { intent, subIntent = null, query = '', at = new Date().toISOString(), limit = 5 } = {}) {
  if (!intent) return Object.freeze({ status: 'NO_MATCH', items: [], reason: 'NO_INTENT' });
  const queryTokens = tokenSet(query);
  const eligible = candidates.filter((item) => effective(item, at) && item.intent === intent && (!subIntent || item.sub_intent === subIntent));
  const ranked = eligible.map((item) => {
    const patterns = Array.isArray(item.question_patterns) ? item.question_patterns : [];
    const patternScore = Math.max(0, ...patterns.map((p) => overlap(queryTokens, tokenSet(p))));
    const evidenceScore = Array.isArray(item.verified_evidence) && item.verified_evidence.length ? 1 : 0;
    const score = patternScore * 0.7 + evidenceScore * 0.3;
    return { item, score };
  }).sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)));
  if (!ranked.length) return Object.freeze({ status: 'NO_MATCH', items: [], reason: 'NO_EFFECTIVE_KNOWLEDGE' });
  const topScore = ranked[0].score;
  if (topScore < 0.35) return Object.freeze({ status: 'REVIEW', items: ranked.slice(0, limit), reason: 'LOW_RETRIEVAL_CONFIDENCE' });
  return Object.freeze({ status: 'RESOLVED', items: ranked.slice(0, limit), reason: 'DETERMINISTIC_MATCH' });
}

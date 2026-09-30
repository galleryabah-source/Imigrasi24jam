export function resolveEffectiveKnowledge(items, { intent, at = new Date() } = {}) {
  const timestamp = new Date(at).getTime();
  if (!intent || Number.isNaN(timestamp)) return Object.freeze({ status: 'NO_MATCH', items: [], reason: 'INVALID_QUERY' });

  const active = (items ?? []).filter((item) => {
    if (item?.intent !== intent || item.status !== 'PUBLISHED') return false;
    const from = item.effective_from ? new Date(item.effective_from).getTime() : Number.NEGATIVE_INFINITY;
    const until = item.effective_until ? new Date(item.effective_until).getTime() : Number.POSITIVE_INFINITY;
    return !Number.isNaN(from) && !Number.isNaN(until) && from <= timestamp && timestamp < until;
  });

  if (!active.length) return Object.freeze({ status: 'NO_MATCH', items: [], reason: 'NO_EFFECTIVE_KNOWLEDGE' });
  if (active.length > 1) return Object.freeze({ status: 'CONFLICT_REVIEW', items: active, reason: 'MULTIPLE_EFFECTIVE_VERSIONS' });
  return Object.freeze({ status: 'RESOLVED', items: active, reason: 'SINGLE_EFFECTIVE_VERSION' });
}

export function selectEffectiveKnowledge(items, at = new Date(), intent = null) {
  const result = resolveEffectiveKnowledge(items, { at, intent });
  if (result.status !== 'RESOLVED') return result;
  return Object.freeze({ status: 'RESOLVED', item: result.items[0] });
}

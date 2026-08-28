export function resolveEffectiveKnowledge(items, at = new Date()) {
  const timestamp = new Date(at).getTime();
  if (Number.isNaN(timestamp)) throw new Error('INVALID_EFFECTIVE_DATE');

  return (items ?? [])
    .filter((item) => item?.status === 'PUBLISHED')
    .filter((item) => {
      const from = item.effective_from ? new Date(item.effective_from).getTime() : Number.NEGATIVE_INFINITY;
      const until = item.effective_until ? new Date(item.effective_until).getTime() : Number.POSITIVE_INFINITY;
      return !Number.isNaN(from) && !Number.isNaN(until) && from <= timestamp && timestamp < until;
    })
    .sort((a, b) => {
      const av = new Date(a.effective_from ?? 0).getTime();
      const bv = new Date(b.effective_from ?? 0).getTime();
      return bv - av;
    });
}

export function selectEffectiveKnowledge(items, at = new Date()) {
  const candidates = resolveEffectiveKnowledge(items, at);
  if (!candidates.length) return null;
  const top = candidates[0];
  const competing = candidates.filter((item) => item.intent === top.intent);
  if (competing.length > 1) return { status: 'CONFLICT_REVIEW', candidates: competing };
  return { status: 'RESOLVED', item: top };
}

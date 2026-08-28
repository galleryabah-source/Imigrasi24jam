export function evaluateAnswerSafety({ intent, answer, sources = [], confidence = 0, providerAvailable = false }) {
  const reasons = [];
  if (!intent) reasons.push('NO_IMMIGRATION_INTENT');
  if (!String(answer ?? '').trim()) reasons.push('EMPTY_ANSWER');
  if (confidence < 0.7) reasons.push('LOW_CONFIDENCE');
  if (!sources.length) reasons.push('NO_VERIFIED_SOURCE');
  if (String(intent).startsWith('OUT_OF_SCOPE')) reasons.push('OUT_OF_SCOPE');

  return Object.freeze({
    decision: reasons.length === 0 ? 'ANSWER' : 'SAFE_FALLBACK',
    reasons,
    provider_used: providerAvailable,
    requires_human_review: reasons.includes('NO_VERIFIED_SOURCE') || reasons.includes('LOW_CONFIDENCE')
  });
}

export function evaluateAnswerSafety({ intent, answer, sources = [], confidence = 0, providerAvailable = false, knowledge = null, attachments = [] }) {
  const reasons = [];
  if (!intent) reasons.push('NO_IMMIGRATION_INTENT');
  if (!String(answer ?? '').trim()) reasons.push('EMPTY_ANSWER');
  if (confidence < 0.7) reasons.push('LOW_CONFIDENCE');
  if (!sources.length) reasons.push('NO_VERIFIED_SOURCE');
  if (String(intent).startsWith('OUT_OF_SCOPE')) reasons.push('OUT_OF_SCOPE');
  if (knowledge && knowledge.status !== 'PUBLISHED') reasons.push('KNOWLEDGE_NOT_PUBLISHED');

  const safeAttachments = attachments.filter((a) =>
    a?.status === 'PUBLISHED' &&
    a?.visibility === 'PUBLIC' &&
    a?.allowWhatsAppAttachment === true &&
    a?.valid === true &&
    a?.immigrationRelevant === true
  );
  const blockedAttachmentIds = attachments.filter((a) => !safeAttachments.includes(a)).map((a) => a?.id).filter(Boolean);

  return Object.freeze({
    decision: reasons.length === 0 ? 'ANSWER' : 'SAFE_FALLBACK',
    reasons,
    provider_used: providerAvailable,
    requires_human_review: reasons.includes('NO_VERIFIED_SOURCE') || reasons.includes('LOW_CONFIDENCE') || reasons.includes('KNOWLEDGE_NOT_PUBLISHED'),
    attachments: safeAttachments,
    blocked_attachment_ids: blockedAttachmentIds
  });
}

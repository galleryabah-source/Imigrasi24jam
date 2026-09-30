export function buildKnowledgeCandidateV2({ id, documentId, sourceId, intent, questionPatterns, answerText, effectiveFrom = null, effectiveUntil = null }) {
  if (!id || !documentId || !sourceId || !intent || !Array.isArray(questionPatterns) || questionPatterns.length === 0 || !answerText) {
    throw new Error('INVALID_KNOWLEDGE_CANDIDATE');
  }
  return Object.freeze({
    id,
    document_id: documentId,
    source_id: sourceId,
    intent,
    question_patterns: [...new Set(questionPatterns.map((value) => String(value).trim()).filter(Boolean))],
    answer_text: String(answerText).trim(),
    effective_from: effectiveFrom,
    effective_until: effectiveUntil,
    status: 'REVIEW'
  });
}

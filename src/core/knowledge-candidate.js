export function buildKnowledgeCandidate({ documentId, sourceId, intent, questionPatterns, answerText, effectiveFrom = null, effectiveUntil = null }) {
  if (!documentId || !sourceId || !intent || !Array.isArray(questionPatterns) || !questionPatterns.length || !answerText) {
    throw new Error('INVALID_KNOWLEDGE_CANDIDATE');
  }
  return Object.freeze({
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

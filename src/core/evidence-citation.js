export function buildEvidence({ documentId, documentVersionId, sourceId, page = null, section = null, excerpt = null }) {
  if (!documentId || !documentVersionId || !sourceId) throw new Error('EVIDENCE_PROVENANCE_REQUIRED');
  if (page != null && (!Number.isInteger(page) || page < 1)) throw new Error('INVALID_EVIDENCE_PAGE');
  const cleanExcerpt = excerpt == null ? null : String(excerpt).trim();
  return Object.freeze({ document_id: documentId, document_version_id: documentVersionId, source_id: sourceId, page, section, excerpt: cleanExcerpt });
}

export function validateEvidenceForAnswer(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return Object.freeze({ valid: false, reason: 'NO_EVIDENCE' });
  const valid = evidence.every((item) => item?.document_id && item?.document_version_id && item?.source_id);
  return Object.freeze({ valid, reason: valid ? 'EVIDENCE_COMPLETE' : 'INCOMPLETE_EVIDENCE' });
}

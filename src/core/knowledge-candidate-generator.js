const SECTION_RE = /(?:bab|bagian|pasal|chapter|section)\s+[\w.-]+/gi;
const REGULATION_RE = /(?:uu|pp|perpres|permen|permendagri|kepmen|keputusan menteri|surat edaran)\s*(?:no\.?|nomor)?\s*[\w./-]+/gi;
const TOPIC_TERMS = Object.freeze({
  PASSPORT_NEW: ['paspor', 'passport'],
  PASSPORT_LOST: ['paspor hilang', 'kehilangan paspor'],
  VISA: ['visa'],
  STAY_PERMIT: ['izin tinggal', 'itas', 'itap'],
  OVERSTAY: ['overstay'],
  FOREIGN_NATIONAL: ['wna', 'warga negara asing']
});

function unique(values) { return [...new Set(values.filter(Boolean))]; }

export function detectDocumentStructure(text) {
  const value = String(text ?? '');
  return Object.freeze({ sections: unique(value.match(SECTION_RE) ?? []), regulation_references: unique(value.match(REGULATION_RE) ?? []) });
}

export function inferImmigrationTopics(text) {
  const normalized = String(text ?? '').toLowerCase();
  return Object.freeze(Object.entries(TOPIC_TERMS).filter(([, terms]) => terms.some((term) => normalized.includes(term))).map(([intent]) => intent));
}

export function buildKnowledgeCandidates({ documentId, sourceId, extractedText, effectiveFrom = null, effectiveUntil = null }) {
  if (!documentId || !sourceId) throw new Error('KNOWLEDGE_PROVENANCE_REQUIRED');
  const text = String(extractedText ?? '').trim();
  if (!text) throw new Error('EXTRACTED_TEXT_REQUIRED');
  const topics = inferImmigrationTopics(text);
  const structure = detectDocumentStructure(text);
  return Object.freeze(topics.map((intent) => Object.freeze({
    document_id: documentId,
    source_id: sourceId,
    intent,
    question_patterns: unique(TOPIC_TERMS[intent]),
    answer_text: `Candidate knowledge for ${intent}; requires authorized human review before publication.`,
    source_references: structure.regulation_references,
    sections: structure.sections,
    effective_from: effectiveFrom,
    effective_until: effectiveUntil,
    status: 'REVIEW'
  })));
}

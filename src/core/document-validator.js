const IMMIGRATION_TERMS = [
  'imigrasi', 'keimigrasian', 'paspor', 'passport', 'visa', 'wna', 'warga negara asing',
  'izin tinggal', 'itas', 'itap', 'overstay', 'dokumen perjalanan', 'kantor imigrasi'
];

const AUTHORITY_TERMS = [
  'undang-undang', 'peraturan pemerintah', 'peraturan menteri', 'peraturan menteri hukum',
  'direktorat jenderal imigrasi', 'direktorat jenderal', 'kementerian hukum', 'kementerian imigrasi',
  'jenderal imigrasi', 'keputusan menteri', 'surat edaran'
];

export function validateDocumentMetadata(input) {
  const errors = [];
  if (!input?.filename) errors.push('MISSING_FILENAME');
  if (!input?.media_type) errors.push('MISSING_MEDIA_TYPE');
  if (!input?.checksum_sha256) errors.push('MISSING_CHECKSUM');
  if (!input?.uploader_id) errors.push('MISSING_UPLOADER');
  if (!['PUBLIC', 'PRIVATE-INTERNAL', 'RESTRICTED'].includes(input?.access_classification)) errors.push('INVALID_ACCESS_CLASSIFICATION');
  return { valid: errors.length === 0, errors };
}

export function assessExtractedText(text) {
  const normalized = String(text ?? '').toLowerCase();
  const immigrationMatches = IMMIGRATION_TERMS.filter((term) => normalized.includes(term));
  const authorityMatches = AUTHORITY_TERMS.filter((term) => normalized.includes(term));
  const relevanceScore = Math.min(1, immigrationMatches.length / 4);
  const authorityScore = Math.min(1, authorityMatches.length / 2);
  return {
    immigration_relevance_status: relevanceScore >= 0.5 ? 'VERIFIED' : 'REVIEW_REQUIRED',
    authority_status: authorityScore >= 0.5 ? 'VERIFIED' : 'REVIEW_REQUIRED',
    immigration_score: relevanceScore,
    authority_score: authorityScore,
    immigration_matches: immigrationMatches,
    authority_matches: authorityMatches
  };
}

export function classifyValidationOutcome({ metadataValid, contentAssessment, integrityVerified = false }) {
  if (!metadataValid) return 'REJECTED';
  if (!integrityVerified) return 'QUARANTINED';
  if (contentAssessment.immigration_relevance_status !== 'VERIFIED') return 'REVIEW_REQUIRED';
  if (contentAssessment.authority_status !== 'VERIFIED') return 'REVIEW_REQUIRED';
  return 'REVIEW_REQUIRED';
}

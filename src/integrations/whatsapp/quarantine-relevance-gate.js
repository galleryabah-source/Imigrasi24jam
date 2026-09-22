const IMMIGRATION_TERMS = Object.freeze([
  'imigrasi', 'keimigrasian', 'paspor', 'passport', 'visa', 'izin tinggal', 'wna',
  'wni', 'keimigrasian', 'tpi', 'dokumen perjalanan', 'layanan imigrasi',
  'kantor imigrasi', 'pengaduan imigrasi', 'pelanggaran imigrasi'
]);

const PUBLIC_STATUSES = new Set(['APPROVED', 'PUBLISHED']);

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hasImmigrationRelevance(value) {
  const text = normalize(value);
  return IMMIGRATION_TERMS.some((term) => text.includes(term));
}

export function evaluatePublicWhatsAppAttachment({ document, context = '' }) {
  if (!document || typeof document !== 'object') {
    return Object.freeze({ decision: 'QUARANTINE', reason: 'DOCUMENT_REQUIRED' });
  }

  const access = normalize(document.accessClassification).toUpperCase();
  const status = normalize(document.status).toUpperCase();
  const allowWhatsApp = document.allowWhatsAppAttachment === true;
  const searchableContext = [document.title, document.description, document.topic, document.service, context].join(' ');

  if (access !== 'PUBLIC') {
    return Object.freeze({ decision: 'QUARANTINE', reason: 'NON_PUBLIC_ACCESS' });
  }
  if (!PUBLIC_STATUSES.has(status)) {
    return Object.freeze({ decision: 'QUARANTINE', reason: 'NOT_APPROVED_OR_PUBLISHED' });
  }
  if (!allowWhatsApp) {
    return Object.freeze({ decision: 'QUARANTINE', reason: 'WHATSAPP_ATTACHMENT_NOT_ALLOWED' });
  }
  if (!hasImmigrationRelevance(searchableContext)) {
    return Object.freeze({ decision: 'QUARANTINE', reason: 'IMMIGRATION_RELEVANCE_REQUIRED' });
  }

  return Object.freeze({ decision: 'ADMIT', reason: 'PUBLIC_APPROVED_RELEVANT' });
}

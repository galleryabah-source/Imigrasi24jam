const IMMIGRATION_TERMS = [
  'imigrasi', 'paspor', 'passport', 'visa', 'izin tinggal', 'itas', 'itap',
  'overstay', 'keimigrasian', 'wna', 'foreigner', 'dokumen perjalanan',
  'kantor imigrasi', 'pengaduan imigrasi', 'pelanggaran keimigrasian'
];

export function domainGuard(message) {
  const text = String(message ?? '').trim().toLowerCase();
  if (!text) return { allowed: false, reason: 'EMPTY_MESSAGE' };
  const matchedTerms = IMMIGRATION_TERMS.filter((term) => text.includes(term));
  return matchedTerms.length
    ? { allowed: true, reason: 'IMMIGRATION_DOMAIN', matchedTerms }
    : { allowed: false, reason: 'OUT_OF_DOMAIN', matchedTerms: [] };
}

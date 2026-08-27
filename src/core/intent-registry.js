export const INTENTS = Object.freeze({
  PASSPORT_GENERAL: 'PASSPORT_GENERAL',
  PASSPORT_NEW: 'PASSPORT_NEW',
  PASSPORT_REPLACEMENT: 'PASSPORT_REPLACEMENT',
  PASSPORT_LOST: 'PASSPORT_LOST',
  PASSPORT_DAMAGED: 'PASSPORT_DAMAGED',
  VISA_GENERAL: 'VISA_GENERAL',
  STAY_PERMIT: 'STAY_PERMIT',
  ITAS: 'ITAS',
  ITAP: 'ITAP',
  OVERSTAY: 'OVERSTAY',
  WNA_SERVICE: 'WNA_SERVICE',
  OFFICE_INFORMATION: 'OFFICE_INFORMATION',
  SERVICE_REQUIREMENTS: 'SERVICE_REQUIREMENTS',
  SERVICE_TARIFF: 'SERVICE_TARIFF',
  SERVICE_STATUS: 'SERVICE_STATUS',
  IMMIGRATION_COMPLAINT: 'IMMIGRATION_COMPLAINT',
  IMMIGRATION_VIOLATION_REPORT: 'IMMIGRATION_VIOLATION_REPORT',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  OUT_OF_DOMAIN: 'OUT_OF_DOMAIN',
  AMBIGUOUS: 'AMBIGUOUS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED'
});

const RULES = [
  ['PASSPORT_LOST', ['paspor hilang', 'passport hilang', 'kehilangan paspor']],
  ['PASSPORT_DAMAGED', ['paspor rusak', 'passport rusak', 'paspor sobek']],
  ['PASSPORT_REPLACEMENT', ['ganti paspor', 'penggantian paspor', 'perpanjang paspor']],
  ['PASSPORT_NEW', ['buat paspor', 'membuat paspor', 'paspor baru']],
  ['OVERSTAY', ['overstay', 'kelebihan masa tinggal']],
  ['ITAS', ['itas', 'izin tinggal terbatas']],
  ['ITAP', ['itap', 'izin tinggal tetap']],
  ['STAY_PERMIT', ['izin tinggal', 'stay permit']],
  ['VISA_GENERAL', ['visa', 'evisa', 'e-visa']],
  ['IMMIGRATION_VIOLATION_REPORT', ['lapor wna', 'laporan wna', 'pelanggaran wna', 'pelanggaran imigrasi']],
  ['IMMIGRATION_COMPLAINT', ['pengaduan imigrasi', 'keluhan imigrasi', 'komplain imigrasi']],
  ['SERVICE_TARIFF', ['tarif paspor', 'biaya paspor', 'biaya visa', 'tarif visa']],
  ['SERVICE_REQUIREMENTS', ['syarat paspor', 'persyaratan paspor', 'syarat visa', 'persyaratan visa']],
  ['OFFICE_INFORMATION', ['kantor imigrasi', 'alamat imigrasi', 'lokasi kantor imigrasi', 'jam pelayanan imigrasi']],
  ['SERVICE_STATUS', ['status permohonan', 'status layanan imigrasi', 'cek status paspor']],
  ['WNA_SERVICE', ['layanan wna', 'urusan wna', 'pelayanan wna']],
  ['HUMAN_HANDOFF', ['petugas', 'bicara dengan petugas', 'hubungi petugas']]
];

export function classifyIntent(normalizedText) {
  const text = String(normalizedText ?? '').trim();
  if (!text) return { intent: INTENTS.REVIEW_REQUIRED, confidence: 0, matchedRules: [] };

  const matches = RULES
    .filter(([, patterns]) => patterns.some((pattern) => text.includes(pattern)))
    .map(([intent, patterns]) => ({ intent, patterns: patterns.filter((p) => text.includes(p)) }));

  if (!matches.length) return { intent: INTENTS.OUT_OF_DOMAIN, confidence: 0, matchedRules: [] };
  if (matches.length > 1) return { intent: INTENTS.AMBIGUOUS, confidence: 0.5, matchedRules: matches };
  return { intent: matches[0].intent, confidence: 0.9, matchedRules: matches };
}

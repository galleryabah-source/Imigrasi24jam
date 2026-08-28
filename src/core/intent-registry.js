export const INTENTS = Object.freeze({
  PASSPORT_GENERAL: 'PASSPORT_GENERAL', PASSPORT_NEW: 'PASSPORT_NEW', PASSPORT_REPLACEMENT: 'PASSPORT_REPLACEMENT', PASSPORT_LOST: 'PASSPORT_LOST', PASSPORT_DAMAGED: 'PASSPORT_DAMAGED',
  VISA_GENERAL: 'VISA_GENERAL', STAY_PERMIT: 'STAY_PERMIT', ITAS: 'ITAS', ITAP: 'ITAP', OVERSTAY: 'OVERSTAY', WNA_SERVICE: 'WNA_SERVICE',
  OFFICE_INFORMATION: 'OFFICE_INFORMATION', SERVICE_REQUIREMENTS: 'SERVICE_REQUIREMENTS', SERVICE_TARIFF: 'SERVICE_TARIFF', SERVICE_STATUS: 'SERVICE_STATUS',
  IMMIGRATION_COMPLAINT: 'IMMIGRATION_COMPLAINT', IMMIGRATION_VIOLATION_REPORT: 'IMMIGRATION_VIOLATION_REPORT', HUMAN_HANDOFF: 'HUMAN_HANDOFF',
  OUT_OF_DOMAIN: 'OUT_OF_DOMAIN', AMBIGUOUS: 'AMBIGUOUS', REVIEW_REQUIRED: 'REVIEW_REQUIRED'
});

const RULES = [
  ['PASSPORT_LOST', ['paspor hilang', 'passport hilang', 'kehilangan paspor']],
  ['PASSPORT_DAMAGED', ['paspor rusak', 'passport rusak', 'paspor sobek']],
  ['PASSPORT_REPLACEMENT', ['ganti paspor', 'penggantian paspor', 'perpanjang paspor']],
  ['PASSPORT_NEW', ['buat paspor', 'membuat paspor', 'paspor baru', 'syarat membuat paspor baru']],
  ['OVERSTAY', ['overstay', 'kelebihan masa tinggal']], ['ITAS', ['itas', 'izin tinggal terbatas']], ['ITAP', ['itap', 'izin tinggal tetap']],
  ['STAY_PERMIT', ['izin tinggal', 'stay permit']], ['VISA_GENERAL', ['visa', 'evisa', 'e visa']],
  ['IMMIGRATION_VIOLATION_REPORT', ['lapor wna', 'laporan wna', 'pelanggaran wna', 'pelanggaran imigrasi']],
  ['IMMIGRATION_COMPLAINT', ['pengaduan imigrasi', 'keluhan imigrasi', 'komplain imigrasi']],
  ['SERVICE_TARIFF', ['tarif paspor', 'biaya paspor', 'biaya visa', 'tarif visa']],
  ['SERVICE_REQUIREMENTS', ['syarat paspor', 'persyaratan paspor', 'syarat visa', 'persyaratan visa']],
  ['OFFICE_INFORMATION', ['kantor imigrasi', 'alamat imigrasi', 'lokasi kantor imigrasi', 'jam pelayanan imigrasi']],
  ['SERVICE_STATUS', ['status permohonan', 'status layanan imigrasi', 'cek status paspor']], ['WNA_SERVICE', ['layanan wna', 'urusan wna', 'pelayanan wna']],
  ['HUMAN_HANDOFF', ['petugas', 'bicara dengan petugas', 'hubungi petugas']]
];

function tokenize(text) {
  return String(text ?? '').split(' ').filter(Boolean);
}

function matchScore(text, pattern) {
  if (text.includes(pattern)) return 1 + tokenize(pattern).length * 0.02;
  const queryTokens = new Set(tokenize(text));
  const patternTokens = tokenize(pattern);
  if (!patternTokens.length) return 0;
  const overlap = patternTokens.filter((token) => queryTokens.has(token)).length;
  const coverage = overlap / patternTokens.length;
  return coverage >= 0.67 ? coverage : 0;
}

export function classifyIntent(normalizedText) {
  const text = String(normalizedText ?? '').trim();
  if (!text) return { intent: INTENTS.REVIEW_REQUIRED, confidence: 0, matchedRules: [] };

  const matches = RULES.map(([intent, patterns]) => {
    const patternScores = patterns.map((pattern) => ({ pattern, score: matchScore(text, pattern) })).filter((item) => item.score > 0);
    const best = patternScores.sort((a, b) => b.score - a.score)[0];
    return best ? { intent, pattern: best.pattern, score: best.score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  if (!matches.length) return { intent: INTENTS.OUT_OF_DOMAIN, confidence: 0, matchedRules: [] };

  const best = matches[0];
  const second = matches[1];
  if (second && Math.abs(best.score - second.score) < 0.03) {
    return { intent: INTENTS.AMBIGUOUS, confidence: 0.5, matchedRules: matches.slice(0, 3) };
  }

  return { intent: best.intent, confidence: Math.min(best.score, 0.99), matchedRules: matches.slice(0, 3) };
}

export const SERVICE_CATALOG_VERSION = '1.0.0';

const DEFINITIONS = [
  ['PASSPORT', 'Paspor', ['PASSPORT_GENERAL','PASSPORT_NEW','PASSPORT_REPLACEMENT','PASSPORT_LOST','PASSPORT_DAMAGED']],
  ['VISA', 'Visa', ['VISA_GENERAL']],
  ['STAY_PERMIT', 'Izin Tinggal', ['STAY_PERMIT','ITAS','ITAP','OVERSTAY']],
  ['WNA_SERVICE', 'Layanan WNA', ['WNA_SERVICE']],
  ['OFFICE_INFORMATION', 'Informasi Kantor Imigrasi', ['OFFICE_INFORMATION']],
  ['SERVICE_REQUIREMENTS', 'Persyaratan Layanan', ['SERVICE_REQUIREMENTS']],
  ['SERVICE_TARIFF', 'Tarif Layanan', ['SERVICE_TARIFF']],
  ['SERVICE_STATUS', 'Status Layanan', ['SERVICE_STATUS']],
  ['IMMIGRATION_COMPLAINT', 'Pengaduan Keimigrasian', ['IMMIGRATION_COMPLAINT']],
  ['IMMIGRATION_VIOLATION_REPORT', 'Laporan Dugaan Pelanggaran Keimigrasian', ['IMMIGRATION_VIOLATION_REPORT']],
  ['HUMAN_HANDOFF', 'Bantuan Petugas', ['HUMAN_HANDOFF']]
];

export const SERVICE_CATALOG = Object.freeze(
  DEFINITIONS.map(([code, name, intents]) => Object.freeze({
    code,
    name,
    intents: Object.freeze([...intents]),
    domain: 'IMMIGRATION',
    authority: 'OFFICIAL_IMMIGRATION_SOURCE',
    requiresHumanReview: code === 'IMMIGRATION_COMPLAINT' || code === 'IMMIGRATION_VIOLATION_REPORT' || code === 'HUMAN_HANDOFF',
    status: 'ACTIVE'
  }))
);

const BY_CODE = new Map(SERVICE_CATALOG.map((service) => [service.code, service]));

export function getServiceByCode(code) {
  return BY_CODE.get(String(code ?? '').trim()) ?? null;
}

export function getServiceForIntent(intent) {
  const value = String(intent ?? '').trim();
  return SERVICE_CATALOG.find((service) => service.intents.includes(value)) ?? null;
}

export function assertKnownImmigrationService(code) {
  const service = getServiceByCode(code);
  if (!service) throw new Error('UNKNOWN_IMMIGRATION_SERVICE');
  return service;
}

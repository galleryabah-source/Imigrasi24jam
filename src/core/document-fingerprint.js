import { createHash } from 'node:crypto';

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeDocumentFingerprint({ checksumSha256, filename = '', mediaType = '', size = null }) {
  if (!checksumSha256) throw new Error('CHECKSUM_REQUIRED');
  return Object.freeze({
    checksum_sha256: checksumSha256.toLowerCase(),
    filename: String(filename).trim().toLowerCase(),
    media_type: String(mediaType).trim().toLowerCase(),
    size: size == null ? null : Number(size)
  });
}

export function classifyDuplicate({ checksumExists, semanticDuplicate = false }) {
  if (checksumExists) return 'EXACT_DUPLICATE';
  if (semanticDuplicate) return 'POSSIBLE_DUPLICATE_REVIEW';
  return 'NEW_DOCUMENT';
}

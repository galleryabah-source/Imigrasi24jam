import crypto from 'node:crypto';

export function verifyWebhookSignature({ rawBody, signature, secret, algorithm = 'sha256' }) {
  if (!rawBody || !signature || !secret) return false;
  const prefix = `sha256=`;
  const supplied = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;
  const expected = crypto.createHmac(algorithm, secret).update(rawBody).digest('hex');
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function validateWebhookTimestamp(timestampSeconds, { nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = 300 } = {}) {
  const ts = Number(timestampSeconds);
  if (!Number.isInteger(ts) || maxAgeSeconds <= 0) return false;
  return Math.abs(nowSeconds - ts) <= maxAgeSeconds;
}

export function createWebhookSecurityGate({ secret, maxAgeSeconds = 300 } = {}) {
  if (!secret) throw new Error('WEBHOOK_SECRET_REQUIRED');
  return Object.freeze({
    verify({ rawBody, signature, timestampSeconds, nowSeconds }) {
      return verifyWebhookSignature({ rawBody, signature, secret }) &&
        validateWebhookTimestamp(timestampSeconds, { nowSeconds, maxAgeSeconds });
    }
  });
}

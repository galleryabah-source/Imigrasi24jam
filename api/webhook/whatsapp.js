import { createHash, timingSafeEqual } from 'node:crypto';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function constantTimeHexEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'webhook_not_configured' });

  const timestamp = req.headers['x-webhook-timestamp'];
  const signature = req.headers['x-webhook-signature'];
  if (!timestamp || !signature) return res.status(401).json({ error: 'missing_signature' });

  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 300000) return res.status(401).json({ error: 'invalid_timestamp' });

  const digest = createHash('sha256').update(`${timestamp}.`).update(body).digest('hex');
  const expected = createHash('sha256').update(secret).update(digest).digest('hex');
  if (!constantTimeHexEqual(signature, expected)) return res.status(401).json({ error: 'invalid_signature' });

  return res.status(501).json({ error: 'webhook_adapter_not_wired' });
}

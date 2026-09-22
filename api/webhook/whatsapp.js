import { createWebhookSecurityGate } from '../../src/integrations/whatsapp/webhook-security.js';
import { processWhatsAppWebhook } from '../../src/integrations/whatsapp/webhook-pipeline.js';
import { createInboxOutboxRepository } from '../../src/core/inbox-outbox-repository.js';
import { createPostgresAdapter } from '../../src/db/postgres-adapter.js';

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
let inboxTransaction;

function getInboxTransaction() {
  if (inboxTransaction) return inboxTransaction;
  const db = createPostgresAdapter();
  const repository = createInboxOutboxRepository(db);
  inboxTransaction = Object.freeze({
    ingest: async ({ provider, providerMessageId, conversationId, sender, payload, replayKey }) => {
      const result = await repository.claimInboundWithReplay({
        provider,
        providerMessageId,
        conversationId,
        sender,
        payload,
        replayKey
      });
      return result;
    }
  });
  return inboxTransaction;
}

function readBody(req, maxBytes = MAX_WEBHOOK_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;

    req.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (tooLarge) return resolve(null);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function safeWebhookError(error) {
  const code = typeof error?.code === 'string' ? error.code : 'WEBHOOK_PROCESSING_ERROR';
  const message = typeof error?.message === 'string' ? error.message.slice(0, 200) : 'webhook processing failed';
  return `${code}: ${message}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'webhook_not_configured' });

  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return res.status(413).json({ error: 'webhook_body_too_large' });
  }

  const rawBody = await readBody(req);
  if (rawBody === null) return res.status(413).json({ error: 'webhook_body_too_large' });

  const securityGate = createWebhookSecurityGate({ secret });
  const signature = req.headers['x-signature'];
  const timestampSeconds = req.headers['x-timestamp'];

  try {
    const result = await processWhatsAppWebhook({
      rawBody,
      signature,
      timestampSeconds,
      securityGate,
      inboxTransaction: getInboxTransaction()
    });
    return res.status(result.status).json(result);
  } catch (error) {
    console.error('whatsapp_webhook_failed', safeWebhookError(error));
    return res.status(500).json({ error: 'webhook_processing_failed' });
  }
}

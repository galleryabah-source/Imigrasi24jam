import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';
import { createWhatsAppReplayIdentity } from '../src/integrations/whatsapp/replay-identity.js';
import { canonicalizeWhatsAppMessage } from '../src/integrations/whatsapp/canonical-message.js';

const secret = 'integration-secret';
const timestamp = 1700000000;
const body = JSON.stringify({ id: 'wamid-pipeline-1', from: 'user-1', type: 'text', text: ' hello ' });
const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

function makeTransaction() {
  let admitted = false;
  let inboxWrites = 0;
  return {
    async ingest(input) {
      if (admitted) return { accepted: false, inboxId: null };
      admitted = true;
      inboxWrites += 1;
      return { accepted: true, inboxId: `inbox-${inboxWrites}` };
    },
    get inboxWrites() { return inboxWrites; }
  };
}

test('valid event is admitted once through security, canonicalization and replay identity', async () => {
  const security = createWebhookSecurityGate({ secret, maxAgeSeconds: 300 });
  assert.equal(security.verify({ rawBody: body, signature, timestampSeconds: timestamp, nowSeconds: timestamp }), true);
  const canonical = canonicalizeWhatsAppMessage(JSON.parse(body));
  const replayKey = createWhatsAppReplayIdentity({ provider: canonical.provider, messageId: canonical.messageId, timestamp });
  const tx = makeTransaction();
  const first = await tx.ingest({ provider: canonical.provider, providerMessageId: canonical.messageId, conversationId: canonical.conversationId, sender: canonical.sender, payload: canonical, replayKey });
  const second = await tx.ingest({ provider: canonical.provider, providerMessageId: canonical.messageId, conversationId: canonical.conversationId, sender: canonical.sender, payload: canonical, replayKey });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(tx.inboxWrites, 1);
});

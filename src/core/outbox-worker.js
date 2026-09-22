import { AUDIT_EVENTS, createAuditEvent } from './audit-contract.js';

export const RETRY_DELAYS_SECONDS = Object.freeze([30, 120, 600, 1800, 3600]);
export const DEFAULT_PROVIDER_TIMEOUT_MS = 15000;
export const MIN_OUTBOX_LEASE_SECONDS = 30;
export const DEFAULT_OUTBOX_HEARTBEAT_SECONDS = 20;

function errorMessage(error) { return String(error?.message ?? error).slice(0, 2000); }
function isTerminalPolicyError(error) { const message = errorMessage(error); return message.startsWith('OUTBOUND_ATTACHMENT_BLOCKED:') || message === 'OUTBOX_ATTACHMENT_REVALIDATION_REQUIRED'; }
function validateProviderResult(result) {
  if (!result || typeof result !== 'object') throw new Error('PROVIDER_ACK_INVALID');
  const providerMessageId = result.provider_message_id == null ? null : String(result.provider_message_id).trim();
  if (result.accepted !== true && !providerMessageId) throw new Error('PROVIDER_ACK_MISSING');
  return Object.freeze({ provider_message_id: providerMessageId || null });
}
function requireTimeout(timeoutMs) { if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('INVALID_PROVIDER_TIMEOUT_MS'); return timeoutMs; }
function requireLeaseSeconds(leaseSeconds, timeoutMs) {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < MIN_OUTBOX_LEASE_SECONDS) throw new Error('INVALID_OUTBOX_LEASE_SECONDS');
  if (leaseSeconds <= Math.ceil(timeoutMs / 1000)) throw new Error('OUTBOX_LEASE_MUST_EXCEED_PROVIDER_TIMEOUT');
  return leaseSeconds;
}
function requireHeartbeatSeconds(value, leaseSeconds) {
  if (!Number.isInteger(value) || value <= 0 || value >= leaseSeconds) throw new Error('INVALID_OUTBOX_HEARTBEAT_SECONDS');
  return value;
}
async function sendWithTimeout(provider, payload, options, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      provider.send(payload, { ...options, signal: controller.signal }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(new Error('PROVIDER_TIMEOUT')); reject(new Error('PROVIDER_TIMEOUT')); }, timeoutMs); })
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
export function calculateRetry(attemptCount) {
  const n = Number(attemptCount);
  if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_ATTEMPT_COUNT');
  if (n >= RETRY_DELAYS_SECONDS.length) return Object.freeze({ terminal: true, delay_seconds: null });
  return Object.freeze({ terminal: false, delay_seconds: RETRY_DELAYS_SECONDS[n] });
}
function startLeaseHeartbeat(repository, job, leaseSeconds, heartbeatSeconds) {
  if (typeof repository.renewOutboundLease !== 'function') return () => {};
  let stopped = false;
  const renew = async () => { if (stopped) return; try { await repository.renewOutboundLease({ outboxId: job.id, leaseSeconds }); } catch { /* final state transition enforces ownership */ } };
  const timer = setInterval(renew, heartbeatSeconds * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
export function createOutboxWorker({ repository, provider, providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS, leaseSeconds = 60, leaseHeartbeatSeconds = DEFAULT_OUTBOX_HEARTBEAT_SECONDS } = {}) {
  if (!repository || typeof repository.claimPendingOutbound !== 'function' || typeof repository.markOutboundSent !== 'function' || typeof repository.scheduleOutboundRetry !== 'function' || typeof repository.markOutboundFailed !== 'function') throw new Error('OUTBOX_REPOSITORY_REQUIRED');
  if (!provider || typeof provider.send !== 'function') throw new Error('PROVIDER_ADAPTER_REQUIRED');
  requireTimeout(providerTimeoutMs); requireLeaseSeconds(leaseSeconds, providerTimeoutMs); requireHeartbeatSeconds(leaseHeartbeatSeconds, leaseSeconds);
  return Object.freeze({
    async processOne() {
      const job = await repository.claimPendingOutbound();
      if (!job) return Object.freeze({ status: 'IDLE' });
      const stopHeartbeat = startLeaseHeartbeat(repository, job, leaseSeconds, leaseHeartbeatSeconds);
      try {
        if (!job.id || !job.payload_json || typeof job.payload_json !== 'object') {
          try { await repository.markOutboundFailed(job.id, 'OUTBOX_JOB_INVALID'); } catch {}
          return Object.freeze({ status: 'FAILED', id: job.id ?? null });
        }
        let providerResult;
        try {
          const attachments = Array.isArray(job.payload_json.attachments) ? job.payload_json.attachments : [];
          if (attachments.length) {
            if (typeof repository.revalidateOutboundAttachments !== 'function') throw new Error('OUTBOX_ATTACHMENT_REVALIDATION_REQUIRED');
            const validation = await repository.revalidateOutboundAttachments(job.payload_json);
            if (!validation?.allowed) throw new Error(`OUTBOUND_ATTACHMENT_BLOCKED:${validation?.reason ?? validation?.blocked_document_ids?.join(',') ?? 'POLICY'}`);
          }
          providerResult = await sendWithTimeout(provider, job.payload_json, { idempotency_key: `imigrasi24jam:outbox:${job.id}` }, providerTimeoutMs);
          providerResult = validateProviderResult(providerResult);
        } catch (error) {
          const message = errorMessage(error);
          if (isTerminalPolicyError(error)) { await repository.markOutboundFailed(job.id, message); return Object.freeze({ status: 'FAILED_POLICY', id: job.id }); }
          const retry = calculateRetry(job.attempt_count);
          if (retry.terminal) { await repository.markOutboundFailed(job.id, message); return Object.freeze({ status: 'FAILED', id: job.id }); }
          await repository.scheduleOutboundRetry(job.id, retry.delay_seconds, message);
          return Object.freeze({ status: 'RETRY', id: job.id, delay_seconds: retry.delay_seconds });
        }
        try {
          const auditEvent = createAuditEvent({ eventType: AUDIT_EVENTS.ANSWER_SERVED, subjectType: 'MESSAGE_OUTBOX', subjectId: job.id, after: { delivery_state: 'SENT', provider_message_id: providerResult.provider_message_id, conversation_id: job.conversation_id ?? null, reply_to_message_id: job.reply_to_message_id ?? null }, reason: 'Provider accepted outbound answer' });
          await repository.markOutboundSent(job.id, providerResult.provider_message_id, auditEvent);
          return Object.freeze({ status: 'SENT', id: job.id });
        } catch (error) {
          const message = `ACK_PERSISTENCE_FAILED:${errorMessage(error)}`;
          const retry = calculateRetry(job.attempt_count);
          if (retry.terminal) { await repository.markOutboundFailed(job.id, message); return Object.freeze({ status: 'FAILED_ACK', id: job.id }); }
          await repository.scheduleOutboundRetry(job.id, retry.delay_seconds, message);
          return Object.freeze({ status: 'RETRY_ACK', id: job.id, delay_seconds: retry.delay_seconds });
        }
      } finally { stopHeartbeat(); }
    }
  });
}

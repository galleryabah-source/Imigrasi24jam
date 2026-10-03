import { createConversationState, transitionConversation } from './conversation-orchestrator.js';
import { resolveIntent } from './intent-registry.js';
import { retrieveOffline } from './offline-retrieval.js';
import { buildDeterministicAnswer, renderPlainAnswer } from './answer-builder.js';
import { evaluateAnswerSafety } from './answer-safety-gate.js';
import { AUDIT_EVENTS } from './audit-contract.js';

function lifecycleEvent(type, state, correlationId) {
  return Object.freeze({ event_type:type, subject_type:'CONVERSATION', subject_id:state.conversation_id, correlation_id:correlationId });
}
function resultWithLifecycle(result, lifecycle) {
  return Object.freeze({ ...result, lifecycle:Object.freeze(lifecycle) });
}
const FALLBACKS = Object.freeze({
  OUT_OF_SCOPE: 'Maaf, layanan ini hanya menangani informasi keimigrasian.',
  CLARIFICATION: 'Mohon jelaskan layanan keimigrasian yang ingin ditanyakan.',
  SAFE_FALLBACK: 'Informasi belum dapat diberikan secara aman. Silakan perjelas pertanyaan atau hubungi petugas.',
  ESCALATION: 'Pertanyaan Anda memerlukan pemeriksaan petugas. Silakan lanjutkan melalui kanal layanan resmi.'
});

export async function orchestrateMessage({ message, conversation = null, knowledge = [], evidenceByKnowledgeId = {}, now = new Date().toISOString() }) {
  const text = String(message?.text ?? '').trim();
  if (!text) return Object.freeze({ status:'IGNORED', reason:'EMPTY_MESSAGE' });

  const correlationId = message.correlationId ?? message.providerMessageId ?? message.messageId ?? message.from ?? message.conversationId ?? 'unknown';
  const lifecycle = [];
  let state = conversation ?? createConversationState({ conversationId:message.conversationId ?? message.from ?? 'unknown', userId:message.userId ?? null });
  lifecycle.push(lifecycleEvent(AUDIT_EVENTS.MESSAGE_RECEIVED, state, correlationId));

  const intent = resolveIntent(text);
  if (intent.code === 'OUT_OF_SCOPE') {
    state = transitionConversation(state, { type:'OUT_OF_SCOPE' });
    lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
    return resultWithLifecycle({ status:'OUT_OF_SCOPE', state, intent, response:FALLBACKS.OUT_OF_SCOPE, text:FALLBACKS.OUT_OF_SCOPE }, lifecycle);
  }
  if (intent.intent === 'AMBIGUOUS' || intent.confidence <= 0.5) {
    state = transitionConversation(state, { type:'AMBIGUOUS_INTENT', question:FALLBACKS.CLARIFICATION });
    lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
    return resultWithLifecycle({ status:'CLARIFICATION', state, intent, response:FALLBACKS.CLARIFICATION, text:FALLBACKS.CLARIFICATION }, lifecycle);
  }

  state = transitionConversation(state, { type:'INTENT_RESOLVED', intent:intent.code });
  lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
  const retrieval = retrieveOffline(knowledge, { intent:intent.code, query:text, at:now, verifiedEvidenceByKnowledgeId:evidenceByKnowledgeId });
  if (retrieval.status !== 'RESOLVED') {
    state = transitionConversation(state, { type:'ESCALATE' });
    lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
    return resultWithLifecycle({ status:'ESCALATION', state, intent, retrieval, response:FALLBACKS.ESCALATION, text:FALLBACKS.ESCALATION }, lifecycle);
  }

  const selected = retrieval.items[0].item;
  const evidence = evidenceByKnowledgeId[selected.id] ?? [];
  let answer;
  try {
    answer = buildDeterministicAnswer({ knowledge:selected, evidence });
  } catch (error) {
    state = transitionConversation(state, { type:'ESCALATE' });
    lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
    return resultWithLifecycle({ status:'SAFE_FALLBACK', state, intent, retrieval, reason:error.message, response:FALLBACKS.SAFE_FALLBACK, text:FALLBACKS.SAFE_FALLBACK }, lifecycle);
  }

  const safety = evaluateAnswerSafety({ intent:intent.code, answer:answer.direct_answer, sources:evidence, confidence:retrieval.items[0].score, providerAvailable:false });
  if (safety.decision !== 'ANSWER') {
    state = transitionConversation(state, { type:'ESCALATE' });
    lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
    return resultWithLifecycle({ status:'SAFE_FALLBACK', state, intent, retrieval, safety, response:FALLBACKS.SAFE_FALLBACK, text:FALLBACKS.SAFE_FALLBACK }, lifecycle);
  }
  state = transitionConversation(state, { type:'RETRIEVAL_RESOLVED' });
  lifecycle.push(lifecycleEvent(AUDIT_EVENTS.CONVERSATION_TRANSITIONED, state, correlationId));
  lifecycle.push(lifecycleEvent(AUDIT_EVENTS.ANSWER_SERVED, state, correlationId));
  const rendered = renderPlainAnswer(answer);
  return resultWithLifecycle({ status:'ANSWER', state, intent, retrieval, answer, text:rendered, response:rendered, safety }, lifecycle);
}

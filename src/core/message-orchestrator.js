import { createConversationState, transitionConversation } from './conversation-orchestrator.js';
import { resolveIntent } from './intent-registry.js';
import { retrieveOffline } from './offline-retrieval.js';
import { buildDeterministicAnswer, renderPlainAnswer } from './answer-builder.js';
import { evaluateAnswerSafety } from './answer-safety-gate.js';

export async function orchestrateMessage({ message, conversation = null, knowledge = [], evidenceByKnowledgeId = {}, now = new Date().toISOString() }) {
  const text = String(message?.text ?? '').trim();
  if (!text) return Object.freeze({ status: 'IGNORED', reason: 'EMPTY_MESSAGE' });

  let state = conversation ?? createConversationState({ conversationId: message.conversationId ?? message.from ?? 'unknown', userId: message.userId ?? null });
  const intent = resolveIntent(text);
  if (intent.code === 'OUT_OF_SCOPE') {
    state = transitionConversation(state, { type: 'OUT_OF_SCOPE' });
    return Object.freeze({ status: 'OUT_OF_SCOPE', state, intent });
  }
  if (intent.intent === 'AMBIGUOUS' || intent.confidence <= 0.5) {
    state = transitionConversation(state, { type: 'AMBIGUOUS_INTENT', question: 'Mohon jelaskan layanan keimigrasian yang ingin ditanyakan.' });
    return Object.freeze({ status: 'CLARIFICATION', state, intent, response: state.pending_question });
  }

  state = transitionConversation(state, { type: 'INTENT_RESOLVED', intent: intent.code });
  const retrieval = retrieveOffline(knowledge, {
    intent: intent.code,
    query: text,
    at: now,
    verifiedEvidenceByKnowledgeId: evidenceByKnowledgeId
  });
  if (retrieval.status !== 'RESOLVED') {
    state = transitionConversation(state, { type: 'ESCALATE' });
    return Object.freeze({ status: retrieval.status, state, intent, retrieval });
  }

  const selected = retrieval.items[0].item;
  const evidence = evidenceByKnowledgeId[selected.id] ?? [];
  let answer;
  try {
    answer = buildDeterministicAnswer({ knowledge: selected, evidence });
  } catch (error) {
    state = transitionConversation(state, { type: 'ESCALATE' });
    return Object.freeze({ status: 'SAFE_FALLBACK', state, intent, retrieval, reason: error.message });
  }

  const safety = evaluateAnswerSafety({ intent: intent.code, answer: answer.direct_answer, sources: evidence, confidence: retrieval.items[0].score, providerAvailable: false });
  if (safety.decision !== 'ANSWER') {
    state = transitionConversation(state, { type: 'ESCALATE' });
    return Object.freeze({ status: 'SAFE_FALLBACK', state, intent, retrieval, safety });
  }
  state = transitionConversation(state, { type: 'RETRIEVAL_RESOLVED' });
  return Object.freeze({ status: 'ANSWER', state, intent, retrieval, answer, text: renderPlainAnswer(answer), safety });
}

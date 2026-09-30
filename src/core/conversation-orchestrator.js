const STATES = Object.freeze(['NEW','CLARIFICATION','RETRIEVAL','ANSWERING','ESCALATION','CLOSED']);

const ALLOWED_EVENTS = Object.freeze({
  NEW: Object.freeze(['OUT_OF_SCOPE', 'AMBIGUOUS_INTENT', 'INTENT_RESOLVED', 'ESCALATE', 'CLOSE']),
  CLARIFICATION: Object.freeze(['OUT_OF_SCOPE', 'INTENT_RESOLVED', 'ESCALATE', 'CLOSE']),
  RETRIEVAL: Object.freeze(['RETRIEVAL_RESOLVED', 'ESCALATE', 'CLOSE']),
  ANSWERING: Object.freeze(['ESCALATE', 'CLOSE']),
  ESCALATION: Object.freeze(['CLOSE']),
  CLOSED: Object.freeze([])
});

const ALL_EVENTS = new Set(Object.values(ALLOWED_EVENTS).flat());

export function createConversationState({ conversationId, userId = null }) {
  if (!conversationId) throw new Error('CONVERSATION_ID_REQUIRED');
  return Object.freeze({ conversation_id: conversationId, user_id: userId, state: 'NEW', scope: null, intent: null, sub_intent: null, pending_question: null, turn_count: 0 });
}

export function transitionConversation(state, event) {
  if (!state || !STATES.includes(state.state)) throw new Error('INVALID_CONVERSATION_STATE');
  const type = event?.type;
  if (!ALL_EVENTS.has(type)) throw new Error('INVALID_CONVERSATION_EVENT');
  if (!ALLOWED_EVENTS[state.state].includes(type)) throw new Error('INVALID_CONVERSATION_TRANSITION');

  const next = { ...state, turn_count: state.turn_count + 1 };
  switch (type) {
    case 'OUT_OF_SCOPE': return Object.freeze({ ...next, state: 'CLOSED', scope: 'OUT_OF_SCOPE' });
    case 'AMBIGUOUS_INTENT': return Object.freeze({ ...next, state: 'CLARIFICATION', pending_question: event.question ?? null });
    case 'INTENT_RESOLVED': return Object.freeze({ ...next, state: 'RETRIEVAL', scope: 'IMMIGRATION', intent: event.intent, sub_intent: event.subIntent ?? null, pending_question: null });
    case 'RETRIEVAL_RESOLVED': return Object.freeze({ ...next, state: 'ANSWERING' });
    case 'ESCALATE': return Object.freeze({ ...next, state: 'ESCALATION' });
    case 'CLOSE': return Object.freeze({ ...next, state: 'CLOSED' });
    default: throw new Error('INVALID_CONVERSATION_EVENT');
  }
}

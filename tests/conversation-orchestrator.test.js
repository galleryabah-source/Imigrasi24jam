import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationState, transitionConversation } from '../src/core/conversation-orchestrator.js';

test('conversation starts in NEW state', () => {
  assert.equal(createConversationState({ conversationId: 'C1' }).state, 'NEW');
});

test('ambiguous intent enters clarification', () => {
  const state = transitionConversation(createConversationState({ conversationId: 'C1' }), { type: 'AMBIGUOUS_INTENT', question: 'Mohon jelaskan layanan yang dimaksud.' });
  assert.equal(state.state, 'CLARIFICATION');
});

test('resolved immigration intent enters retrieval', () => {
  const initial = createConversationState({ conversationId: 'C1' });
  const state = transitionConversation(initial, { type: 'INTENT_RESOLVED', intent: 'PASSPORT', subIntent: 'NEW' });
  assert.equal(state.state, 'RETRIEVAL');
  assert.equal(state.scope, 'IMMIGRATION');
});

test('out-of-scope closes conversation', () => {
  const state = transitionConversation(createConversationState({ conversationId: 'C1' }), { type: 'OUT_OF_SCOPE' });
  assert.equal(state.state, 'CLOSED');
  assert.equal(state.scope, 'OUT_OF_SCOPE');
});

test('invalid transition event is rejected', () => {
  assert.throws(() => transitionConversation(createConversationState({ conversationId: 'C1' }), { type: 'UNKNOWN' }), /INVALID_CONVERSATION_EVENT/);
});


test('conversation rejects transitions that are invalid for the current state', () => {
  const answering = transitionConversation(
    transitionConversation(
      createConversationState({ conversationId: 'C1' }),
      { type: 'INTENT_RESOLVED', intent: 'PASSPORT' }
    ),
    { type: 'RETRIEVAL_RESOLVED' }
  );
  assert.equal(answering.state, 'ANSWERING');
  assert.throws(
    () => transitionConversation(answering, { type: 'INTENT_RESOLVED', intent: 'VISA' }),
    /INVALID_CONVERSATION_TRANSITION/
  );
});

test('closed conversation cannot be reopened by a later event', () => {
  const closed = transitionConversation(createConversationState({ conversationId: 'C1' }), { type: 'OUT_OF_SCOPE' });
  assert.throws(
    () => transitionConversation(closed, { type: 'INTENT_RESOLVED', intent: 'PASSPORT' }),
    /INVALID_CONVERSATION_TRANSITION/
  );
});

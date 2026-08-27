import { domainGuard } from './domain-guard.js';
import { normalizeText } from './normalization.js';
import { isAnswerUsable } from './policy-engine.js';

export function resolveAnswer(message, answers, now = new Date()) {
  const guard = domainGuard(message);
  if (!guard.allowed) {
    return { status: 'OUT_OF_DOMAIN', answer: null, guard };
  }

  const normalized = normalizeText(message);
  const candidates = (answers ?? []).filter((answer) =>
    isAnswerUsable(answer, now) &&
    Array.isArray(answer.question_patterns) &&
    answer.question_patterns.some((pattern) => normalizeText(pattern) === normalized)
  );

  if (!candidates.length) {
    return { status: 'NO_DETERMINISTIC_MATCH', answer: null, guard };
  }

  return { status: 'RESOLVED', answer: candidates[0], guard };
}

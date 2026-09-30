import { domainGuard } from './domain-guard.js';
import { normalizeText } from './normalization.js';
import { isAnswerUsable } from './policy-engine.js';
import { classifyIntent } from './intent-registry.js';

function scorePattern(pattern, normalized) {
  const candidate = normalizeText(pattern);
  if (!candidate || !normalized) return 0;
  if (candidate === normalized) return 1;
  const candidateTokens = new Set(candidate.split(' '));
  const queryTokens = new Set(normalized.split(' '));
  const overlap = [...candidateTokens].filter((token) => queryTokens.has(token)).length;
  return overlap / Math.max(candidateTokens.size, queryTokens.size);
}

export function resolveAnswer(message, answers, now = new Date()) {
  const guard = domainGuard(message);
  if (!guard.allowed) return { status: 'OUT_OF_DOMAIN', answer: null, guard };

  const normalized = normalizeText(message);
  const classification = classifyIntent(normalized);
  if (classification.intent === 'AMBIGUOUS') {
    return { status: 'AMBIGUOUS_INTENT', answer: null, guard, classification };
  }
  if (classification.intent === 'OUT_OF_DOMAIN') {
    return { status: 'OUT_OF_DOMAIN', answer: null, guard, classification };
  }

  const candidates = (answers ?? [])
    .filter((answer) => isAnswerUsable(answer, now))
    .filter((answer) => !answer.intent || answer.intent === classification.intent)
    .map((answer) => ({
      answer,
      score: Math.max(...(answer.question_patterns ?? []).map((pattern) => scorePattern(pattern, normalized)), 0)
    }))
    .filter(({ score }) => score >= 0.55)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return { status: 'NO_DETERMINISTIC_MATCH', answer: null, guard, classification };
  }

  const best = candidates[0];
  const second = candidates[1];
  if (second && best.score - second.score < 0.08) {
    return { status: 'AMBIGUOUS_MATCH', answer: null, guard, classification, candidates: candidates.slice(0, 3) };
  }

  return {
    status: 'RESOLVED',
    answer: best.answer,
    confidence: best.score,
    guard,
    classification
  };
}

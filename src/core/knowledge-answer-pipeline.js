import { domainGuard } from './domain-guard.js';
import { retrieveOffline } from './offline-retrieval.js';
import { buildDeterministicAnswer, renderPlainAnswer } from './answer-builder.js';

export function answerFromKnowledge({ text, intent, subIntent = null, candidates = [], at = new Date().toISOString(), locale = 'id-ID' }) {
  const scope = domainGuard(text);
  if (!scope.allowed) return Object.freeze({ status:'OUT_OF_SCOPE', reason:scope.reason });

  const retrieval = retrieveOffline(candidates, { intent, subIntent, query:text, at });
  if (retrieval.status !== 'RESOLVED') return Object.freeze({ status:'ESCALATE', reason:retrieval.reason, candidates:retrieval.items });

  const best = retrieval.items[0].item;
  const answer = buildDeterministicAnswer({ knowledge:best, evidence:best.verified_evidence, locale });
  return Object.freeze({ status:'ANSWERED', answer, text:renderPlainAnswer(answer), evidenceIds:answer.evidence_ids });
}

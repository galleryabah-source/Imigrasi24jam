const ALLOWED_FIELDS = Object.freeze(['greeting','direct_answer','requirements','procedure','fee','timeframe','official_reference','escalation']);

export function buildDeterministicAnswer({ knowledge, evidence = [], locale = 'id-ID' }) {
  if (!knowledge || knowledge.status !== 'PUBLISHED') throw new Error('KNOWLEDGE_NOT_PUBLISHED');
  const verified = evidence.filter((e) => e && e.status === 'VERIFIED');
  if (!verified.length) throw new Error('VERIFIED_EVIDENCE_REQUIRED');

  const answer = { locale, source_knowledge_id: knowledge.id, evidence_ids: verified.map((e) => e.id) };
  for (const field of ALLOWED_FIELDS) {
    if (knowledge[field] !== undefined && knowledge[field] !== null && String(knowledge[field]).trim() !== '') answer[field] = knowledge[field];
  }
  return Object.freeze(answer);
}

export function renderPlainAnswer(answer) {
  if (!answer || !answer.direct_answer) throw new Error('DIRECT_ANSWER_REQUIRED');
  const lines = [];
  if (answer.greeting) lines.push(answer.greeting);
  lines.push(answer.direct_answer);
  if (answer.requirements) lines.push(`\nPersyaratan:\n${answer.requirements}`);
  if (answer.procedure) lines.push(`\nProsedur:\n${answer.procedure}`);
  if (answer.fee) lines.push(`\nBiaya:\n${answer.fee}`);
  if (answer.timeframe) lines.push(`\nPerkiraan waktu:\n${answer.timeframe}`);
  if (answer.official_reference) lines.push(`\nReferensi resmi:\n${answer.official_reference}`);
  if (answer.escalation) lines.push(`\n${answer.escalation}`);
  return lines.join('\n');
}

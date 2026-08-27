export function isAnswerUsable(answer, now = new Date()) {
  if (!answer || answer.status !== 'PUBLISHED') return false;
  const at = now.getTime();
  if (answer.effective_from && new Date(answer.effective_from).getTime() > at) return false;
  if (answer.effective_until && new Date(answer.effective_until).getTime() <= at) return false;
  return Boolean(answer.source_id);
}

export function canAttachDocument(document) {
  return Boolean(
    document &&
    document.access_classification === 'PUBLIC' &&
    document.status === 'PUBLISHED' &&
    document.allow_whatsapp_attachment === true
  );
}

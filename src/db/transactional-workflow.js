export async function runTransactionalKnowledgeWorkflow(db, workflow) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  if (!workflow || typeof workflow.createSource !== 'function' || typeof workflow.createDocument !== 'function' || typeof workflow.createValidation !== 'function' || typeof workflow.createCandidate !== 'function' || typeof workflow.createAudit !== 'function') {
    throw new Error('INVALID_KNOWLEDGE_WORKFLOW');
  }

  return db.transaction(async (tx) => {
    const source = await workflow.createSource(tx);
    const document = await workflow.createDocument(tx, source);
    const validation = await workflow.createValidation(tx, document);
    const candidate = await workflow.createCandidate(tx, { source, document, validation });
    const audit = await workflow.createAudit(tx, { source, document, validation, candidate });
    return Object.freeze({ source, document, validation, candidate, audit });
  });
}

export async function runApprovalPublicationTransaction(db, workflow) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  if (!workflow || typeof workflow.approve !== 'function' || typeof workflow.publish !== 'function' || typeof workflow.createAudit !== 'function') {
    throw new Error('INVALID_APPROVAL_WORKFLOW');
  }

  return db.transaction(async (tx) => {
    const approval = await workflow.approve(tx);
    const publication = await workflow.publish(tx, approval);
    const audit = await workflow.createAudit(tx, { approval, publication });
    return Object.freeze({ approval, publication, audit });
  });
}


export async function runTransactionalMessageLifecycle(db, workflow) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  const required = ['admitInbound', 'processConversation', 'enqueueOutbound', 'writeAudit'];
  if (!workflow || required.some((name) => typeof workflow[name] !== 'function')) {
    throw new Error('INVALID_MESSAGE_LIFECYCLE_WORKFLOW');
  }

  return db.transaction(async (tx) => {
    const inbound = await workflow.admitInbound(tx);
    if (!inbound) return Object.freeze({ status: 'DUPLICATE_OR_REJECTED', inbound: null, conversation: null, outbound: null, audit: [] });

    const conversation = await workflow.processConversation(tx, inbound);
    const outbound = await workflow.enqueueOutbound(tx, { inbound, conversation });
    const audit = await workflow.writeAudit(tx, { inbound, conversation, outbound });
    return Object.freeze({ status: 'COMMITTED', inbound, conversation, outbound, audit });
  });
}

export class KnowledgeRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') throw new Error('DATABASE_ADAPTER_REQUIRED');
    this.db = db;
  }

  async findEffectiveByIntent(intent, at = new Date().toISOString()) {
    const result = await this.db.query(`
      SELECT k.*, av.id AS answer_version_id, av.answer_text, av.version_number AS answer_version_number
      FROM knowledge_items k
      LEFT JOIN answer_versions av ON av.knowledge_item_id = k.id AND av.status = 'PUBLISHED'
      WHERE k.intent_id = $1 AND k.status = 'PUBLISHED'
        AND (k.effective_from IS NULL OR k.effective_from <= $2::timestamptz)
        AND (k.effective_until IS NULL OR $2::timestamptz < k.effective_until)
      ORDER BY k.effective_from DESC NULLS LAST, k.updated_at DESC
    `, [intent, at]);
    return result.rows;
  }

  async getVerifiedEvidence(knowledgeItemId) {
    const result = await this.db.query(`
      SELECT e.*, ke.role
      FROM knowledge_evidence ke
      JOIN evidence_items e ON e.id = ke.evidence_id
      WHERE ke.knowledge_item_id = $1 AND e.status = 'VERIFIED'
      ORDER BY CASE ke.role WHEN 'PRIMARY' THEN 1 WHEN 'SUPPORTING' THEN 2 ELSE 3 END, e.page_number NULLS LAST
    `, [knowledgeItemId]);
    return result.rows;
  }
}

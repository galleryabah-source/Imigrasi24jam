import { resolveIntent } from './intent-registry.js';

const PUBLIC_DOCUMENT = 'PUBLIC';

function effectiveWindow(alias) {
  return `(${alias}.effective_from IS NULL OR ${alias}.effective_from <= $2::timestamptz)
    AND (${alias}.effective_until IS NULL OR $2::timestamptz < ${alias}.effective_until)`;
}

export function createPostgresKnowledgeProvider(db, { publicOnly = true } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('KNOWLEDGE_PROVIDER_DATABASE_REQUIRED');

  return async function getKnowledge({ message, now = new Date().toISOString() } = {}) {
    const text = String(message?.text ?? '').trim();
    const intent = resolveIntent(text);
    if (!text || !intent?.code || intent.code === 'OUT_OF_SCOPE' || intent.intent === 'AMBIGUOUS' || intent.confidence <= 0.5) {
      return Object.freeze({ items: [], evidenceByKnowledgeId: {}, intent });
    }

    const visibilityPredicate = publicOnly ? `
      AND d.access_classification = $3
      AND d.status = 'PUBLISHED'
      AND d.immigration_relevance_status = 'VERIFIED'
      AND d.authority_status = 'VERIFIED'
      AND d.content_integrity_status = 'VERIFIED'
      AND d.quarantined = false
    ` : '';

    const sql = `
      SELECT
        ki.id,
        i.code AS intent,
        ki.status,
        ki.effective_from,
        ki.effective_until,
        COALESCE(av.source_id, ki.source_id) AS source_id,
        ks.authority_name,
        ks.title AS source_title,
        ks.reference_number,
        av.answer_text AS direct_answer,
        COALESCE(qp.question_patterns, ARRAY[]::text[]) AS question_patterns,
        COALESCE(ev.evidence, '[]'::jsonb) AS verified_evidence
      FROM knowledge_items ki
      JOIN intents i ON i.id = ki.intent_id AND i.status = 'ACTIVE'
      LEFT JOIN LATERAL (
        SELECT av.answer_text, av.source_id
        FROM answer_versions av
        WHERE av.knowledge_item_id = ki.id
          AND av.status = 'PUBLISHED'
          AND ${effectiveWindow('av')}
        ORDER BY av.version_number DESC
        LIMIT 1
      ) av ON true
      LEFT JOIN LATERAL (
        SELECT array_agg(qp.pattern_text ORDER BY qp.id) AS question_patterns
        FROM question_patterns qp
        WHERE qp.knowledge_item_id = ki.id AND qp.status = 'ACTIVE'
      ) qp ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ei.id,
            'status', ei.status,
            'document_id', ei.document_id,
            'document_version_id', ei.document_version_id,
            'source_id', ei.source_id,
            'page_number', ei.page_number,
            'section_label', ei.section_label,
            'excerpt', ei.excerpt,
            'locator', ei.locator_json
          ) ORDER BY ei.created_at, ei.id
        ) AS evidence
        FROM knowledge_evidence ke
        JOIN evidence_items ei ON ei.id = ke.evidence_id
        JOIN documents d ON d.id = ei.document_id
        JOIN document_versions dv ON dv.id = ei.document_version_id AND dv.document_id = d.id
        WHERE ke.knowledge_item_id = ki.id
          AND ei.status = 'VERIFIED'
          ${visibilityPredicate}
      ) ev ON true
      JOIN knowledge_sources ks
        ON ks.id = COALESCE(av.source_id, ki.source_id)
       AND ks.status = 'ACTIVE'
       AND (ks.effective_from IS NULL OR ks.effective_from <= $2::timestamptz)
       AND (ks.effective_until IS NULL OR $2::timestamptz < ks.effective_until)
      WHERE ki.status = 'PUBLISHED'
        AND ${effectiveWindow('ki')}
        AND i.code = $1
        AND av.answer_text IS NOT NULL
        AND av.answer_text <> ''
        AND COALESCE(jsonb_array_length(ev.evidence), 0) > 0
        AND COALESCE(array_length(qp.question_patterns, 1), 0) > 0
      ORDER BY ki.id;
    `;

    const params = publicOnly ? [intent.code, now, PUBLIC_DOCUMENT] : [intent.code, now];
    const result = await db.query(sql, params);
    const items = result.rows.map((row) => Object.freeze({
      id: row.id,
      intent: row.intent,
      status: row.status,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      source_id: row.source_id,
      question_patterns: row.question_patterns,
      direct_answer: row.direct_answer,
      official_reference: [row.authority_name, row.source_title, row.reference_number].filter(Boolean).join(' — '),
      verified_evidence: row.verified_evidence
    }));
    const evidenceByKnowledgeId = Object.fromEntries(items.map((item) => [item.id, item.verified_evidence]));
    return Object.freeze({ items, evidenceByKnowledgeId, intent });
  };
}

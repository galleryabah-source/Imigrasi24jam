-- Imigrasi24jam migration 0003 — evidence/citation persistence
-- TEST/REVIEW ONLY. Additive; no destructive operation.

CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES knowledge_sources(id) ON DELETE RESTRICT,
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  section_label text,
  excerpt text NOT NULL,
  locator_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'REVIEW' CHECK (status IN ('REVIEW','VERIFIED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_evidence (
  knowledge_item_id uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'PRIMARY' CHECK (role IN ('PRIMARY','SUPPORTING','CONTEXT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_item_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_document_version ON evidence_items(document_id, document_version_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_evidence ON knowledge_evidence(evidence_id);

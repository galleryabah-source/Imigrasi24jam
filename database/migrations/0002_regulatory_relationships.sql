-- Imigrasi24jam migration 0002 — regulatory relationships
-- TEST/REVIEW ONLY. Additive; no destructive operation.

CREATE TABLE IF NOT EXISTS regulatory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE RESTRICT,
  target_source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE RESTRICT,
  relationship text NOT NULL CHECK (relationship IN ('AMENDS','REPEALS','REPLACES','PARTIALLY_REPLACES','IMPLEMENTS','REFERENCES','EXTENDS','EXPIRES')),
  evidence_id uuid,
  effective_from timestamptz,
  status text NOT NULL DEFAULT 'REVIEW' CHECK (status IN ('REVIEW','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_id <> target_source_id),
  UNIQUE(source_id, target_source_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_regulatory_relationship_source ON regulatory_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_relationship_target ON regulatory_relationships(target_source_id);

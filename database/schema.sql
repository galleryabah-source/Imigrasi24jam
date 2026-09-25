-- IMIGRASI24JAM Database Contract v1
-- PostgreSQL reference schema. Not a production migration.

CREATE TABLE knowledge_sources (
  id uuid PRIMARY KEY,
  source_type text NOT NULL,
  authority_name text NOT NULL,
  title text NOT NULL,
  reference_number text,
  source_url text,
  issued_at timestamptz,
  effective_from timestamptz,
  effective_until timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intents (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY,
  source_id uuid REFERENCES knowledge_sources(id),
  original_filename text NOT NULL,
  media_type text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  checksum_sha256 text NOT NULL,
  access_classification text NOT NULL CHECK (access_classification IN ('PUBLIC','PRIVATE-INTERNAL','RESTRICTED')),
  status text NOT NULL CHECK (status IN ('PENDING_SCAN','QUARANTINED','REVIEW','APPROVED','PUBLISHED','REJECTED','EXPIRED','ARCHIVED')),
  immigration_relevance_status text NOT NULL DEFAULT 'PENDING',
  authority_status text NOT NULL DEFAULT 'PENDING',
  content_integrity_status text NOT NULL DEFAULT 'PENDING',
  allow_whatsapp_attachment boolean NOT NULL DEFAULT false,
  quarantined boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  checksum_sha256 text NOT NULL,
  extracted_text_storage_key text,
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);

CREATE TABLE knowledge_items (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL REFERENCES intents(id),
  source_id uuid REFERENCES knowledge_sources(id),
  status text NOT NULL DEFAULT 'DRAFT',
  confidence_class text,
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_patterns (
  id uuid PRIMARY KEY,
  knowledge_item_id uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  pattern_text text NOT NULL,
  normalized_pattern text NOT NULL,
  language_code text NOT NULL DEFAULT 'id',
  weight numeric(6,4) NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_item_id, normalized_pattern, language_code)
);

CREATE TABLE answer_versions (
  id uuid PRIMARY KEY,
  knowledge_item_id uuid NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  answer_text text NOT NULL,
  source_id uuid REFERENCES knowledge_sources(id),
  status text NOT NULL DEFAULT 'DRAFT',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(knowledge_item_id, version_number)
);

CREATE TABLE policies (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  policy_type text NOT NULL,
  rule_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED','RETURNED')),
  reviewer_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_validations (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  validator_type text NOT NULL,
  validator_version text NOT NULL,
  result_status text NOT NULL,
  score numeric(7,4),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  actor_id uuid,
  event_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid,
  before_json jsonb,
  after_json jsonb,
  reason text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_patterns_normalized ON question_patterns(normalized_pattern);
CREATE INDEX idx_knowledge_intent_status ON knowledge_items(intent_id, status);
CREATE INDEX idx_documents_access_status ON documents(access_classification, status);
CREATE INDEX idx_documents_checksum ON documents(checksum_sha256);
CREATE INDEX idx_audit_subject ON audit_events(subject_type, subject_id, created_at);
CREATE INDEX idx_audit_correlation ON audit_events(correlation_id, created_at);

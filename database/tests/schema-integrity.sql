-- Database integrity verification queries for disposable/test PostgreSQL.
-- These queries intentionally inspect constraints and indexes; they do not mutate data.

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('knowledge_sources','intents','documents','document_versions','knowledge_items','question_patterns','answer_versions','policies','approvals','document_validations','audit_events')
ORDER BY table_name;

SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('knowledge_sources','intents','documents','document_versions','knowledge_items','question_patterns','answer_versions','policies','approvals','document_validations','audit_events')
ORDER BY tc.table_name, tc.constraint_name;

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('documents','question_patterns','knowledge_items','audit_events')
ORDER BY tablename, indexname;

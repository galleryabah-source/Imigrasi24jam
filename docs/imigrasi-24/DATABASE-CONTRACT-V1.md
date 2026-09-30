# IMIGRASI24JAM — Database Contract v1

**Status:** Engineering baseline

## Objective

The database is the durable knowledge and governance layer. Runtime answers must not depend on an AI provider.

## Core entities

### `knowledge_sources`
Authoritative or supporting origins for knowledge.

Required concepts: `id`, `source_type`, `authority_name`, `title`, `reference_number`, `source_url`, `issued_at`, `effective_from`, `effective_until`, `status`, `created_at`, `updated_at`.

### `documents`
Uploaded source assets and their security/publication state.

Required concepts: `id`, `source_id`, `original_filename`, `media_type`, `storage_key`, `checksum_sha256`, `access_classification`, `status`, `immigration_relevance_status`, `authority_status`, `content_integrity_status`, `allow_whatsapp_attachment`, `uploaded_by`, `created_at`, `updated_at`.

Access values: `PUBLIC`, `PRIVATE-INTERNAL`, `RESTRICTED`.

Document status values: `PENDING_SCAN`, `QUARANTINED`, `REVIEW`, `APPROVED`, `PUBLISHED`, `REJECTED`, `EXPIRED`, `ARCHIVED`.

### `document_versions`
Immutable logical versions of a source document. A new regulation/source revision must not overwrite historical provenance.

### `intents`
Canonical conversation intents and their lifecycle/status.

### `question_patterns`
Normalized customer-language patterns associated with an intent and knowledge item. Patterns are versioned and must be auditable.

### `knowledge_items`
Logical knowledge units connecting intent, source, policy, and answer material.

Required concepts: `id`, `intent_id`, `source_id`, `status`, `confidence_class`, `effective_from`, `effective_until`, `created_at`, `updated_at`.

### `answer_versions`
Immutable answer revisions. Each published answer must identify its source and effective period.

### `policies`
Deterministic rules governing eligibility, publication, response, attachment, escalation, and other service behavior.

### `approvals`
Explicit human governance decisions for knowledge/document publication.

### `document_validations`
Machine validation results, validator version, score/status, reasons, and timestamps.

### `audit_events`
Append-only audit records for consequential changes and decisions.

## Required relationships

`source → document → document_version → validation → approval → publication`

`source → knowledge_item → question_pattern → answer_version → policy`

`knowledge_item → approval`

`document → attachment_policy`

## Public publication invariant

A document cannot be used as a public knowledge source or WhatsApp attachment merely because an uploader selected `PUBLIC`.

Minimum publication requirements:

- access classification is `PUBLIC`;
- document status is `PUBLISHED`;
- immigration relevance is `VERIFIED`;
- authority status is `VERIFIED`;
- content integrity is `VERIFIED`;
- explicit approval exists;
- effective dates permit use;
- no quarantine/rejection condition is active.

## WhatsApp attachment invariant

Attachment requires all publication requirements plus:

- `allow_whatsapp_attachment = true`;
- document is relevant to the current approved intent/topic;
- backend authorization succeeds;
- attachment is not superseded/expired;
- outbound audit event is recorded.

`PRIVATE-INTERNAL` and `RESTRICTED` are denied by default for public attachment.

## AI independence invariant

No table or runtime contract may require an AI provider identifier to resolve a known published answer. AI enrichment metadata may exist, but it is supplementary.

## Versioning invariant

Updates create new versions where historical truth matters. Published knowledge must remain traceable to its source and effective period.

## Migration policy

No production migration is authorized from this document alone. Schema implementation must first be reviewed against the existing runtime contracts, then migrated in a controlled branch with rollback strategy and CI/database verification.

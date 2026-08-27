# IMIGRASI 24 — Answer Database Schema

**Status:** Brainstorming Baseline v1.1

## Objective

Create a durable answer/knowledge data layer that can serve public questions without an AI API and can be enriched by AI when an approved provider is connected.

## Core entities

### `services`

Defines public immigration services.

Suggested fields:

`id, code, name_id, name_en, category, description, status`

### `intents`

Canonical user goals.

`id, code, service_id, description, priority, status`

### `question_patterns`

Natural-language variants mapped to canonical intents.

`id, intent_id, language, pattern, normalized_pattern, source, status`

### `answers`

Canonical approved responses.

`id, answer_code, intent_id, language, short_text, detailed_text, next_action, status, version`

### `answer_sources`

Provenance and authority.

`id, answer_id, source_type, source_title, source_reference, legal_basis_id, effective_from, effective_until`

### `policies`

Deterministic business rules.

`id, policy_code, service_id, rule_expression, version, effective_from, effective_until, status`

### `answer_policy_links`

Connects answers to policies that must be satisfied.

`answer_id, policy_id`

### `knowledge_documents`

Original approved source documents and metadata.

`id, title, document_type, source_owner, version, effective_from, effective_until, checksum, status`

### `knowledge_chunks`

Searchable sections of documents.

`id, document_id, section, text, language, embedding_ref, checksum`

### `answer_variants`

Controlled alternative renderings for the same canonical answer.

`id, answer_id, tone, audience, language, text, status`

### `answer_versions`

Immutable publication history.

`id, answer_id, version, content_hash, published_at, retired_at, approved_by`

### `knowledge_reviews`

Human approval records.

`id, object_type, object_id, review_state, reviewer_id, notes, reviewed_at`

### `question_clusters`

Groups similar public questions for knowledge-gap discovery.

`id, cluster_key, representative_question, intent_id, volume, first_seen, last_seen`

### `knowledge_gaps`

Questions for which no sufficiently authoritative answer exists.

`id, cluster_id, severity, proposed_intent, status, owner, created_at`

## Search strategy

Use a hybrid index:

1. exact/normalized pattern match
2. PostgreSQL full-text search
3. synonym/phrase dictionary
4. optional vector/semantic search
5. AI only when deterministic retrieval is insufficient

## Response selection algorithm

`incoming_message → normalize → classify → retrieve candidates → policy validity → freshness → confidence → select approved answer`

The selected answer should carry provenance internally so the response can be audited.

## Bulk generation strategy

For each canonical intent:

`1 intent → many question patterns → one or more approved answer variants`

Do not duplicate authoritative answers unnecessarily. Store one canonical answer and map many question forms to it.

## Database-first learning loop

`Production Questions → Cluster → Identify Missing/Weak Knowledge → Draft → Review → Publish → New Patterns`

This loop can operate with AI disabled.

When AI is available, it accelerates the drafting and pattern-generation stages but does not bypass approval.

## Data integrity requirements

- Unique canonical codes.
- Versioned answers.
- Effective-date validation.
- No two conflicting active answers for the same canonical intent and jurisdiction without explicit policy precedence.
- Immutable publication history.
- Source provenance required for regulated answers.
- Soft retirement rather than destructive overwrite for published knowledge.

## Initial answer-domain expansion target

Build structured coverage across:

- Passport new application
- Passport replacement
- Passport expiry
- Passport lost
- Passport damaged
- Passport data changes
- Child passport
- Passport fees
- Passport office
- Passport appointment
- Passport status
- Visa information
- Visa requirements
- Visa extension
- Stay permits
- ITAS
- ITAP
- Re-entry
- Sponsor information
- Change of status
- Overstay information
- Foreigner reporting
- Office services
- Office hours
- Complaint intake
- Service disruption
- General public-service guidance

The list is a starting taxonomy, not a claim that any specific requirement or tariff is currently applicable. Current production values must come from approved official sources.

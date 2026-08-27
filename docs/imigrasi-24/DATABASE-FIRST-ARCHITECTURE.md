# IMIGRASI 24 — Database-First / AI-Optional Architecture

**Status:** Brainstorming Baseline v1.1 — Non-negotiable principle

## 1. Core decision

IMIGRASI 24 MUST NOT depend on an external AI provider or AI API for its basic public service operation.

The primary service path is:

`WhatsApp → Gateway → Intent/Search → Cache → Official Answer Database → Policy Engine → Response`

AI is an optional intelligence accelerator:

`Unknown/Complex → AI Router → Provider A/B/Local Model → Validation → Response`

If every AI provider is unavailable, the known-service path MUST continue operating.

## 2. Database becomes the service asset

The project should continuously build a large, versioned, searchable repository of approved immigration knowledge and answers. The target is not a fixed FAQ list but an expanding answer corpus covering:

- passport services
- passport requirements
- passport replacement
- lost/damaged passport guidance
- passport fees
- passport office information
- appointment guidance
- service duration guidance
- WNA visa information
- stay permit information
- ITAS/ITAP information
- re-entry information
- sponsor-related information
- overstay guidance
- foreigner reporting guidance
- complaints and public-service channels
- office services and schedules
- common misunderstandings
- multilingual question variants
- service-specific decision trees
- safe fallback responses

## 3. Answer corpus generation modes

### Mode A — Database-only generation

Use deterministic templates, curated content, question-pattern generation, synonym dictionaries, intent catalogs, and approved source material to create many question-answer records without an AI API.

Pipeline:

`Official/Approved Source → Structured Rules → Question Patterns → Answer Records → Review → Publish`

### Mode B — AI-assisted generation

When an approved AI API is available, AI may accelerate generation of:

- alternative user phrasings
- synonyms
- colloquial Indonesian questions
- English/multilingual variants
- intent classification suggestions
- FAQ clustering
- draft answer summaries
- knowledge extraction
- semantic tags
- embedding preparation
- knowledge-gap suggestions

Pipeline:

`Approved Source → AI Draft/Expansion → Validation → Human Approval → Publish`

AI output is NEVER automatically authoritative.

## 4. Canonical Answer Model

Each approved answer should be represented as structured data, not only prose.

Suggested fields:

- answer_id
- service_id
- intent_id
- language
- question_pattern
- normalized_question
- answer_text
- short_answer
- detailed_answer
- required_documents
- next_action
- source_id
- legal_basis_id
- policy_id
- effective_from
- effective_until
- version
- status
- confidence_class
- approval_state
- approved_by
- approved_at
- last_reviewed_at
- supersedes_answer_id

## 5. Question Pattern Library

A single answer may have hundreds or thousands of natural-language variants.

Example concept:

`PASSPORT_COST`

Possible patterns include variations of:

- biaya paspor
- harga paspor
- tarif paspor
- berapa biaya bikin paspor
- berapa uang yang perlu disiapkan
- paspor elektronik berapa
- how much is a passport
- passport fee
- electronic passport cost

The system maps variants to the same canonical intent and approved answer rather than generating a new answer every time.

## 6. Answer expansion engine

The database engine should support controlled expansion:

`Canonical Intent → Pattern Generator → Deduplication → Semantic/Keyword Index → Answer Mapping`

Expansion can be performed in batches and re-run whenever the knowledge source changes.

## 7. No-API operating mode

When `AI_MODE=OFF`, the system continues with:

`Cache → Keyword Search → Full-text Search → Intent Rules → Answer Database → Policy Engine → Template Response → Human Handoff`

Unknown questions receive a safe fallback and may be queued for later knowledge creation.

## 8. AI-connected operating mode

When AI is available:

`Cache → Answer DB/Search → known answer? → YES: respond`

For unknown/complex questions:

`AI Router → selected provider → RAG/knowledge context → response validator → safe response`

AI should not be called for a known deterministic answer merely because an AI connection exists.

## 9. Cost-control principle

The default production strategy should be database-first and AI-selective. This minimizes token usage, reduces latency, improves determinism, and keeps the service available when AI costs are constrained.

## 10. Knowledge compiler

A future Knowledge Compiler can convert approved source documents into structured draft knowledge:

`Source Document → Extract → Normalize → Classify → Generate Questions → Generate Draft Answers → Detect Conflicts → Review → Publish`

The compiler must preserve provenance and version relationships.

## 11. Regulatory freshness

Answers must be versioned and tied to effective dates. When a source changes, the system should identify affected answers and policies before publication.

Target future workflow:

`New Source → Change Detection → Impact Analysis → Affected Answers → Draft Updates → Approval → Publish → Retire Old Version`

## 12. Quality gates

Before an answer becomes public:

- source exists
- source is approved
- effective date is valid
- no conflicting active policy exists
- required fields are complete
- answer is within authorized scope
- sensitive information is not exposed
- test questions map correctly
- approval is recorded

## 13. Strategic objective

Build the largest useful, governed, versioned, auditable immigration answer corpus possible while keeping the core service independent of any particular AI vendor.

AI should make the database grow faster. It must not become the reason the service works.

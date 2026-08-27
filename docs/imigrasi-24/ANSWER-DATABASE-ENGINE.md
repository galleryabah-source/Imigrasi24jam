# IMIGRASI 24JAM — Answer Database Engine v1.0

## Core objective
Membangun mesin jawaban yang dapat melayani mayoritas pertanyaan keimigrasian tanpa memanggil provider AI. AI, ketika tersedia, dipakai untuk memperkaya knowledge dan menangani kasus ambigu/kompleks lalu hasil yang telah divalidasi dapat disimpan dan digunakan ulang.

## Processing modes

### Deterministic mode
`message → domain guard → normalization → intent → answer search → policy → response`

### AI-assisted mode
`message → domain guard → deterministic attempt → AI router → retrieval/analysis → safety validation → response`

### Knowledge harvesting mode
`official source → extraction → draft → review → approval → publish → answer database`

## Data objects

- `intent`
- `question_pattern`
- `synonym`
- `answer`
- `answer_variant`
- `knowledge_source`
- `knowledge_version`
- `policy_rule`
- `policy_version`
- `service`
- `office`
- `translation`
- `test_case`

## Answer record minimum

```text
answer_id
intent_id
language
canonical_question
answer_text
service_id
source_id
legal_reference
version
status
effective_from
effective_until
approval_status
approved_by
approved_at
last_reviewed
```

## Resolution order

1. Exact/cached match.
2. Normalized pattern match.
3. Keyword/synonym match.
4. Structured field/rule match.
5. Hybrid semantic retrieval when enabled.
6. AI fallback for ambiguity/complexity.
7. Human handoff when confidence or authority requirements are not met.

## AI-generated data policy

AI may create draft question patterns, synonyms, answer variants, translations, knowledge summaries, and test cases. These are not authoritative until validated and approved according to governance.

## Deduplication

Near-duplicate questions and answers must be clustered. Publishing a new answer must not create conflicting active records for the same intent/policy unless explicitly versioned and scoped.

## Regulation update impact

When a source or policy version changes, the engine must identify affected:

- answers;
- question patterns;
- policies;
- services;
- workflows;
- translations;
- regression tests.

## Offline/AI-disconnected requirement

All published deterministic answers must remain queryable with AI disabled. A provider outage must not remove the ability to serve known questions.

## Testing

The engine must include regression cases for:
- exact questions;
- paraphrases;
- typos;
- Indonesian/English variants;
- mixed-domain messages;
- out-of-domain messages;
- conflicting/stale knowledge;
- expired answers;
- provider unavailable;
- low-confidence retrieval.

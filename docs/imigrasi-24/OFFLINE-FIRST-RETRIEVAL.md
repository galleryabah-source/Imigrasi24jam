# Offline-First Retrieval Engine v1

Imigrasi24jam must remain operational when every AI provider is unavailable.

## Hard gates

1. Intent is required.
2. Knowledge must be `PUBLISHED`.
3. Knowledge must be effective at the requested timestamp.
4. Intent must match exactly; sub-intent narrows retrieval when supplied.
5. Verified evidence is strongly preferred and required by the public-answer safety gate.
6. Low retrieval confidence produces `REVIEW`, not a guessed answer.

## Ranking

Deterministic ranking currently combines question-pattern token overlap and verified-evidence presence. This is a baseline contract, not a legal-validity score.

Future ranking may add curated synonyms, structured service metadata, BM25/full-text search, and optional embeddings. None may bypass publication, effective-date, provenance, evidence, or safety gates.

## AI degradation

`AI available` may enrich interpretation or ranking. `AI unavailable` falls back to this deterministic engine. AI provider health must never decide whether a source is legally valid.

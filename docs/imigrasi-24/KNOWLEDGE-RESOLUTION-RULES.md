# Knowledge Resolution Rules v1

## Runtime principle

The runtime must select knowledge by publication status, effective date, intent and conflict state. It must not simply select the most recently edited row.

## Resolution order

1. Only `PUBLISHED` knowledge is eligible.
2. `effective_from <= now < effective_until` when an end date exists.
3. Select the newest effective version within the valid period.
4. If two published records for the same intent are equally effective and materially compete, return `CONFLICT_REVIEW` rather than guessing.
5. Expired, future, draft, rejected, archived or superseded records are excluded.
6. The selected answer must retain source/document/version provenance.

## Regulatory update model

A new regulation creates a new source/document/knowledge version. Historical records are retained for audit and historical reconstruction.

## Conflict safety

Conflicts are a first-class state. Runtime must fail safely rather than silently choosing one regulatory interpretation.

## AI interaction

AI may propose or summarize candidates, but it cannot override effective-date resolution, publication status, source provenance, or conflict handling.

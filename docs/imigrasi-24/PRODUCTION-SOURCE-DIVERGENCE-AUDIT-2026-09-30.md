# Production Source Divergence Audit — 2026-09-30

## Scope

Audit the 13 commits unique to `main` relative to the validated Process 01 baseline
`process-1-governance-core-2026-09-25` at `4fa9466c6a951d82a7ab7336167f222d79061c37`.

Comparison:

- Process 01 → main: **diverged**
- main unique commits: **13**
- Process 01 unique commits: **301**
- merge base: `667129039097e2c634c4a0a9694f1c459b47804d`

## Decision

The 13 main-only commits are **not to be promoted wholesale** into the Process 01 baseline.

### Classification

| Main-only commit | Classification | Reason |
|---|---|---|
| `70b2d4d` provider-agnostic webhook contract | SUPERSEDED | Webhook security/normalization responsibilities are represented by the current canonical WhatsApp ingress/security path. Do not restore a parallel webhook contract. |
| `8a1a004` webhook security regressions | SUPERSEDED | Current Process 01 contains dedicated webhook-security and WhatsApp webhook regression coverage. |
| `233e6e4` provider-agnostic messaging adapter | SUPERSEDED | Current architecture uses the canonical provider boundary and delivery adapter path; restoring the old adapter contract would create a competing abstraction. |
| `ab345f0` provider adapter security tests | SUPERSEDED | Security-boundary behavior is already covered by current provider/WhatsApp contract tests. |
| `79520db` deterministic mock WhatsApp provider | SUPERSEDED | Current Process 01 has WhatsApp provider/delivery test infrastructure; do not reintroduce the old mock adapter as a second provider path. |
| `2aa6e1a` mock WhatsApp E2E tests | SUPERSEDED | Replace with tests against the canonical lifecycle/provider boundary rather than the obsolete pipeline. |
| `d4f4340` canonical inbox gateway boundary | SUPERSEDED | Current canonical lifecycle performs durable admission through the canonical inbox/outbox repository. |
| `691ee39` inbox gateway regression tests | SUPERSEDED | Current canonical lifecycle and WhatsApp inbox gateway tests cover the durable admission boundary. |
| `496594a` inbound → conversation → outbox pipeline | SUPERSEDED | This is precisely the competing pipeline eliminated by the canonical lifecycle hardening. |
| `cf85ff` inbound pipeline tests | SUPERSEDED | Tests target the obsolete competing pipeline and must not be restored. |
| `cf18ab7` AI-independent knowledge answer pipeline | SUPERSEDED / FUNCTION RETAINED | AI-independent deterministic answering remains a required capability, but current Process 01 already contains the answer engine, retrieval, policy, safety, and effective-knowledge components. |
| `0e53b57` deterministic knowledge answer tests | SUPERSEDED | Test against the current canonical knowledge path rather than restoring the old module. |
| `df65643` master process/system checklist | PORT SELECTIVELY | Governance intent remains useful, but the document must describe the current canonical lifecycle and must not imply that the superseded modules are production paths. |

## Required reconciliation

Only the **intent/requirements** of the main-only code commits are retained:

1. Provider-independent ingress.
2. Webhook signature/replay security.
3. Canonical normalization.
4. Durable idempotent inbox admission.
5. Conversation processing.
6. Deterministic/AI-independent knowledge answering.
7. Outbox and provider delivery.
8. Regression coverage.

These requirements are already represented by the Process 01 architecture and its tests.

## Explicit non-actions

Do **not**:

- cherry-pick the 12 code/test commits;
- copy the old `conversation-inbox-pipeline.js`;
- copy the old `inbox-gateway.js`;
- copy the old `provider-adapter.js`;
- copy the old `mock-whatsapp-provider.js`;
- copy the old `knowledge-answer-pipeline.js`;
- restore the old test files as parallel coverage;
- merge PR #8 unchanged.

Doing so would recreate competing lifecycle paths and violate the single canonical source-of-truth requirement.

## Production-source gate

PR #8 may proceed only after its 12 superseded code/test commits are excluded from the production baseline and the retained governance checklist is reconciled against the current Process 01 architecture.

Next gate:

`single production baseline → CI green → production DB/runtime/secrets → WhatsApp E2E → production deploy → smoke test`

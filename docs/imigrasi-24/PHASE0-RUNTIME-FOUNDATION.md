# IMIGRASI24JAM — Phase 0 Runtime Foundation

**Status:** Implemented on `phase0-runtime-foundation-2026-08-27`

## Scope

This increment establishes the first executable deterministic core without introducing an AI dependency or database migration.

Implemented contracts:

- Node runtime package definition.
- Immigration-only Domain Guard.
- Deterministic text normalization.
- Published-answer validity policy with source provenance requirement.
- Public-document WhatsApp attachment policy gate.
- Database-first exact-pattern Answer Engine.
- Regression tests for domain boundaries, normalization, answer validity, document exposure, and AI-independent resolution.

## Security boundary

`PRIVATE-INTERNAL` documents are denied by the backend policy function. `RESTRICTED` documents are also denied by default because only `PUBLIC + PUBLISHED + allow_whatsapp_attachment=true` passes the attachment gate.

## Deliberate non-scope

No production credentials, WhatsApp tokens, AI provider keys, database migrations, or external API calls are included in this phase.

## Next gate

Before merging to `main`, execute:

```text
npm test
npm run check
```

Then add CI automation and expand the deterministic intent/question-pattern registry.

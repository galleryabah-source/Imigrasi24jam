# IMIGRASI 24JAM — Roadmap Addendum v1.2

This addendum extends the roadmap with governed document ingestion, document visibility, and contextual WhatsApp attachment.

## Phase 0 — Governance additions

- Document classification and publication policy
- Public/private/restricted document controls
- Contextual WhatsApp attachment policy
- Change control and regulation-update governance

## Phase 1.5 — Knowledge Expansion & Document Intelligence

- Manual knowledge-entry forms
- Bulk knowledge import
- PDF/PPTX/DOCX/XLSX/CSV/TXT ingestion where supported
- Original-file preservation and checksum/hash
- Text extraction and deterministic parsing
- Document metadata and provenance
- Duplicate detection
- Knowledge coverage dashboard
- Regression question set
- Response cache
- Document access classification: `PUBLIC` / `PRIVATE-INTERNAL` / `RESTRICTED`
- Backend authorization for document access
- `ALLOW_WHATSAPP_ATTACHMENT` policy
- Contextual document-to-topic/intent matching
- Controlled WhatsApp public attachment delivery
- Attachment audit trail

## Attachment policy

- `PUBLIC` documents may be attached to WhatsApp only when approved/published, relevant to the conversation, and explicitly allowed by attachment policy.
- `PRIVATE-INTERNAL` documents must never be attached or exposed through the public chatbot.
- `RESTRICTED` documents are deny-by-default for public attachment unless an explicitly authorized workflow exists.
- Frontend checkboxes are not security boundaries; backend authorization is mandatory before public document delivery.

## Change / Regulation Update Cycle

Blueprint, roadmap, modules, answers, policies, workflows, and knowledge sources remain living assets and may change with owner approval based on audit findings, corrections, security findings, testing, operational needs, or government policy/regulation changes.

Standard flow:

`Proposal → Review → Owner Approval → Implement → Test → Audit → Deploy → Update Baseline`

Regulatory flow:

`New/Changed Regulation → Version → Impact Analysis → Affected Knowledge/Answers/Policies/Workflows → Review → Approval → Publish → Regression Test`

Emergency changes may use an emergency-change path with appropriate authorization, validation, audit, and subsequent documentation.

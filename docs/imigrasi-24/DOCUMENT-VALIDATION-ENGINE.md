# Document Validation Engine v1

The first validation layer is deliberately AI-independent. AI may enrich later, but it cannot bypass quarantine, provenance, authority, integrity, or human approval.

## Pipeline

`Upload → Quarantine → Metadata validation → Integrity/checksum → Extraction → Immigration relevance → Authority/provenance → Review → Approval → Publish`

## Outcomes

- `REJECTED`: structurally invalid or unsupported input.
- `QUARANTINED`: unsafe/incomplete validation; cannot become knowledge.
- `REVIEW_REQUIRED`: automated checks are insufficient for publication; authorized reviewer decides.
- `APPROVED`: human approval exists; publication is still a separate state transition.
- `PUBLISHED`: usable by runtime only after all policy gates pass.

## Important limitation

Keyword-based relevance and authority signals are triage mechanisms, not proof of legal validity. They must never be presented as legal verification. Official provenance and authorized human review remain required.

## Future validators

- PDF/DOCX/PPTX/XLSX structural validation
- malware/unsafe-file scanning at infrastructure layer
- OCR for scanned documents
- checksum and duplicate detection
- language detection
- regulation-number extraction
- issuing-authority extraction
- issue/effective/expiry date extraction
- supersession detection
- contradiction detection against currently published knowledge
- document-to-knowledge traceability
- optional AI semantic classification with provider-independent interface

# Document Extraction Layer v1

Extraction is a deterministic preprocessing layer. It does not decide legal validity and it does not publish knowledge.

## Contract

`Quarantined document → extraction job → normalized text + page/metadata provenance → validation`

## Provider independence

The contract accepts extractor implementations behind an adapter. Native libraries, OCR engines, self-hosted services, or future AI services may implement the adapter without changing the knowledge model.

## Failure handling

- Unsupported media: reject before extraction.
- No text: mark `NO_TEXT`; do not silently publish.
- Partial extraction: preserve extracted output and mark it `PARTIAL`; require review.
- Extractor failure: mark `FAILED`; retry through a bounded retry policy, then manual review.

## Provenance

Every extraction result records extractor identity/version and page-level metadata where available. The original document and checksum remain the authoritative artifact; extracted text is derived data.

## Security boundary

Files remain quarantined while extraction occurs. Extraction workers must not have publication authority. They receive only the minimum storage access required to read the quarantined object and write derived extraction output.

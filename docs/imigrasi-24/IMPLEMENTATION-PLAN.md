# IMIGRASI 24JAM — Step-by-Step Implementation Plan

**Baseline:** v1.0  
**Execution model:** incremental, testable, reversible

## Phase 0 — Foundation

1. Repository/project structure.
2. Environment and secret isolation.
3. Core application skeleton.
4. Database foundation.
5. Domain Guard.
6. Answer Database schema.
7. Rule/Policy engine foundation.
8. Test harness.
9. CI quality gates.

## Phase 1 — Deterministic Service Core

Build and verify the parts that require no AI provider:

- intent registry;
- question patterns;
- synonym/normalization engine;
- answer lookup;
- policy evaluation;
- response templates;
- conversation state;
- audit events;
- fallback handling;
- out-of-domain handling.

## Phase 1A — Knowledge Seeding

Seed the initial approved knowledge structure for:

- passport;
- foreigner services;
- office information;
- complaints;
- violation reports;
- service guidance.

All policy-sensitive content must contain source, version, validity, and approval metadata.

## Phase 1B — WhatsApp Adapter

Add a provider-agnostic channel adapter around the official WhatsApp integration. The channel adapter must not contain business rules or AI-specific logic.

## Phase 1C — AI Optional Layer

Add AI behind an abstraction boundary:

`Conversation Core → AI Gateway → Provider Adapter`

AI can:
- classify difficult/ambiguous messages;
- generate knowledge drafts;
- generate question variants;
- propose answer improvements;
- assist multilingual expansion.

AI cannot directly publish authoritative answers.

## Phase 1D — Knowledge Harvesting

When an AI provider is available:

`Source → AI extraction → draft knowledge → validation → approval → database`

The generated knowledge becomes reusable database assets so recurring questions can be answered without repeated AI calls.

## Phase 2 — Service Intelligence

- question analytics;
- knowledge gap detection;
- regulation impact analysis;
- answer versioning;
- complaint intelligence;
- human handoff;
- office-aware responses;
- hybrid search;
- multilingual expansion.

## Phase 3 — Authorized Integrations

Only after the deterministic core is stable:

- official service/status APIs;
- appointment where authorized;
- ticket tracking;
- notification workflows;
- expanded WNA workflows.

## Engineering rule

Every phase must leave the system in a runnable state. Do not make AI availability a prerequisite for the deterministic core.

## Definition of Done

A feature is not considered complete until appropriate unit, integration, regression, security, and failure-path tests have been executed and their evidence is recorded.

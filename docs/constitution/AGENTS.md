# TUMBU AI Development Constitution

**Status:** Repository governance  
**Applies to:** every human and AI contributor

## Purpose

TUMBU is an offline-first, mobile-first Business Operating System for Indonesian SMEs. This document governs how work is performed; it does not create product policy.

## Authority and conflict rule

Read and apply sources in this order:

1. Explicit decision from the Owner
2. `knowledge/` and approved Foundation documents
3. Approved ADRs
4. Foundation Addendum v1.1
5. Feature specifications (including *Spek Teknis Jual Benih*)
6. This file and other engineering documentation
7. Existing implementation

When sources conflict, the higher source wins. Documentation and code must be corrected to match the higher source. No agent may invent, reinterpret, or silently replace a business rule.

## Non-negotiable principles

- Mobile first: primary flows must work comfortably on a phone, with clear actions and minimal input.
- Offline first: a user must be able to record an eligible transaction without a network connection.
- Sync first: local changes are queued, retried safely, observable, and reconciled when connectivity returns.
- Domain driven and event driven: business intent is explicit; important state changes are traceable.
- Clean architecture: UI, application use cases, domain rules, and infrastructure remain separated.
- Progressive enhancement: network-dependent capabilities improve the experience but do not define the baseline.

Internet is a capability, not a prerequisite for core field work.

## Contributor boundaries

Before changing code, inspect the relevant Foundation/knowledge, ADR, feature specification, and existing module.

Without an explicit source or Owner approval, do not:

- add or alter a business rule, entity, event, workflow, status, calculation, or business term;
- change the stack, database, state-management approach, sync strategy, or repository structure;
- delete or rename business data or fields;
- add dependencies merely for convenience.

If the specification is incomplete, state the gap and request a decision. Do not fill it with an assumption.

## Implementation rules

- Search before creating: reuse or refactor an existing module before adding a parallel one.
- Keep modules focused. Split a component, use case, or service when it starts carrying unrelated responsibilities; roughly 200 lines for components/use cases and 300 for services are review signals, not hard limits.
- Prefer readable, typed, testable code. Avoid magic values, duplicated logic, hidden side effects, and deep conditional chains.
- Keep secrets, credentials, URLs, and environment-specific values out of source control and out of code.
- Keep commits small and single-purpose; do not mix feature work, refactors, and visual cleanup without a clear reason.

## Required delivery checks

A change is done only when applicable checks pass:

- build, type-check, lint, and relevant tests;
- offline creation/retry behavior for a transactional change;
- sync/idempotency and failure handling where synchronization is affected;
- mobile usability for UI work;
- relevant documentation and ADRs updated;
- no conflict with the authority order above.

## Reading priority and exclusions

Prioritize `knowledge/`, `docs/`, `ADR/`, `apps/`, `packages/`, `prisma/`, `scripts/`, `README.md`, and workspace manifests. Do not index generated or vendored content unless the task specifically requires it:

```text
node_modules/  .next/  dist/  build/  coverage/  .cache/
.git/          logs/   tmp/   *.log
```

## Final rule

When in doubt, preserve the Foundation, keep the change reversible, and ask the Owner for a decision.

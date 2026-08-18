# TUMBU Repository Rules

## Document placement

- `AGENTS.md`: contributor governance and authority order.
- `knowledge/`: approved business/domain knowledge and Foundation material.
- `ADR/`: durable architecture decisions and their rationale.
- `docs/`: implementation blueprints, process, and technical guidance.
- `apps/`: deployable applications.
- `packages/`: shared domain, application, UI, or infrastructure packages.
- `prisma/`: schema and migration artifacts when used by the approved stack.
- `scripts/`: repeatable developer and operational automation.

Use the repository's existing naming and placement conventions. This mapping does not authorize creating missing folders or moving modules without an approved task.

## Reading order

For a feature: Foundation/knowledge -> relevant ADR -> feature specification -> target module -> tests -> neighboring modules. Existing code is evidence of implementation, not authority to redefine the domain.

## Ignore generated content

Keep generated, vendored, cache, log, and local-runtime content out of AI indexing and normal code review where possible:

```text
node_modules/
.next/
dist/
build/
coverage/
.cache/
.git/
logs/
tmp/
*.log
```

Maintain equivalent ignore entries in tool-specific ignore files when those tools are used. Do not remove dependencies or generated files from a working environment simply to reduce AI context; ignore them instead.

## Change discipline

Do not create duplicate domain modules, broad catch-all folders, or “temporary” architecture that becomes permanent. New dependencies, top-level folders, cross-domain contracts, persistence changes, and synchronization changes require an explicit approved decision or ADR.

## Documentation discipline

Update the relevant specification, ADR, and operational documentation whenever an approved change alters a durable contract. Never edit Foundation material to justify an implementation change; propose the business decision to the Owner first.

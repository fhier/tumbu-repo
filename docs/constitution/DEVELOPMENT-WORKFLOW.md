# TUMBU Development Workflow

## 1. Frame the task

The Owner or architect states the outcome and scope. The architect identifies governing sources and writes a bounded task with acceptance criteria and explicit non-goals.

## 2. Resolve ambiguity before code

If sources conflict or a required business decision is absent, pause for the Owner. Do not delegate ambiguity to the builder or hide an assumption in code.

## 3. Inspect and plan

Read `AGENTS.md`, relevant knowledge/Foundation/Addendum, ADRs, specification, and nearby code. Prefer extending or refactoring an existing domain module over creating a duplicate.

## 4. Build

Implement the smallest cohesive slice. Transactional changes must satisfy `OFFLINE-FIRST.md`. Keep UI mobile-first and separate business logic from framework/infrastructure details.

## 5. Verify

Run relevant tests plus build, type-check, and lint. Exercise offline and sync lifecycle when touched. Confirm empty, loading, error, and retry states for user-facing work.

## 6. Review

Reviewer checks source-of-truth compliance, scope, domain behavior, offline contract, architecture, security, tests, and documentation. Findings must identify a source or concrete code behavior, not preference alone.

## 7. Merge

Merge only after required checks and review are complete. Commit messages and PR descriptions should state scope, governing specification, user impact, verification, and any deferred work.

## Definition of ready

A task is ready when its goal, scope, governing sources, acceptance criteria, dependencies, and unresolved decisions are known.

## Definition of done

A task is done when the approved scope is implemented, tested, mobile-appropriate, offline-safe where applicable, documented, reviewed, and free of unapproved decisions.

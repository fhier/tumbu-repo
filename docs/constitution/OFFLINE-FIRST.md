# TUMBU Offline-First Contract

## Objective

Core field transactions must remain usable with intermittent or absent connectivity. The local device records intent safely; synchronization distributes it when a connection is available.

## Required lifecycle

```text
Validate locally -> commit locally -> append immutable event -> enqueue outbox
-> show pending state -> sync when eligible -> acknowledge or surface resolution
```

An eligible transaction must receive a UUID before it leaves the device. The outbox must survive reloads and app restarts. A sync operation must carry an idempotency key so retries do not create duplicates.

## States

Use clear, user-visible semantics: `local/pending`, `syncing`, `synced`, `needs_attention`, and `failed` only where the implementation's authority defines them. Do not discard local data merely because sync failed.

## Retry and failure

Retry transient failures with bounded backoff when connectivity returns or the user requests retry. Record enough error context to diagnose a rejection without exposing secrets. Permanent server/domain rejection must preserve the local record and provide a resolution path defined by the product specification.

## Conflict handling

Conflict behavior must be explicit per domain rule; there is no universal last-write-wins default. The client must not silently overwrite another valid business change. If the Foundation or feature specification does not define resolution, stop and seek an Owner decision.

## UX requirements

The user must know whether work is saved locally, pending sync, synchronized, or needs attention. Primary data entry must not be blocked by a temporary network failure. Do not present a false “saved” result before the local durable commit succeeds.

## Verification

Test at least: offline creation; reload before sync; repeated sync delivery; network loss during sync; retry after reconnect; server rejection; and mobile presentation of pending/attention state. The exact persistence and transport libraries follow approved ADRs and existing architecture.

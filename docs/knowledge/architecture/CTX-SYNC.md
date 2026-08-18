# CTX-SYNC - Sync Constitution (PALING KRITIS)

Ini file yang kamu minta, dan ini yang bikin Offline First gagal kalau tidak di-lock dari awal.

## Sync Queue
- Semua perubahan masuk ke sync_outbox table
- Format: { id, aggregate, aggregateId, operation: CREATE|UPDATE|DELETE, payload, version, attempt, createdAt }
- Worker proses FIFO, tapi per aggregate serial

## Idempotency
- Semua request ke server harus punya idempotencyKey = outbox.id
- Server harus idempotent: CREATE dengan key sama = return existing

## Conflict Resolution - LOCK DARI AWAL
- Version: setiap aggregate punya version (int, increment)
- Policy:
  - Farm, Pond (master data): LAST_WRITE_WINS + version check
  - Cycle, Feed, Harvest (transactional): MANUAL / SERVER_WINS jika version mismatch
  - Jika conflict: simpan di sync_conflicts, jangan auto-overwrite, tampilkan di UI untuk user resolve

## Retry
- Exponential backoff: 1s, 5s, 30s, 5m, 30m
- Max attempt 10, setelah itu status FAILED_NEEDS_REVIEW
- Network error -> retry, 4xx validation error -> FAILED (jangan retry)

## Delete Policy
- Soft delete only: deletedAt
- Hard delete tidak pernah sync, hanya soft

## Merge Policy
- Field-level merge dilarang untuk Cycle/Finance. Harus aggregate-level versioning.

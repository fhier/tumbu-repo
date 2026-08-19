# `[OFFLINE-INDEXEDDB-V3]` — Unified IndexedDB Schema

**Untuk apa:** Database IndexedDB terpadu untuk semua kebutuhan offline TUMBU.

## Database Info
- **Nama:** `tumbu_offline` (menggabungkan `tumbu_offline_db` + `tumbu_offline_v2`)
- **Versi:** 3
- **Akses:** `localDb` dari `lib/offline/indexeddb.ts`
- **Constants:** `STORES` dari `lib/offline/indexeddb.ts`

## Object Stores

### Core Infrastructure
| Store | Key Path | Indexes | Fungsi |
|-------|----------|---------|--------|
| `workspace_context` | `id` | - | Metadata workspace aktif |
| `device` | `id` | - | Device ID lokal |
| `sync_state` | `id` | - | State sinkronisasi |
| `outbox` | `id` | `status`, `aggregate`, `createdAt` | Antrean command offline |
| `outbox_archive` | `id` | - | Arsip command tersinkron |
| `form_drafts` | `key` | - | Draft form offline |
| `master_data` | `key` | - | Cache master data |

### ERP / Distributor Cache
| Store | Key Path | Fungsi |
|-------|----------|--------|
| `partners` | `id` | Cache partner lokal |
| `products` | `id` | Cache katalog produk |
| `transactions` | `id` | Cache transaksi |
| `expenses` | `id` | Cache pengeluaran |

### Domain: Hulu (Budidaya) — sesuai Domain Contracts
| Store | Domain Contract | Storage Target |
|-------|----------------|----------------|
| `aqua_cycles` | AquaCultureCycle | `aqua_cycles` |
| `aqua_feed_events` | FeedEntry | `aqua_feed_events` |
| `aqua_harvest_events` | AquaHarvestEvent | `aqua_harvest_events` |
| `aqua_mortality_events` | AquaMortalityEvent | `aqua_mortality_events` |
| `aqua_sampling_events` | AquaSamplingEvent | `aqua_sampling_events` |
| `aqua_water_quality_events` | AquaWaterQualityEvent | `aqua_water_quality_events` |
| `aqua_expense_events` | AquaExpenseEvent | `aqua_expense_events` |

### Domain: Hilir (Inventory & Supply Chain)
| Store | Domain Contract | Storage Target |
|-------|----------------|----------------|
| `inventory_batches` | InventoryBatch | `inventory_batches` |

## Migrasi Path
- **V1** (`tumbu_offline_db` / `tumbu_offline_v2`) → **V3** (`tumbu_offline`):
  - Semua data lama akan tetap ada di database lama
  - V3 akan dibuat baru dengan schema lengkap
  - Data dari V1/V2 dapat dimigrasi manual via fitur export/import jika diperlukan

## File Terkait
- `lib/offline/indexeddb.ts` — Definisi database & class TumbuDb
- `lib/offline/device.ts` — Device ID management
- `lib/offline/workspace.ts` — Workspace context management  
- `features/sync/outbox.ts` — Outbox management (PENDING/SYNCING/SYNCED/FAILED)
- `features/sync/sync-push.ts` — Push sync executor
- `features/sync/sync-types.ts` — Tipe data SyncCommand

**Panduan:** `docs/guides/PANDUAN-FOUNDER-OPERASIONAL-DAN-PENGEMBANGAN.md`
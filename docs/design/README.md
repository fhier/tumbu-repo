# TUMBU - KITAB DESAIN (Living Documentation)

> STATUS: FOUNDATION v1.0 LOCKED | UX MASTER MAP v1.0 LOCKED
> Aturan: Ubah workflow = update kitab dulu, baru code. Jangan langsung code.

## 🔒 LOCKED - Jangan Diubah Tanpa Approval Founder

| Kitab | File | Status | Tanggal Lock | Owner |
| :--- | :--- | :--- |
| 00 | `00-UX-Master-Map.html` | 🔒 LOCKED | 2026-08-03 | Alfirman |
| 03 | `03-User-Task-Flow.html` | 🔒 LOCKED | 2026-08-03 | Alfirman |
| Foundation | `docs/foundation/*` (24 docs) | 🔒 LOCKED | 2026-08-03 | Alfirman |

## 🚧 DRAFT - Belum Lock (Masih Boleh Revisi)

| Kitab | File | Status | Notes |
| :--- | :--- | :--- | :--- |
| 02 | `02-Information-Architecture.html` | 🟡 DRAFT | Menunggu rebuild |
| 04 | `04-Screen-Specification.html` | 🟡 DRAFT | |
| 05 | `05-Component-Inventory.html` | 🟡 DRAFT | CycleCard dipakai 4 tempat |
| 06 | `06-Design-Tokens.html` | 🟡 DRAFT | Primary, Glass, Blur |
| 07 | `07-Wireframe.html` | ⚪ TODO | Jangan mulai sebelum 02-06 LOCK |
| 08 | `08-High-Fidelity.html` | ⚪ TODO | |

## 📜 Aturan Main (Biar Gak Niban)

1.  **Satu sumber kebenaran (SSOT):** `docs/foundation` dan file 🔒 LOCKED adalah acuan. Frontend, Backend, AI ngikut.
2.  **1 Route = 1 File <400 baris:** Sesuai `21-folder-structure.md`. Jangan bikin god file.
3.  **Formula cuma di 1 tempat:** Semua SR, FCR, ADG, Biomass, BOP cuma di `packages/shared/src/domain/formula.ts`. JANGAN DUPLIKAT.
4.  **API pattern:** Selalu `/api/v1/...` dari hari pertama. Contoh: `POST /api/v1/cycles/:id/feed-events`
5.  **Komponen:** Cek `05-Component-Inventory` dulu. CycleCard kalau diubah, 4 layar kena dampak.
6.  **Migrasi DB:** Jangan edit di Supabase Dashboard. Harus lewat `supabase/migrations/*.sql`.

## 🔄 Cara Ubah Status Jadi LOCKED

Ubah di tabel ini + commit dengan format:
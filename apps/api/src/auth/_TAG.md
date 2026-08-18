# `[AUTH-SECURITY]` — Autentikasi & API Wall

**Untuk apa:** Login, sesi, role, guard modul per route.

| File | Fungsi |
|------|--------|
| `auth.service.ts` | Login/register/sesi |
| `api-wall.guard.ts` + `api-wall.map.ts` | Blokir API tanpa modul/role |
| `roles.guard.ts` | OWNER/ADMIN/STAFF |

⚠️ Edit hati-hati — dampak ke seluruh platform.

**Panduan:** `docs/guides/PANDUAN-FOUNDER-OPERASIONAL-DAN-PENGEMBANGAN.md` §6

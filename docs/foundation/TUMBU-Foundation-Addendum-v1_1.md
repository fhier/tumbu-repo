# TUMBU Foundation — Addendum v1.1

**Base:** TUMBU Foundation v1.0 (LOCKED, 2026-07-31)
**Addendum date:** 2026-08-06
**Status:** DISETUJUI FOUNDER
**Sifat:** Penambahan (tidak mengubah/menghapus keputusan v1.0 manapun)

---

## Ringkasan Perubahan

4 penambahan disetujui founder pada sesi 2026-08-06, semuanya sesuai koridor filosofi v1.0 (boring technology, formula deterministik, bukan AI prediction):

1. Estimasi BOP pra-siklus
2. Water & Health Monitoring (reminder kuras/cek air)
3. Perbandingan antar siklus (cycle benchmarking)
4. Tracking sisa modal berjalan (burn-rate siklus)

---

## A1. Estimasi BOP Pra-Siklus

**Masalah yang dijawab:** Petambak lokal umumnya tidak menyiapkan modal secara matang di awal, menyebabkan siklus berhenti di tengah jalan karena kehabisan modal — biasanya di fase pembesaran saat kebutuhan pakan memuncak.

**Posisi di userflow:** Langkah baru **di antara** "Persiapan Kolam" dan "Buka Siklus & Tebar".

**Cara kerja (formula deterministik, bukan AI):**
- Input user: jumlah benih rencana, target hari panen (atau pakai default dari `Species.standardADG`)
- Sistem hitung proyeksi:
  - Total pakan = biomassa proyeksi × `Species.standardFCR`
  - Populasi akhir proyeksi = jumlah tebar × `Species.standardSR`
  - Estimasi biaya = biaya benih + (proyeksi pakan × harga pakan) + overhead standar
- Output: "Estimasi modal dibutuhkan sampai panen: Rp X" — ditampilkan **sebelum** user commit ke "Buka Siklus", bukan opsional/tersembunyi

**Domain terdampak:** Cycle (D3), Biological (D2). Tidak butuh entity/tabel baru — memakai `Species.standardFCR/ADG/SR` yang sudah ada di Foundation v1.0 §D2. Hanya menambah 1 langkah UI + 1 fungsi kalkulasi.

**Rule baru:**
- R-C07: Estimasi BOP wajib ditampilkan sebelum `CycleOpened` di-submit. Boleh dilewati (skip), tapi tidak boleh disembunyikan dari alur.

---

## A2. Water & Health Monitoring

**Masalah yang dijawab:** Kematian akibat kualitas air buruk adalah akar masalah yang sering tidak disadari sampai terlambat. Foundation v1.0 hanya mencatat kematian setelah terjadi (Health domain), belum ada elemen preventif terkait air.

**Entity baru — `WaterEvent`** (masuk domain Health, D5):
- Fields: `id, tenantId, cycleId, eventType (WATER_CHANGE | WATER_CHECK), volumePercent?, notedAt`
- Mengikuti pola entity Health lain yang sudah ada (MortalityEvent, SamplingEvent, TreatmentEvent)

**Mekanisme reminder (rule-based, bukan AI/IoT):**
- Sistem hitung: hari sejak `WaterEvent` terakhir, ATAU akumulasi kg pakan diberikan sejak `WaterEvent` terakhir
- Jika melewati ambang (default: 7 hari atau sesuai standar per species) → tampilkan peringatan di layar Detail Siklus, pola sama persis dengan rule R-N04 (peringatan pakan >10% biomassa) yang sudah ada di v1.0

**Soal diagnosis penyakit — keputusan eksplisit:** TIDAK dibuat sebagai diagnosis otomatis/AI. Sebagai gantinya: referensi statis (gejala umum → kemungkinan penyebab → tindakan disarankan) yang dibaca user sendiri. Ini menjaga prinsip v1.0 "Honest Data over Fancy Feature" dan menghindari klaim medis yang tidak bisa dipertanggungjawabkan sistem.

**Rule baru:**
- R-H05: WaterEvent wajib terikat cycle aktif, sama seperti FeedEvent (R-N02).
- R-H06: Peringatan air adalah warning, bukan blocking — sama seperti pola R-N04.

---

## A3. Perbandingan Antar Siklus (Cycle Benchmarking)

**Masalah yang dijawab:** Foundation v1.0 sudah menyimpan `CycleSnapshot` (§D3, untuk audit & formula consistency) tapi belum ada langkah/layar yang benar-benar memanfaatkannya untuk pembelajaran user ("siklus lalu FCR 1.3, sekarang 1.1 — kenapa?").

**Posisi di userflow:** Bagian dari layar "Tutup Siklus & Analisa" — setelah BOP final dihitung, tampilkan perbandingan dengan siklus sebelumnya di kolam yang sama (atau rata-rata siklus tenant untuk species yang sama).

**Domain terdampak:** Cycle (D3) saja. Tidak ada entity baru — murni fitur baca dari `CycleSnapshot` yang sudah ada.

**Data ditampilkan:** FCR, SR, ADG, BOP, profit — siklus ini vs siklus sebelumnya (delta, bukan hanya angka mentah).

---

## A4. Tracking Sisa Modal Berjalan (Burn-Rate Siklus)

**Masalah yang dijawab:** Estimasi BOP (A1) menjawab kebutuhan modal di awal, tapi tidak cukup — petambak perlu tahu **selama siklus berjalan** apakah pengeluaran mereka masih sesuai rencana, sebelum benar-benar kehabisan modal.

**Cara kerja:**
- Sistem bandingkan: total `CostAllocation` terpakai sejauh ini vs estimasi BOP dari A1, relatif terhadap progres siklus (hari berjalan / target hari panen)
- Jika rasio pengeluaran jauh melebihi rasio progres siklus (mis. 70% modal terpakai tapi siklus baru 40% jalan) → tampilkan peringatan di layar Detail Siklus

**Domain terdampak:** Money (D8), Cycle (D3). Tidak ada entity baru — kalkulasi dari `CostAllocation` yang sudah ada, dibandingkan terhadap hasil A1.

**Rule baru:**
- R-M06: Peringatan burn-rate adalah warning read-only, tidak memblokir pencatatan biaya apapun (konsisten dengan prinsip "No Silent Failure" — user tetap bisa mencatat, tapi diberi konteks jujur).

---

## Dampak ke Dokumen Foundation v1.0

| Dokumen v1.0 | Perubahan |
|---|---|
| 08-domain-catalog.md (D5 Health) | + entity WaterEvent |
| 13-business-rules.md | + R-C07, R-H05, R-H06, R-M06 |
| 14-business-events.md | + WaterEventRecorded |
| 15-information-architecture.md | Detail Siklus perlu 1 elemen baru: panel peringatan (air + burn-rate) |
| 17-screen-hierarchy.md | L4: + Form Estimasi BOP, + Form Catat Air |

**Tidak ada dokumen v1.0 yang dihapus atau kontradiksi.** Semua penambahan memperkuat prinsip yang sudah ada (Honest Data, No Silent Failure, Boring Technology), bukan menyimpang darinya.

---

*Addendum ini mengikuti Documentation Principle #3 dari Foundation v1.0: "ADR — setiap keputusan besar baru dicatat terpisah dari dokumen v1.0 asli."*

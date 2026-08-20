# TUMBU Decision Log

Log untuk keputusan arsitektur dan teknis proyek.

## 2026-08-20 - Session & Active Workspace Reload Persistence
- **Masalah:** Saat halaman di-reload dari dashboard/workspace, aplikasi selalu kembali ke landing page & meminta login ulang.
- **Penyebab:**
  1. Kode pemulihan workspace aktif (`storedActive`) di `restoreSession` (`page.tsx`) di-comment out, sehingga memaksa `setView('landing')` setiap kali halaman di-reload.
  2. Ketidakcocokan nama kunci token di `localStorage` antara `LandingPage.tsx` (`tumbu_token`) dan `page.tsx` (`tumbu-token`).
- **Solusi:**
  1. Mengaktifkan kembali pemulihan workspace aktif dari `localStorage` serta menambahkan auto-select ke workspace aktif pertama jika `storedActive` belum diset.
  2. Menyinkronkan penulisan dan pembacaan kunci `localStorage` (`tumbu-token` & `tumbu_token`, `tumbu-active-workspace` & `tumbu_active_workspace`).
- **Masalah:** Halaman dashboard/workspace distributor sering blank saat navigasi tab.
- **Penyebab:** Kode di `distributor-pages.tsx` hanya mengecek nama tab Bahasa Indonesia (`penjualan`, `pembelian`, `pengeluaran`), sedangkan ID modul di sidebar/navigation `page.tsx` menggunakan ID standar (`sales`, `purchase`, `expense`, `inventory`, `cash`, `receivable`, `payable`, `reports`, `settings`).
- **Solusi:** Menambahkan aliansi ID modul (`sales`/`penjualan`, `purchase`/`pembelian`, `expense`/`pengeluaran`, `inventory`/`stok`, dll) pada routing `DistributorPages` serta meneruskan properti `sizes` ke `PenjualanPanel` dan `PembelianPanel`.

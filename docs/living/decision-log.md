# TUMBU Decision Log

Log untuk keputusan arsitektur dan teknis proyek.

## 2026-08-20 - Distributor Workspace Navigation Fix
- **Masalah:** Halaman dashboard/workspace distributor sering blank saat navigasi tab.
- **Penyebab:** Kode di `distributor-pages.tsx` hanya mengecek nama tab Bahasa Indonesia (`penjualan`, `pembelian`, `pengeluaran`), sedangkan ID modul di sidebar/navigation `page.tsx` menggunakan ID standar (`sales`, `purchase`, `expense`, `inventory`, `cash`, `receivable`, `payable`, `reports`, `settings`).
- **Solusi:** Menambahkan aliansi ID modul (`sales`/`penjualan`, `purchase`/`pembelian`, `expense`/`pengeluaran`, `inventory`/`stok`, dll) pada routing `DistributorPages` serta meneruskan properti `sizes` ke `PenjualanPanel` dan `PembelianPanel`.

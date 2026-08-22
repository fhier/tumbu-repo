/** Label user-facing untuk enum internal — dipakai lintas blueprint. */

export function formulaColorLabel(c: string): string {
  switch (c) {
    case 'GREEN': return 'Baik';
    case 'YELLOW': return 'Perhatian';
    case 'RED': return 'Kritis';
    default: return c;
  }
}

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: 'Baru',
  CONTACTED: 'Dihubungi',
  QUALIFIED: 'Layak',
  CLOSED: 'Ditutup',
};

export const CASH_DIRECTION_LABEL: Record<string, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
};

export const COST_CLASS_LABEL: Record<string, string> = {
  DIRECT: 'Langsung',
  INDIRECT: 'Tidak langsung',
};

/** Label halaman modul platform — jangan tampilkan raw key ke user */
export const MODULE_PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  onboarding: 'Setup usaha',
  analisa: 'Analisa',
  penjualan: 'Penjualan',
  pengeluaran: 'Pengeluaran',
  pembelian: 'Pembelian',
  beritaacara: 'Berita Acara',
  suratjalan: 'Surat Jalan',
  stok: 'Stok',
  kas: 'Kas & Bank',
  hutang: 'Hutang & Piutang',
  kwitansi: 'Kwitansi',
  keuangan: 'Laba Rugi',
  laporan: 'Laporan',
  master: 'Master Data',
  backup: 'Backup',
  pengaturan: 'Pengaturan',
  members: 'Anggota',
  kolam: 'Kolam',
  komoditas: 'Katalog Komoditas',
  pakan: 'Jenis Pakan',
  siklus: 'Siklus Tebar',
  'p3k-ikan': 'P3K Ikan',
  kematian: 'Penyebab Kematian',
  satuan: 'Satuan',
  customers: 'Pelanggan',
  services: 'Layanan',
  orders: 'Pesanan',
  schedule: 'Jadwal',
  technicians: 'Teknisi',
  assets: 'Unit Servis',
  invoice: 'Invoice',
  quotations: 'Penawaran',
};

export function labelModulePages(pages: string[]): string {
  if (!pages || !pages.length) return '—';
  return pages.map((p) => MODULE_PAGE_LABELS[p] || p.replace(/_/g, ' ')).join(', ');
}

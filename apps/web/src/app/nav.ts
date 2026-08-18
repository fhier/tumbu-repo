export const PLATFORM_NAV = [
  { key: 'platform', label: 'Platform Control Center' },
  { key: 'workspaces', label: 'Usaha' },
  { key: 'plans', label: 'Paket' },
  { key: 'blueprints', label: 'Blueprint' },
  { key: 'modules', label: 'Modul' },
  { key: 'billing', label: 'Tagihan' },
  { key: 'members', label: 'Anggota & Akses' },
  { key: 'leads', label: 'Daftar Minat' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'pengaturan', label: 'Pengaturan Platform' },
];

export const MODULE_PAGES: Record<string, string[]> = {
  dashboard: ['dashboard'],
  purchase: ['pembelian', 'beritaacara'],
  sales: ['penjualan', 'suratjalan'],
  inventory: ['stok'],
  expense: ['pengeluaran'],
  cash: ['kas', 'kwitansi'],
  payable: ['hutang'],
  receivable: ['hutang'],
  finance: ['keuangan', 'laporan', 'tutupbuku'],
  master: ['master'],
  backup: ['backup'],
  settings: ['pengaturan'],
  users: ['members'],
  customers: ['customers'],
  services: ['services'],
  orders: ['orders'],
  schedule: ['schedule'],
  technicians: ['technicians'],
  assets: ['assets'],
  invoice: ['invoice'],
  quotations: ['quotations'],
};

export const ERP_NAV = [
  { group: 'Utama', items: [{ key: 'dashboard', label: 'Dashboard' }] },
  { group: 'Transaksi', items: [
    { key: 'pembelian', label: 'Pembelian' },
    { key: 'penjualan', label: 'Penjualan' },
    { key: 'beritaacara', label: 'Berita Acara' },
    { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'suratjalan', label: 'Surat Jalan' },
  ]},
  { group: 'Stok', items: [{ key: 'stok', label: 'Stok' }] },
  { group: 'Keuangan', items: [
    { key: 'kas', label: 'Kas & Bank' },
    { key: 'hutang', label: 'Hutang & Piutang' },
    { key: 'kwitansi', label: 'Kwitansi PDF' },
    { key: 'keuangan', label: 'Laba Rugi' },
  ]},
  { group: 'Laporan & Data', items: [
    { key: 'laporan', label: 'Laporan' },
    { key: 'master', label: 'Master Data' },
  ]},
  { group: 'Sistem', items: [
    { key: 'pengaturan', label: 'Pengaturan' },
    { key: 'members', label: 'Member / Pengguna' },
    { key: 'backup', label: 'Backup & Restore' },
    { key: 'tutupbuku', label: 'Tutup Buku' },
  ]},
];

export const AQUA_NAV = [
  {
    group: 'Utama',
    items: [
      { key: 'onboarding', label: 'Setup usaha' },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'analisa', label: 'Analisa' },
    ],
  },
  {
    group: 'Transaksi Utama',
    items: [
      { key: 'penjualan', label: 'Penjualan Panen' },
      { key: 'pengeluaran', label: 'Pengeluaran' },
    ],
  },
  {
    group: 'Master',
    items: [
      { key: 'kolam', label: 'Kolam' },
      { key: 'komoditas', label: 'Katalog Komoditas' },
      { key: 'pakan', label: 'Jenis pakan' },
      // Pemasok/Agen sementara disembunyikan — rekomendasi netral via katalog pakan 2026
      { key: 'satuan', label: 'Satuan' },
      { key: 'kematian', label: 'Penyebab Kematian / Penyakit' },
    ],
  },
  {
    group: 'Pengetahuan',
    items: [
      { key: 'p3k-ikan', label: 'P3K Ikan / Penyakit' },
    ],
  },
  {
    group: 'Produksi',
    items: [
      { key: 'siklus', label: 'Siklus / Periode Tebar' },
      { key: 'tutup-siklus', label: 'Tutup Siklus' },
    ],
  },
  {
    group: 'Sistem',
    items: [
      { key: 'pengaturan', label: 'Pengaturan' },
      { key: 'members', label: 'Anggota & Akses' },
    ],
  },
];

export const SERVICE_NAV = [
  { group: 'Utama', items: [{ key: 'dashboard', label: 'Dashboard' }] },
  { group: 'Operasional', items: [
    { key: 'customers', label: 'Pelanggan' }, { key: 'services', label: 'Layanan' },
    { key: 'quotations', label: 'Penawaran' },
    { key: 'orders', label: 'Pesanan / WO' }, { key: 'schedule', label: 'Jadwal' },
    { key: 'technicians', label: 'Teknisi' }, { key: 'assets', label: 'Unit servis' },
  ]},
  { group: 'Keuangan', items: [
    { key: 'kas', label: 'Kas & Bank' }, { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'invoice', label: 'Invoice' },
    { key: 'keuangan', label: 'Laba Rugi' },
  ]},
  { group: 'Laporan', items: [{ key: 'laporan', label: 'Laporan' }] },
  { group: 'Sistem', items: [{ key: 'members', label: 'Anggota' }, { key: 'pengaturan', label: 'Pengaturan' }] },
];

function filterNav(nav: typeof ERP_NAV, moduleIds: string[]) {
  const pages = new Set<string>();
  for (const id of moduleIds) (MODULE_PAGES[id] || []).forEach((p) => pages.add(p));
  if (!pages.size) pages.add('dashboard');
  return nav.map((g) => ({ ...g, items: g.items.filter((i) => pages.has(i.key)) })).filter((g) => g.items.length > 0);
}

export function navForModules(moduleIds: string[]) {
  return filterNav(ERP_NAV, moduleIds);
}

/** Halaman ERP yang dipakai workspace Budidaya paket Business (dashboard + transaksi + PDF). */
export const AQUA_ERP_PAGES = new Set([
  'dashboard', 'pembelian', 'penjualan', 'beritaacara', 'pengeluaran', 'suratjalan',
  'stok', 'kas', 'hutang', 'kwitansi', 'keuangan', 'laporan', 'master', 'backup',
  'members', 'tutupbuku', 'pengaturan',
]);

export function aquaHasBusinessModules(moduleIds: string[]) {
  return moduleIds.some((m) =>
    ['purchase', 'sales', 'expense', 'cash', 'finance', 'inventory'].includes(m),
  );
}

function applyRoleNavFilter(base: typeof ERP_NAV, role?: string) {
  const r = String(role || '').toUpperCase();
  if (r === 'TECHNICIAN') {
    const allowed = new Set(['dashboard', 'orders', 'schedule', 'customers', 'assets']);
    return base
      .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.key)) }))
      .filter((g) => g.items.length > 0);
  }
  if (r === 'STAFF') {
    const deny = new Set(['pengaturan', 'backup', 'tutupbuku', 'members']);
    return base
      .map((g) => ({ ...g, items: g.items.filter((i) => !deny.has(i.key)) }))
      .filter((g) => g.items.length > 0);
  }
  return base;
}

export type BlueprintKind = 'distributor' | 'service' | 'aquaculture' | string;

/**
 * Isolasi menu via Workspace Type (Filter Context) — route backend tetap utuh.
 * PEMBUDIDAYA: operasional kolam + feed/mortalitas/sampling (via siklus) + penjualan panen.
 * DISTRIBUTOR: inventory, trading, pickup, hutang/piutang — tanpa operasional kolam/FCR.
 */
const AQUA_ISOLATION_ALLOW = new Set([
  'dashboard', 'onboarding', 'analisa',
  'kolam', 'komoditas', 'pakan', 'satuan', 'kematian', 'p3k-ikan',
  'siklus', 'tutup-siklus',
  'penjualan', // Penjualan Panen
  'pengeluaran',
  'pengaturan', 'members',
]);

const DISTRIBUTOR_ISOLATION_DENY = new Set([
  'analisa', 'kolam', 'komoditas', 'pakan', 'satuan', 'kematian', 'p3k-ikan',
  'siklus', 'tutup-siklus', 'onboarding', 'tutup-siklus',
]);

function applyPageAllow(nav: typeof ERP_NAV, allow: Set<string>) {
  return nav
    .map((g) => ({ ...g, items: g.items.filter((i) => allow.has(i.key)) }))
    .filter((g) => g.items.length > 0);
}

function applyPageDeny(nav: typeof ERP_NAV, deny: Set<string>) {
  return nav
    .map((g) => ({ ...g, items: g.items.filter((i) => !deny.has(i.key)) }))
    .filter((g) => g.items.length > 0);
}

function aquaIsolatedNav(moduleIds: string[], role?: string) {
  let merged = AQUA_NAV.map((g) => ({ ...g, items: [...g.items] }));

  const hasSales = moduleIds.includes('sales') || aquaHasBusinessModules(moduleIds);
  const hasExpense = moduleIds.includes('expense');

  merged = merged.map((g) => {
    if (g.group !== 'Transaksi Utama') return g;
    return {
      ...g,
      items: g.items.filter((i) => {
        if (i.key === 'penjualan') return hasSales;
        if (i.key === 'pengeluaran') return hasExpense;
        return true;
      }),
    };
  }).filter((g) => g.items.length > 0);

  merged = applyPageAllow(merged, AQUA_ISOLATION_ALLOW);
  return applyRoleNavFilter(merged, role);
}

function distributorIsolatedNav(moduleIds: string[], role?: string) {
  const base = filterNav(ERP_NAV, moduleIds).map((g) => ({
    ...g,
    items: g.items.map((i) => {
      if (i.key === 'stok') return { ...i, label: 'Inventory / Holding' };
      if (i.key === 'pembelian') return { ...i, label: 'Pembelian (Trading)' };
      if (i.key === 'penjualan') return { ...i, label: 'Penjualan (Trading)' };
      if (i.key === 'beritaacara') return { ...i, label: 'Multi-drop Pickup (BA)' };
      if (i.key === 'suratjalan') return { ...i, label: 'Surat Jalan / Drop' };
      if (i.key === 'hutang') return { ...i, label: 'Hutang & Piutang' };
      return i;
    }),
  }));
  return applyRoleNavFilter(applyPageDeny(base, DISTRIBUTOR_ISOLATION_DENY), role);
}

/**
 * Platform navigation by blueprint capability (`kind`), not blueprint ID.
 * New blueprints of an existing kind need no platform routing change.
 */
export function navForKind(kind: BlueprintKind | undefined, moduleIds: string[], role?: string) {
  const k = kind || 'distributor';
  if (k === 'aquaculture') {
    return aquaIsolatedNav(moduleIds, role);
  }
  if (k === 'service') {
    return applyRoleNavFilter(filterNav(SERVICE_NAV, moduleIds), role);
  }
  return distributorIsolatedNav(moduleIds, role);
}

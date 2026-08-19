/**
 * Blueprint Jasa V1 — Skin presentation config only.
 * Domain/workflow stay generic (Work Order, Service Item, …).
 * Lookup by catalog registration id; engines must not branch on these ids for behavior.
 */

export type ServicePageKey =
  | 'dashboard'
  | 'customers'
  | 'services'
  | 'quotations'
  | 'orders'
  | 'schedule'
  | 'invoice'
  | 'technicians'
  | 'members'
  | 'assets'
  | 'kas'
  | 'pengeluaran'
  | 'keuangan'
  | 'laporan'
  | 'pengaturan';

export type ServiceSkinConfig = {
  skinKey: 'salon' | 'sofa' | 'ac';
  displayName: string;
  tagline: string;
  navLabels: Partial<Record<ServicePageKey, string>>;
  pageTitles: Partial<Record<ServicePageKey, string>>;
  emptyStates: Partial<Record<ServicePageKey | 'assetsOff', string>>;
  assetFieldLabels: {
    locationLabel: string;
    brand: string;
    type: string;
    capacity: string;
    serial: string;
  };
  notifyAssetSaved: string;
};

const SALON: ServiceSkinConfig = {
  skinKey: 'salon',
  displayName: 'Salon Kamar Mandi',
  tagline: 'Layanan pembersihan & restorasi kamar mandi',
  navLabels: {
    services: 'Layanan',
    orders: 'Pesanan / WO',
    technicians: 'Teknisi',
  },
  pageTitles: {
    dashboard: 'Dashboard',
    services: 'Katalog layanan',
    orders: 'Pesanan / Work Order',
  },
  emptyStates: {
    services: 'Belum ada layanan. Tambah paket pembersihan atau restorasi.',
    orders: 'Belum ada pesanan kerja.',
    assetsOff: 'Modul unit servis tidak aktif pada konfigurasi usaha ini.',
  },
  assetFieldLabels: {
    locationLabel: 'Lokasi',
    brand: 'Merek',
    type: 'Tipe',
    capacity: 'Kapasitas',
    serial: 'Serial',
  },
  notifyAssetSaved: 'Unit servis disimpan.',
};

const SOFA: ServiceSkinConfig = {
  skinKey: 'sofa',
  displayName: 'Cuci Sofa & Furniture',
  tagline: 'Cuci sofa, kasur, dan furniture',
  navLabels: {
    quotations: 'Penawaran / Survey',
    services: 'Layanan',
    orders: 'Pesanan / WO',
  },
  pageTitles: {
    quotations: 'Penawaran / Survey',
    services: 'Katalog layanan',
  },
  emptyStates: {
    quotations: 'Belum ada penawaran. Buat survey harga sebelum Work Order.',
    services: 'Belum ada layanan cuci.',
    orders: 'Belum ada pesanan kerja.',
    assetsOff: 'Modul unit servis tidak aktif pada konfigurasi usaha ini.',
  },
  assetFieldLabels: {
    locationLabel: 'Lokasi',
    brand: 'Merek',
    type: 'Tipe',
    capacity: 'Kapasitas',
    serial: 'Serial',
  },
  notifyAssetSaved: 'Unit servis disimpan.',
};

const AC: ServiceSkinConfig = {
  skinKey: 'ac',
  displayName: 'Cuci AC',
  tagline: 'Servis dan perawatan unit pendingin',
  navLabels: {
    assets: 'Unit servis',
    services: 'Layanan',
    orders: 'Pesanan / WO',
    technicians: 'Teknisi',
  },
  pageTitles: {
    assets: 'Unit servis',
    services: 'Katalog layanan',
  },
  emptyStates: {
    assets: 'Belum ada unit terdaftar. Registrasi unit pelanggan untuk riwayat servis.',
    services: 'Belum ada layanan servis.',
    orders: 'Belum ada pesanan kerja.',
    assetsOff: 'Modul unit servis tidak aktif pada konfigurasi usaha ini.',
  },
  assetFieldLabels: {
    locationLabel: 'Lokasi / ruangan',
    brand: 'Merek',
    type: 'Tipe unit',
    capacity: 'Kapasitas',
    serial: 'Serial',
  },
  notifyAssetSaved: 'Unit servis disimpan.',
};

/** Registration id → skin (presentation lookup only). */
const BY_CATALOG_ID: Record<string, ServiceSkinConfig> = {
  service_teknisi_perikanan: AC,
  service_jasa: AC,
};

export const DEFAULT_SERVICE_SKIN: ServiceSkinConfig = {
  skinKey: 'ac',
  displayName: 'Teknisi & Jasa Perikanan',
  tagline: 'Layanan instalasi, maintenance aerator/pompa, & tes air kolam',
  navLabels: { assets: 'Peralatan / Unit' },
  pageTitles: { assets: 'Unit & Peralatan Kolam' },
  emptyStates: {
    assetsOff: 'Modul unit & peralatan tidak aktif pada konfigurasi usaha ini.',
  },
  assetFieldLabels: {
    locationLabel: 'Lokasi / Kolam',
    brand: 'Merek Equipment',
    type: 'Tipe (Aerator/Pompa)',
    capacity: 'Kapasitas (HP/Watt)',
    serial: 'No. Seri / Kode Unit',
  },
  notifyAssetSaved: 'Unit peralatan disimpan.',
};

export function skinForBlueprint(blueprintId?: string | null): ServiceSkinConfig {
  if (!blueprintId) return DEFAULT_SERVICE_SKIN;
  return BY_CATALOG_ID[blueprintId] ?? DEFAULT_SERVICE_SKIN;
}

export function applySkinNavLabels<T extends { group: string; items: Array<{ key: string; label: string }> }>(
  nav: T[],
  skin: ServiceSkinConfig,
): T[] {
  return nav.map((g) => ({
    ...g,
    items: g.items.map((i) => ({
      ...i,
      label: skin.navLabels[i.key as ServicePageKey] || i.label,
    })),
  }));
}

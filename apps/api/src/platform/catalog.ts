/** Shared blueprint + module catalog for TUMBU Platform */

import type { BlueprintExtension } from './extension.types';
import { ALWAYS_READY, EMPTY_ONBOARDING } from './extension.types';

export type BlueprintCatalogMeta = {
  /** Hidden from public catalog, workspace creation, and onboarding picker. */
  hidden: boolean;
  experimental: boolean;
  nonCore: boolean;
};

export type BlueprintDef = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  templateId: string;
  description: string;
  modules: string[];
  available: boolean;
  kind: 'distributor' | 'service' | 'aquaculture';
  /** Catalog visibility — hide ≠ delete; code & runtime preserved for Owner reactivation. */
  catalog: BlueprintCatalogMeta;
  /** Platform extension metadata — SSOT for onboarding / ready / bootstrap. */
  extension: BlueprintExtension;
};

const CORE_CATALOG: BlueprintCatalogMeta = { hidden: false, experimental: false, nonCore: false };
const HIDDEN_NON_CORE: BlueprintCatalogMeta = { hidden: true, experimental: true, nonCore: true };

export function isPublicCatalogBlueprint(b: BlueprintDef): boolean {
  return b.available && !b.catalog.hidden;
}

export function isSelectableBlueprint(b: BlueprintDef): boolean {
  return isPublicCatalogBlueprint(b);
}

export function publicCatalogBlueprints(): BlueprintDef[] {
  return BLUEPRINTS.filter((b) => isPublicCatalogBlueprint(b) && b.kind === 'aquaculture');
}

/** Default blueprint when caller omits id — registration constant, not business branching. */
export const DEFAULT_BLUEPRINT_ID = 'operational_distributor';

export const MODULE_REGISTRY = [
  { id: 'dashboard', name: 'Dashboard', layer: 'runtime', status: 'stable', pages: ['dashboard'] },
  { id: 'purchase', name: 'Pembelian', layer: 'runtime', status: 'stable', pages: ['pembelian', 'beritaacara'] },
  { id: 'sales', name: 'Penjualan', layer: 'runtime', status: 'stable', pages: ['penjualan', 'suratjalan'] },
  { id: 'inventory', name: 'Stok', layer: 'runtime', status: 'stable', pages: ['stok'] },
  { id: 'expense', name: 'Pengeluaran', layer: 'runtime', status: 'stable', pages: ['pengeluaran'] },
  { id: 'cash', name: 'Kas & Bank', layer: 'runtime', status: 'stable', pages: ['kas'] },
  { id: 'payable', name: 'Hutang', layer: 'runtime', status: 'stable', pages: ['hutang'] },
  { id: 'receivable', name: 'Piutang', layer: 'runtime', status: 'stable', pages: ['hutang'] },
  { id: 'finance', name: 'Keuangan & Laporan', layer: 'runtime', status: 'stable', pages: ['keuangan', 'laporan', 'tutupbuku'] },
  { id: 'master', name: 'Master Data', layer: 'runtime', status: 'stable', pages: ['master'] },
  { id: 'backup', name: 'Backup', layer: 'runtime', status: 'stable', pages: ['backup'] },
  { id: 'settings', name: 'Pengaturan', layer: 'runtime', status: 'stable', pages: ['pengaturan'] },
  { id: 'users', name: 'Anggota', layer: 'runtime', status: 'stable', pages: ['members'] },
  { id: 'customers', name: 'Pelanggan', layer: 'runtime', status: 'stable', pages: ['customers'] },
  { id: 'services', name: 'Layanan', layer: 'runtime', status: 'stable', pages: ['services'] },
  { id: 'orders', name: 'Pesanan / WO', layer: 'runtime', status: 'stable', pages: ['orders'] },
  { id: 'schedule', name: 'Jadwal', layer: 'runtime', status: 'stable', pages: ['schedule'] },
  { id: 'technicians', name: 'Teknisi / Tim Field', layer: 'runtime', status: 'stable', pages: ['technicians'] },
  { id: 'assets', name: 'Unit & Peralatan Kolam', layer: 'runtime', status: 'stable', pages: ['assets'] },
  { id: 'invoice', name: 'Invoice & Kwitansi', layer: 'runtime', status: 'stable', pages: ['invoice', 'kwitansi'] },
  { id: 'quotations', name: 'Penawaran', layer: 'runtime', status: 'stable', pages: ['quotations'] },
];

const SERVICE_CORE = [
  'dashboard', 'customers', 'services', 'orders', 'schedule', 'technicians',
  'expense', 'cash', 'receivable', 'finance', 'invoice', 'settings', 'users',
];

const SOFA_MODULES = [...SERVICE_CORE, 'quotations'];
const AC_MODULES = [...SERVICE_CORE, 'assets'];

const DISTRIBUTOR_SIZE_LABELS = [
  '2-3 cm', '3-4 cm', '4-5 cm', '5-6 cm', '6-7 cm', '7-8 cm', '8-9 cm', '9-10 cm', '11-12 cm',
  'P', 'BL',
  '3', '4', '5', '6', '7', '8', '9',
  '3,5', '4,6', '4,7', '5,7', '6,8', '7,9',
  '10', '11', '12',
];

/** SSOT daftar ukuran default Distributor Benih (bootstrap + seed). */
export function distributorSizeLabels(): string[] {
  return [...DISTRIBUTOR_SIZE_LABELS];
}

export const BLUEPRINTS: BlueprintDef[] = [
  {
    id: 'operational_distributor',
    name: 'Distributor Benih',
    category: 'operasional',
    categoryLabel: 'Operasional',
    templateId: 'operational_v1',
    description: 'Alur berita acara, pembelian, stok per ukuran, penjualan, surat jalan, kas, hutang & piutang.',
    modules: [
      'dashboard', 'purchase', 'sales', 'inventory', 'expense', 'cash',
      'payable', 'receivable', 'finance', 'master', 'backup', 'settings', 'users',
    ],
    available: true,
    kind: 'distributor',
    catalog: CORE_CATALOG,
    extension: {
      onboarding: {
        title: 'Siapkan data usaha',
        readyWithoutSteps: true,
        steps: [
          {
            id: 'import_excel',
            title: 'Impor data lama (opsional)',
            description: 'Pindahkan master & histori dari Excel agar pembukuan tidak mulai dari nol.',
            kind: 'excel_import',
            required: false,
            skipLabel: 'Lewati, buka Dashboard',
          },
          {
            id: 'ready',
            title: 'Workspace siap',
            description: 'Usaha siap dipakai. Impor Excel bisa dilakukan lagi dari setup jika dilanjutkan, atau nanti sesuai paket Anda.',
            kind: 'ready',
            required: false,
          },
        ],
      },
      ready: ALWAYS_READY,
      bootstrap: { strategy: 'seed_sizes', labels: DISTRIBUTOR_SIZE_LABELS },
    },
  },
  {
    id: 'service_teknisi_perikanan',
    name: 'Teknisi & Jasa Perikanan',
    category: 'jasa',
    categoryLabel: 'Jasa & Teknisi',
    templateId: 'service_perikanan_v1',
    description: 'Booking & work order servis aerator, instalasi kincir, pemeliharaan pompa, lab kualitas air, dan konsultasi kolam.',
    modules: SERVICE_CORE,
    available: true,
    kind: 'service',
    catalog: CORE_CATALOG,
    extension: {
      onboarding: EMPTY_ONBOARDING,
      ready: ALWAYS_READY,
      bootstrap: {
        strategy: 'seed_service_items',
        items: [
          { name: 'Servis & Maintenance Aerator / Kincir', category: 'Teknik', unit: 'unit', price: 150000 },
          { name: 'Uji Kualitas Air & Konsultasi', category: 'Lab & Konsultasi', unit: 'sampel', price: 100000 },
        ],
      },
    },
  },
  /**
   * Budidaya — RELEASED V1 (1.0.0) · 2026-07-19 · Code Freeze V1.
   * available:true → tampil di catalog & dapat dipilih saat buat workspace.
   */
  {
    id: 'operational_aquaculture_freshwater',
    name: 'Budidaya Air Tawar',
    category: 'operasional',
    categoryLabel: 'Operasional',
    templateId: 'aquaculture_freshwater_v1',
    description:
      'Siklus budidaya air tawar (kolam, tebar, pakan, panen, BOP/HPP).',
    modules: [
      'dashboard', 'purchase', 'sales', 'inventory', 'expense', 'cash',
      'payable', 'receivable', 'finance', 'master', 'backup', 'settings', 'users',
    ],
    available: true,
    kind: 'aquaculture',
    catalog: CORE_CATALOG,
    extension: {
      onboarding: {
        title: 'Siapkan usaha budidaya',
        readyWithoutSteps: false,
        steps: [
          {
            id: 'pond',
            title: 'Tambah wadah budidaya',
            description: 'Minimal satu wadah aktif (ember, terpal, atau kolam) agar siklus pertama bisa dimulai.',
            kind: 'form_pond',
            required: true,
            skipLabel: 'Nanti saja',
          },
          {
            id: 'species',
            title: 'Konfirmasi jenis ikan',
            description: 'Spesies dari registrasi dipakai otomatis. Tambah sekunder hanya jika paket Multi Species.',
            kind: 'form_species',
            required: true,
            skipLabel: 'Nanti saja',
          },
          {
            id: 'ready',
            title: 'Workspace siap',
            description: 'Wadah dan jenis ikan sudah ada. Anda bisa mulai siklus pertama kapan saja.',
            kind: 'ready',
            required: true,
          },
        ],
      },
      ready: {
        forceUntilReady: true,
        facts: ['activePonds', 'activeSpecies'],
        rules: [
          { type: 'min_count', fact: 'activePonds', min: 1 },
          { type: 'min_count', fact: 'activeSpecies', min: 1 },
        ],
      },
      bootstrap: { strategy: 'none' },
    },
  },
];

export function blueprintById(id: string) {
  return BLUEPRINTS.find((b) => b.id === id) ?? BLUEPRINTS.find((b) => b.id === DEFAULT_BLUEPRINT_ID)!;
}

export function modulesForBlueprint(id: string) {
  return blueprintById(id).modules;
}

export function extensionForBlueprint(id: string): BlueprintExtension {
  return blueprintById(id).extension;
}

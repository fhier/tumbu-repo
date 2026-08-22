/**
 * SSOT komoditas perikanan — Distributor & Pembudidaya (ERP jual/beli).
 * Kategori menentukan UOM wajib: BENIH → ekor, IKAN_KONSUMSI → kg.
 */

export type CommodityCategory = 'BENIH' | 'IKAN_KONSUMSI';

export const COMMODITY_CATEGORIES: Array<{
  id: CommodityCategory;
  label: string;
  unit: string;
  unitLabel: string;
}> = [
  { id: 'BENIH', label: 'Benih / Bibit Ikan', unit: 'ekor', unitLabel: 'Ekor' },
  { id: 'IKAN_KONSUMSI', label: 'Ikan Konsumsi (Siap Panen/Jual)', unit: 'kg', unitLabel: 'Kg' },
];

/** Opsi bawaan jenis/spesies ikan (boleh diketik manual di UI). */
export const FISH_SPECIES_OPTIONS = [
  'Nila Merah',
  'Nila Hitam',
  'Lele',
  'Gurame',
  'Patin',
  'Mas',
  'Bawal',
  'Nilem',
  'Pelahlar',
  'Lainnya',
] as const;

export function normalizeCommodityCategory(raw: unknown): CommodityCategory {
  const v = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (v === 'IKAN_KONSUMSI' || v === 'KONSUMSI' || v === 'IKAN' || v === 'CONSUMABLE') {
    return 'IKAN_KONSUMSI';
  }
  return 'BENIH';
}

export function unitForCommodity(category: CommodityCategory): string {
  return category === 'IKAN_KONSUMSI' ? 'kg' : 'ekor';
}

export function unitLabelForCommodity(category: CommodityCategory): string {
  return category === 'IKAN_KONSUMSI' ? 'Kg' : 'Ekor';
}

export function commodityLabel(category: CommodityCategory): string {
  return category === 'IKAN_KONSUMSI' ? 'Ikan Konsumsi' : 'Benih';
}

/** Infer kategori dari satuan lama (migrasi lembut). */
export function inferCommodityFromUnit(unit: unknown): CommodityCategory {
  const u = String(unit || '').trim().toLowerCase();
  if (u === 'kg' || u === 'kilogram' || u === 'ton' || u === 'ons') return 'IKAN_KONSUMSI';
  return 'BENIH';
}

export function formatQtyWithUnit(qty: number, unitOrCategory: string): string {
  const n = Number(qty) || 0;
  const raw = String(unitOrCategory || '').trim();
  const cat = raw === 'IKAN_KONSUMSI' || raw === 'BENIH'
    ? (raw as CommodityCategory)
    : inferCommodityFromUnit(raw);
  const unitLabel = unitLabelForCommodity(
    raw === 'kg' || raw === 'ekor' ? inferCommodityFromUnit(raw) : cat,
  );
  const resolved = (raw === 'kg' || raw === 'ekor')
    ? (raw === 'kg' ? 'Kg' : 'Ekor')
    : unitLabel;
  return `${n.toLocaleString('id-ID')} ${resolved}`;
}

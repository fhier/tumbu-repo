/**
 * Mirror SSOT apps/api/src/erp/fishery-commodity.ts — opsi UI web.
 * Jaga selaras saat mengubah daftar spesies / kategori.
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

export function formatQtyWithUnit(qty: number, unitOrCategory: string): string {
  const n = Number(qty) || 0;
  const raw = String(unitOrCategory || '').trim();
  if (raw === 'IKAN_KONSUMSI' || raw === 'BENIH') {
    return `${n.toLocaleString('id-ID')} ${unitLabelForCommodity(raw as CommodityCategory)}`;
  }
  const u = raw.toLowerCase();
  const label = u === 'kg' || u === 'kilogram' || u === 'ton' ? 'Kg' : 'Ekor';
  return `${n.toLocaleString('id-ID')} ${label}`;
}

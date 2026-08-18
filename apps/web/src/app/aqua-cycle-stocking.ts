/**
 * Kalkulator padat tebar & BOP pre-tebar — panduan UX (bukan Formula SSOT).
 */

export type DensityBand = 'aman' | 'sedang' | 'risiko';

export type DensityRecommendation = {
  band: DensityBand;
  label: string;
  minPerM3: number;
  maxPerM3: number;
  minTotal: number;
  maxTotal: number;
  note: string;
};

const BANDS: Omit<DensityRecommendation, 'minTotal' | 'maxTotal'>[] = [
  {
    band: 'aman',
    label: 'Aman',
    minPerM3: 75,
    maxPerM3: 100,
    note: 'Padat tebar konservatif — cocok pemula atau kolam baru.',
  },
  {
    band: 'sedang',
    label: 'Sedang',
    minPerM3: 100,
    maxPerM3: 150,
    note: 'Padat tebar umum di lapangan dengan manajemen pakan baik.',
  },
  {
    band: 'risiko',
    label: 'Risiko Tinggi',
    minPerM3: 200,
    maxPerM3: 300,
    note: 'Di atas 200 ekor/m³ — butuh aerasi & kualitas air ketat.',
  },
];

export function densityRecommendations(volumeM3: number | null): DensityRecommendation[] {
  if (volumeM3 == null || !(volumeM3 > 0)) return [];
  return BANDS.map((b) => ({
    ...b,
    minTotal: Math.round(b.minPerM3 * volumeM3),
    maxTotal: Math.round(b.maxPerM3 * volumeM3),
  }));
}

export function classifyDensity(pcsPerM3: number): DensityBand {
  if (pcsPerM3 <= 100) return 'aman';
  if (pcsPerM3 <= 150) return 'sedang';
  return 'risiko';
}

/** Kebutuhan pakan pre-tebar: benih × FCR × berat target (kg/ekor). */
export function estimateFeedKgPreStock(input: {
  seedCount: number;
  targetFcr: number;
  targetWeightGram: number;
}): number | null {
  const n = Number(input.seedCount);
  const fcr = Number(input.targetFcr);
  const wg = Number(input.targetWeightGram);
  if (!(n > 0) || !(fcr > 0) || !(wg > 0)) return null;
  return Math.round(n * fcr * (wg / 1000) * 100) / 100;
}

export type PreStockBop = {
  biayaBenih: number;
  biayaPakan: number;
  biayaOperasional: number;
  total: number;
  feedKg: number;
};

export function estimatePreStockBop(input: {
  seedCount: number;
  seedUnitCost: number;
  targetFcr: number;
  targetWeightGram: number;
  feedPricePerKg: number;
  operasionalCost: number;
}): PreStockBop | null {
  const feedKg = estimateFeedKgPreStock({
    seedCount: input.seedCount,
    targetFcr: input.targetFcr,
    targetWeightGram: input.targetWeightGram,
  });
  if (feedKg == null) return null;
  const biayaBenih = Math.round((Number(input.seedCount) || 0) * (Number(input.seedUnitCost) || 0));
  const biayaPakan = Math.round(feedKg * (Number(input.feedPricePerKg) || 0));
  const biayaOperasional = Math.round(Number(input.operasionalCost) || 0);
  return {
    feedKg,
    biayaBenih,
    biayaPakan,
    biayaOperasional,
    total: biayaBenih + biayaPakan + biayaOperasional,
  };
}

/** Progresi pelet umum (Lele/Nila — Hi-Pro-Vite). */
export const PELLET_PROGRESSION = [
  { code: 'PF-1000', weightG: '5–20 g', phase: 'Benih muda' },
  { code: '781-1', weightG: '20–50 g', phase: 'Grower awal' },
  { code: '781-2', weightG: '50–150 g', phase: 'Grower' },
  { code: '781-3', weightG: '>150 g', phase: 'Finishing' },
];

/**
 * Smart defaults & estimasi panen untuk form Siklus / Periode Tebar.
 * Prediksi operasional (UX) — bukan Formula Engine SSOT.
 */

export type SpeciesSuggestInput = {
  code?: string | null;
  name?: string | null;
  typicalDays?: number | null;
  typicalFcr?: number | null;
  typicalSrPct?: number | null;
  targetWeightGram?: number | null;
};

export type CycleTargetDefaults = {
  targetDays: number;
  targetFcr: number;
  targetSrPct: number;
  targetWeightGram: number;
  hint: string;
};

/** Preset cepat Target Hari (industri air tawar Indonesia). */
export const DAY_PRESETS = [
  { days: 60, label: '60 Hari — Benih Besar' },
  { days: 90, label: '90 Hari — Standar' },
  { days: 120, label: '120 Hari — Jumbo' },
] as const;

export const FCR_PRESETS = [
  { fcr: 0.95, label: '0.95 — Efisien (Lele tipikal)' },
  { fcr: 1.2, label: '1.2 — Standar' },
  { fcr: 1.5, label: '1.5 — Konservatif' },
] as const;

export const SR_PRESETS = [
  { sr: 80, label: '80% — Aman' },
  { sr: 85, label: '85% — Standar' },
  { sr: 90, label: '90% — Optimal' },
] as const;

function codeOf(sp: SpeciesSuggestInput): string {
  return String(sp.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

/** Rekomendasi target saat spesies dipilih (override user-facing defaults). */
export function suggestTargetsForSpecies(sp: SpeciesSuggestInput | null | undefined): CycleTargetDefaults {
  const code = sp ? codeOf(sp) : '';
  const name = String(sp?.name || '').toLowerCase();

  if (code.startsWith('LELE') || name.includes('lele')) {
    return {
      targetDays: 90,
      targetFcr: 0.95,
      targetSrPct: 85,
      targetWeightGram: sp?.targetWeightGram && Number(sp.targetWeightGram) > 0
        ? Number(sp.targetWeightGram)
        : 100,
      hint: 'Acuan Lele: ±90 hari, FCR ~0.95, SR ~85%, panen ~100 g/ekor.',
    };
  }
  if (code.startsWith('NILA') || name.includes('nila')) {
    return {
      targetDays: 120,
      targetFcr: 1.2,
      targetSrPct: 80,
      targetWeightGram: sp?.targetWeightGram && Number(sp.targetWeightGram) > 0
        ? Number(sp.targetWeightGram)
        : 250,
      hint: 'Acuan Nila: ±120 hari, FCR ~1.2, SR ~80%, panen ~250 g/ekor.',
    };
  }

  const days = sp?.typicalDays != null && Number(sp.typicalDays) > 0 ? Number(sp.typicalDays) : 100;
  const fcr = sp?.typicalFcr != null && Number(sp.typicalFcr) > 0 ? Number(sp.typicalFcr) : 1.2;
  const sr = sp?.typicalSrPct != null && Number(sp.typicalSrPct) > 0 ? Number(sp.typicalSrPct) : 85;
  const weight = sp?.targetWeightGram != null && Number(sp.targetWeightGram) > 0
    ? Number(sp.targetWeightGram)
    : 150;
  return {
    targetDays: days,
    targetFcr: Math.round(fcr * 100) / 100,
    targetSrPct: sr,
    targetWeightGram: weight,
    hint: 'Nilai dari profil spesies workspace / acuan industri. Sesuaikan dengan kondisi kolam Anda.',
  };
}

export type HarvestEstimate = {
  survivePcs: number;
  harvestKg: number;
  feedKg: number;
  bopPakan: number | null;
};

/**
 * Estimasi panen & pakan:
 * - survive = benih × SR%
 * - panen kg = survive × (berat target g / 1000)
 * - pakan kg = panen kg × FCR
 * - BOP pakan = pakan kg × harga pakan/kg (opsional)
 */
export function estimateHarvest(input: {
  seedCount: number;
  targetSrPct: number;
  targetFcr: number;
  targetWeightGram: number;
  feedPricePerKg?: number | null;
}): HarvestEstimate | null {
  const seed = Number(input.seedCount);
  const sr = Number(input.targetSrPct);
  const fcr = Number(input.targetFcr);
  const weightG = Number(input.targetWeightGram);
  if (!(seed > 0) || !(sr > 0) || !(fcr > 0) || !(weightG > 0)) return null;

  const survivePcs = seed * (sr / 100);
  const harvestKg = (survivePcs * weightG) / 1000;
  const feedKg = harvestKg * fcr;
  const price = input.feedPricePerKg != null ? Number(input.feedPricePerKg) : NaN;
  const bopPakan = Number.isFinite(price) && price > 0 ? feedKg * price : null;

  return {
    survivePcs: Math.round(survivePcs),
    harvestKg: Math.round(harvestKg * 100) / 100,
    feedKg: Math.round(feedKg * 100) / 100,
    bopPakan: bopPakan != null ? Math.round(bopPakan) : null,
  };
}

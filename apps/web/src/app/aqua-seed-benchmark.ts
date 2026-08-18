/**
 * Ukuran tebar / size benchmark — SSOT UX layer (prefill baseline siklus).
 * Mirror opsional: apps/api/src/budidaya/domain/aqua-knowledge.ts
 */

import { suggestTargetsForSpecies, type SpeciesSuggestInput } from './aqua-cycle-predict';

export type SeedSizeBenchmark = {
  id: string;
  label: string;
  /** Penyesuaian dari baseline spesies */
  daysDelta: number;
  fcrDelta: number;
  srDelta: number;
  weightGramHint: number;
  sop: string;
};

export const SEED_SIZE_BENCHMARKS: SeedSizeBenchmark[] = [
  {
    id: '3-5',
    label: '3–5 cm (Benih Kecil)',
    daysDelta: 15,
    fcrDelta: 0.08,
    srDelta: -3,
    weightGramHint: 3,
    sop: 'Benih kecil — pakan cacing/artemia dulu 7–10 hari. Pantau DO pagi/sore. Kepadatan jangan berlebihan.',
  },
  {
    id: '5-7',
    label: '5–7 cm (Standar Tebar)',
    daysDelta: 0,
    fcrDelta: 0,
    srDelta: 0,
    weightGramHint: 8,
    sop: 'Ukuran tebar umum. Pakan pellet sesuai size 2× sehari. Ganti air 20–30% jika amonia naik.',
  },
  {
    id: '7-9',
    label: '7–9 cm (Benih Besar)',
    daysDelta: -10,
    fcrDelta: -0.05,
    srDelta: 2,
    weightGramHint: 15,
    sop: 'Benih besar — siklus lebih pendek. Kurangi kepadatan awal 10–15%. Sampling mingguan disarankan.',
  },
  {
    id: '9-12',
    label: '9–12 cm (Jumbo / Siap Grow-out)',
    daysDelta: -20,
    fcrDelta: -0.08,
    srDelta: 3,
    weightGramHint: 25,
    sop: 'Langsung fase grow-out. Pakan 3% BB/hari awal, turunkan ke 2% mendekati panen. Waspadai overfeeding.',
  },
];

/** Varietas referensi per spesies — digabung dengan strain workspace. */
export const STRAIN_CATALOG: Record<string, Array<{ code: string; name: string }>> = {
  LELE: [
    { code: 'SANGKURIANG', name: 'Sangkuriang' },
    { code: 'DUMBO', name: 'Dumbo' },
    { code: 'MUTIARA', name: 'Mutiara' },
  ],
  NILA: [
    { code: 'NIRWANA', name: 'Nirwana' },
    { code: 'MUTIARA', name: 'Mutiara' },
    { code: 'BEST', name: 'Best Tilapia' },
  ],
  GURAME: [
    { code: 'SOANG', name: 'Soang' },
    { code: 'LOCAL', name: 'Lokal' },
  ],
  PATIN: [
    { code: 'PANGASIUS', name: 'Pangasius' },
    { code: 'DUMBO', name: 'Dumbo Patin' },
  ],
};

export const PRIMARY_SPECIES_OPTIONS = [
  { code: 'LELE', label: 'Lele' },
  { code: 'NILA', label: 'Nila' },
  { code: 'GURAME', label: 'Gurame' },
  { code: 'PATIN', label: 'Patin' },
];

export type BaselinePreview = {
  targetDays: number;
  targetFcr: number;
  targetSrPct: number;
  weightGram: number;
  sop: string;
  hint: string;
};

export function baselineFromSize(
  species: SpeciesSuggestInput | null | undefined,
  sizeId: string,
): BaselinePreview | null {
  const size = SEED_SIZE_BENCHMARKS.find((s) => s.id === sizeId);
  if (!size) return null;
  const base = suggestTargetsForSpecies(species);
  const targetDays = Math.max(30, base.targetDays + size.daysDelta);
  const targetFcr = Math.round(Math.max(0.7, base.targetFcr + size.fcrDelta) * 100) / 100;
  const targetSrPct = Math.min(99, Math.max(50, base.targetSrPct + size.srDelta));
  return {
    targetDays,
    targetFcr,
    targetSrPct,
    weightGram: size.weightGramHint,
    sop: size.sop,
    hint: base.hint,
  };
}

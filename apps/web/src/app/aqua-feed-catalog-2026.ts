/**
 * Katalog preset pakan populer 2026 — referensi pasar & kemasan karung.
 * Hanya panduan UX; harga aktual tetap di master jenis pakan workspace.
 */

export type PelletStage = {
  code: string;
  label: string;
  fishWeightG: string;
  notes?: string;
};

export type FeedPreset2026 = {
  id: string;
  species: string[];
  brand: string;
  productLine: string;
  proteinPct?: number;
  pelletStages: PelletStage[];
  bagSizesKg: number[];
  /** Harga per kg (IDR) — estimasi pasar 2026 */
  pricePerKg2026: number;
  notes?: string;
};

export const FEED_CATALOG_2026: FeedPreset2026[] = [
  {
    id: 'lele-hipro-781',
    species: ['Lele', 'Lele Sangkuriang', 'Lele Dumbo'],
    brand: 'Hi-Pro-Vite',
    productLine: '781',
    proteinPct: 32,
    pelletStages: [
      { code: 'F-999', label: 'F-999 / Benih', fishWeightG: '0–5 g', notes: 'Starter benih / fase awal' },
      { code: 'PF-1000', label: 'PF-1000', fishWeightG: '5–20 g', notes: 'Pertumbuhan cepat fase muda' },
      { code: '781-1', label: '781-1', fishWeightG: '20–50 g', notes: 'Pelet kecil' },
      { code: '781-2', label: '781-2', fishWeightG: '50–150 g', notes: 'Pelet sedang' },
      { code: '781-3', label: '781-3', fishWeightG: '>150 g', notes: 'Pelet besar / finishing' },
    ],
    bagSizesKg: [20, 30],
    pricePerKg2026: 14500,
    notes: 'Salah satu pakan lele paling populer di lapangan.',
  },
  {
    id: 'lele-prima',
    species: ['Lele', 'Lele Sangkuriang'],
    brand: 'Prima Feed',
    productLine: 'Lele Premium',
    proteinPct: 30,
    pelletStages: [
      { code: 'P-1', label: 'Starter P-1', fishWeightG: '0–10 g' },
      { code: 'P-2', label: 'Grower P-2', fishWeightG: '10–80 g' },
      { code: 'P-3', label: 'Finisher P-3', fishWeightG: '>80 g' },
    ],
    bagSizesKg: [20, 25],
    pricePerKg2026: 13200,
  },
  {
    id: 'nila-japfa',
    species: ['Nila', 'Nila Merah', 'Nila Hitam'],
    brand: 'Japfa Comfeed',
    productLine: 'Nila 781',
    proteinPct: 32,
    pelletStages: [
      { code: '781-S', label: '781 Starter', fishWeightG: '0–20 g' },
      { code: '781-1', label: '781-1', fishWeightG: '20–80 g' },
      { code: '781-2', label: '781-2', fishWeightG: '80–250 g' },
      { code: '781-3', label: '781-3', fishWeightG: '>250 g' },
    ],
    bagSizesKg: [20, 30],
    pricePerKg2026: 14800,
  },
  {
    id: 'nila-charoen',
    species: ['Nila', 'Nila Merah'],
    brand: 'Charoen Pokphand',
    productLine: 'CP Nila',
    proteinPct: 30,
    pelletStages: [
      { code: 'CP-S', label: 'CP Starter', fishWeightG: '0–15 g' },
      { code: 'CP-M', label: 'CP Medium', fishWeightG: '15–100 g' },
      { code: 'CP-L', label: 'CP Large', fishWeightG: '>100 g' },
    ],
    bagSizesKg: [20, 30],
    pricePerKg2026: 14100,
  },
  {
    id: 'gurame-781',
    species: ['Gurame', 'Gurame Soang'],
    brand: 'Hi-Pro-Vite',
    productLine: '781 Gurame',
    proteinPct: 28,
    pelletStages: [
      { code: '781-1', label: '781-1', fishWeightG: '0–50 g' },
      { code: '781-2', label: '781-2', fishWeightG: '50–200 g' },
      { code: '781-3', label: '781-3', fishWeightG: '>200 g' },
    ],
    bagSizesKg: [20, 30],
    pricePerKg2026: 15200,
  },
  {
    id: 'patin-charoen',
    species: ['Patin', 'Lele Dumbo'],
    brand: 'Charoen Pokphand',
    productLine: 'CP Patin',
    proteinPct: 32,
    pelletStages: [
      { code: 'CP-S', label: 'Starter', fishWeightG: '0–20 g' },
      { code: 'CP-1', label: 'Grower 1', fishWeightG: '20–100 g' },
      { code: 'CP-2', label: 'Grower 2', fishWeightG: '>100 g' },
    ],
    bagSizesKg: [20, 30],
    pricePerKg2026: 14600,
  },
];

export function feedPresetsForSpecies(speciesName: string): FeedPreset2026[] {
  const hay = speciesName.trim().toLowerCase();
  if (!hay) return FEED_CATALOG_2026;
  return FEED_CATALOG_2026.filter((p) =>
    p.species.some((s) => {
      const sl = s.toLowerCase();
      return sl.includes(hay) || hay.includes(sl.split(' ')[0]);
    }),
  );
}

export function suggestPelletStage(preset: FeedPreset2026, fishWeightG: number): PelletStage | null {
  if (!Number.isFinite(fishWeightG) || fishWeightG <= 0) return preset.pelletStages[0] ?? null;
  for (const stage of preset.pelletStages) {
    const m = stage.fishWeightG.match(/(\d+)\s*[–-]\s*(\d+)/);
    if (m) {
      const lo = Number(m[1]);
      const hi = Number(m[2]);
      if (fishWeightG >= lo && fishWeightG <= hi) return stage;
    }
    const gt = stage.fishWeightG.match(/>\s*(\d+)/);
    if (gt && fishWeightG > Number(gt[1])) return stage;
  }
  return preset.pelletStages[preset.pelletStages.length - 1] ?? null;
}

export type BagCalcResult = {
  fullBags: number;
  remainderKg: number;
  totalKg: number;
  bagSizeKg: number;
};

export function calcBagsNeeded(totalKg: number, bagSizeKg: number): BagCalcResult | null {
  if (!Number.isFinite(totalKg) || totalKg <= 0 || !Number.isFinite(bagSizeKg) || bagSizeKg <= 0) {
    return null;
  }
  const fullBags = Math.floor(totalKg / bagSizeKg);
  const remainderKg = Math.round((totalKg - fullBags * bagSizeKg) * 1000) / 1000;
  return { fullBags, remainderKg, totalKg, bagSizeKg };
}

export function formatBagCalc(result: BagCalcResult): string {
  const base = `${result.fullBags} karung @ ${result.bagSizeKg} kg`;
  if (result.remainderKg > 0.01) {
    return `${base} + sisa ${result.remainderKg.toLocaleString('id-ID')} kg`;
  }
  return base;
}

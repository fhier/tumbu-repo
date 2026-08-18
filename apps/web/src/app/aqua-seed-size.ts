/** Ukuran benih (cm) → estimasi berat (g/ekor) — panduan UX lapangan. */

export type SeedSizeCm = '3-5' | '5-7' | '7-9' | '9-12';

export const SEED_SIZE_CM_OPTIONS: Array<{
  id: SeedSizeCm;
  label: string;
  avgGram: number;
  hint: string;
}> = [
  { id: '3-5', label: '3–5 cm', avgGram: 2, hint: 'Benih sangat kecil / fry' },
  { id: '5-7', label: '5–7 cm', avgGram: 5, hint: 'Benih kecil umum tebar lele' },
  { id: '7-9', label: '7–9 cm', avgGram: 12, hint: 'Benih sedang' },
  { id: '9-12', label: '9–12 cm', avgGram: 25, hint: 'Benih besar / pembesaran awal' },
];

export function gramsFromSeedSizeCm(id: SeedSizeCm | string): number {
  const hit = SEED_SIZE_CM_OPTIONS.find((o) => o.id === id);
  return hit?.avgGram ?? 5;
}

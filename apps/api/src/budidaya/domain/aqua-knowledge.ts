/**
 * Pengetahuan referensi Budidaya Air Tawar Indonesia — SSOT katalog platform.
 * Dipakai untuk seed master, panduan pemula, dan target tipikal FCR/SR/hari.
 */

export const POND_SYSTEM_TYPES = [
  { code: 'EMBER', label: 'Ember / Galon / Drum', hint: 'Budidaya skala rumah/urban. Isi volume dalam liter.' },
  { code: 'GALON', label: 'Galon', hint: 'Wadah galon daur ulang. Isi volume liter.' },
  { code: 'DRUM', label: 'Drum', hint: 'Drum plastik/besi. Isi volume liter.' },
  { code: 'TERPAL', label: 'Kolam Terpal', hint: 'Kolam terpal bulat/persegi. Diameter (m) atau volume (liter).' },
  { code: 'BULAT', label: 'Kolam Bulat', hint: 'Kolam bulat terpal/fiber. Ukur diameter meter.' },
  { code: 'BIOFLOK', label: 'Bioflok', hint: 'Sistem bioflok; ukur diameter atau volume liter.' },
  { code: 'TANAH', label: 'Kolam Tanah', hint: 'Kolam galian tanah. Isi luas m².' },
  { code: 'SEMEN', label: 'Kolam Semen', hint: 'Kolam semen. Isi luas m².' },
  { code: 'BETON', label: 'Kolam Beton', hint: 'Kolam beton. Isi luas m².' },
  { code: 'RAS', label: 'RAS (Recirculating)', hint: 'Sistem sirkulasi; pantau DO, filter, dan mortalitas harian.' },
  { code: 'KERAMBA', label: 'Keramba (KJA)', hint: 'Keramba jaring apung; perhatikan arus dan kepadatan.' },
] as const;

/** Grup tipe wadah untuk UI onboarding (urban farming friendly). */
export const VESSEL_TYPE_GROUPS = [
  {
    id: 'ember',
    label: 'Ember / Galon / Drum',
    hint: 'Cocok urban farming & skala rumah tangga. Metrik: Volume (Liter).',
    defaultSystem: 'EMBER',
    systemCodes: ['EMBER', 'GALON', 'DRUM'],
    metric: 'volume_liter' as const,
  },
  {
    id: 'terpal',
    label: 'Kolam Terpal / Bulat / Bioflok',
    hint: 'Kolam terpal bundar atau bioflok. Metrik: Diameter (m) atau Volume (Liter).',
    defaultSystem: 'TERPAL',
    systemCodes: ['TERPAL', 'BULAT', 'BIOFLOK', 'RAS'],
    metric: 'diameter_or_volume' as const,
  },
  {
    id: 'kolam',
    label: 'Kolam Tanah / Semen / Beton',
    hint: 'Kolam permanen. Metrik: Luas (m²).',
    defaultSystem: 'TANAH',
    systemCodes: ['TANAH', 'SEMEN', 'BETON', 'KERAMBA'],
    metric: 'area_m2' as const,
  },
] as const;

export type SpeciesCatalogEntry = {
  code: string;
  name: string;
  typicalDays: number;
  typicalFcr: number;
  typicalSrPct: number;
  targetWeightGram?: number;
  defaultDensity?: number;
  densityUnit?: string;
  notes: string;
};

/** Spesies air tawar umum di Indonesia — nilai tipikal untuk panduan pemula. */
export const INDONESIAN_FRESHWATER_SPECIES: SpeciesCatalogEntry[] = [
  {
    code: 'LELE',
    name: 'Lele (Clarias)',
    typicalDays: 100,
    typicalFcr: 1.15,
    typicalSrPct: 90,
    targetWeightGram: 100,
    defaultDensity: 80,
    densityUnit: 'ekor/m2',
    notes: 'Siklus cepat 90–120 hari. Panen saat 80–120 g/ekor. SR target ≥85%. Perhatikan kualitas air dan pakan 2–3× sehari.',
  },
  {
    code: 'NILA',
    name: 'Nila (Tilapia)',
    typicalDays: 130,
    typicalFcr: 1.65,
    typicalSrPct: 85,
    targetWeightGram: 250,
    defaultDensity: 50,
    densityUnit: 'ekor/m2',
    notes: 'Siklus 120–150 hari. FCR tipikal 1.5–1.8. Sampling mingguan disarankan sebelum keputusan panen.',
  },
  {
    code: 'MAS',
    name: 'Ikan Mas (Common Carp)',
    typicalDays: 200,
    typicalFcr: 2.0,
    typicalSrPct: 80,
    targetWeightGram: 500,
    defaultDensity: 30,
    densityUnit: 'ekor/m2',
    notes: 'Siklus lebih panjang. Persiapan kolam dan kualitas air menentukan SR.',
  },
  {
    code: 'GURAME',
    name: 'Gurame',
    typicalDays: 270,
    typicalFcr: 2.2,
    typicalSrPct: 78,
    targetWeightGram: 600,
    defaultDensity: 15,
    densityUnit: 'ekor/m2',
    notes: 'Siklus 8–10 bulan. Kepadatan jangan berlebihan; pantau mortalitas saat musim hujan.',
  },
  {
    code: 'PATIN',
    name: 'Patin',
    typicalDays: 160,
    typicalFcr: 1.55,
    typicalSrPct: 86,
    targetWeightGram: 350,
    defaultDensity: 40,
    densityUnit: 'ekor/m2',
    notes: 'Siklus 150–180 hari. FCR baik bila pakan sesuai size ikan. Panen saat harga pasar menguntungkan.',
  },
  {
    code: 'BAWAL',
    name: 'Bawal (Pomfret)',
    typicalDays: 140,
    typicalFcr: 1.7,
    typicalSrPct: 82,
    targetWeightGram: 300,
    defaultDensity: 35,
    densityUnit: 'ekor/m2',
    notes: 'Perhatikan salinitas rendah/kolam payau bila dipadukan. Sampling rutin untuk estimasi panen.',
  },
  {
    code: 'NILA_MERAH',
    name: 'Nila Merah',
    typicalDays: 120,
    typicalFcr: 1.6,
    typicalSrPct: 84,
    targetWeightGram: 280,
    defaultDensity: 45,
    densityUnit: 'ekor/m2',
    notes: 'Mirip nila; permintaan pasar baik. Target panen 250–350 g/ekor.',
  },
  {
    code: 'GABUS',
    name: 'Gabus (Channa)',
    typicalDays: 180,
    typicalFcr: 1.9,
    typicalSrPct: 80,
    targetWeightGram: 400,
    defaultDensity: 20,
    densityUnit: 'ekor/m2',
    notes: 'Predator; pisahkan size berbeda. SR bergantung padat tebar dan pakan hidup/alternatif.',
  },
];

export function computePondMetrics(lengthM?: number | null, widthM?: number | null, depthM?: number | null) {
  if (lengthM == null || widthM == null || lengthM <= 0 || widthM <= 0) {
    return { areaM2: null as number | null, volumeM3: null as number | null };
  }
  const areaM2 = Math.round(lengthM * widthM * 1000) / 1000;
  const volumeM3 =
    depthM != null && depthM > 0
      ? Math.round(lengthM * widthM * depthM * 1000) / 1000
      : null;
  return { areaM2, volumeM3 };
}

export function resolvePondSystemType(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = POND_SYSTEM_TYPES.find((p) => p.code === code.toUpperCase());
  return hit?.code ?? code.trim().toUpperCase();
}

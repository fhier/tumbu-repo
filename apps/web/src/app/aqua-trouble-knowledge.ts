/**
 * P3K Ikan — pustaka gejala & pertolongan pertama (UX knowledge layer).
 */

export type TroubleAction = {
  title: string;
  steps: string[];
};

export type DrugDosageRule = {
  drug: string;
  /** Dosis per liter air, mis. gram/L atau ml/L */
  ratePerLiter: number;
  unit: 'g/L' | 'ml/L' | 'mg/L' | 'ppt';
  maxSafePpt?: number;
  notes?: string;
};

export type TroubleEntry = {
  id: string;
  symptoms: string[];
  keywords: string[];
  title: string;
  severity: 'warning' | 'critical';
  actions: TroubleAction[];
  saltDose?: string;
  medicineHint?: string;
  /** Obat dengan dosis berbasis volume air kolam */
  drugRules?: DrugDosageRule[];
};

export const TROUBLE_LIBRARY: TroubleEntry[] = [
  {
    id: 'gantung',
    symptoms: ['Ikan menggantung', 'Ikan di permukaan', 'Ikan kehabisan oksigen', 'Gantung'],
    keywords: ['gantung', 'permukaan', 'do', 'oksigen', 'mengapung diam'],
    title: 'Ikan Menggantung / Kehabisan Oksigen',
    severity: 'critical',
    actions: [
      {
        title: 'Tindakan Air',
        steps: [
          'Hentikan pemberian pakan 12–24 jam.',
          'Ganti air 30–50% (perlahan) atau aerasi kuat 2–4 jam.',
          'Ukur DO pagi & sore — target >4 mg/L.',
        ],
      },
      {
        title: 'Tindakan Pakan',
        steps: [
          'Puasakan 1 hari jika mortalitas >2% populasi.',
          'Lanjut pakan 50% dosis saat ikan aktif kembali.',
        ],
      },
    ],
    saltDose: 'Garam krosok 3–5 ppt (3–5 g/L) selama 24–48 jam jika stres akut.',
    medicineHint: 'Hindari obat kimia berat saat DO rendah — prioritaskan aerasi & ganti air.',
    drugRules: [
      {
        drug: 'Garam krosok (NaCl)',
        ratePerLiter: 3,
        unit: 'g/L',
        maxSafePpt: 5,
        notes: 'Larutkan bertahap; jangan melebihi 5 ppt untuk lele/nila.',
      },
    ],
  },
  {
    id: 'white-spot',
    symptoms: ['Bercak putih', 'White Spot', 'Titik putih di sirip/body', 'Ich'],
    keywords: ['white spot', 'bercak putih', 'ich', 'titik putih'],
    title: 'White Spot / Bercak Putih',
    severity: 'warning',
    actions: [
      {
        title: 'Tindakan Air',
        steps: [
          'Naikkan suhu air bertahap +2°C (max 30°C untuk lele/nila) selama 3 hari.',
          'Ganti air 20% setiap 2 hari selama perawatan.',
        ],
      },
      {
        title: 'Tindakan Pakan',
        steps: [
          'Kurangi pakan 30% selama 3 hari.',
          'Tambahkan vitamin C pada pakan jika tersedia.',
        ],
      },
    ],
    saltDose: 'Garam krosok 5 ppt selama 7–10 hari (lele/nila toleransi baik).',
    medicineHint: 'Malachite green / obat ich komersial — ikuti dosis label untuk volume kolam.',
    drugRules: [
      {
        drug: 'Garam krosok',
        ratePerLiter: 5,
        unit: 'g/L',
        maxSafePpt: 5,
        notes: 'Short bath atau kolam penuh — pantau ikan 30 menit pertama.',
      },
    ],
  },
  {
    id: 'kumis-putung',
    symptoms: ['Kumis putung', 'Kumis patah', 'Kumis lecet', 'Mulut lecet'],
    keywords: ['kumis', 'putung', 'patah', 'barbel', 'mulut lecet'],
    title: 'Kumis Putung / Luka Mulut',
    severity: 'warning',
    actions: [
      {
        title: 'Tindakan Air',
        steps: [
          'Kurangi kepadatan & hentikan overfeeding.',
          'Ganti air 20–30%; pastikan amonia/nitrit rendah.',
        ],
      },
      {
        title: 'Tindakan Pakan',
        steps: [
          'Gunakan pelet lunak / ukuran lebih kecil agar ikan tidak memaksa makan.',
          'Puasakan 12 jam jika ikan menolak pakan.',
        ],
      },
    ],
    saltDose: 'Garam krosok 3 ppt selama 3–5 hari.',
    medicineHint: 'Infeksi sekunder: Inrofloxs / obat bakteri sesuai label — konsultasi teknisi.',
    drugRules: [
      {
        drug: 'Garam krosok',
        ratePerLiter: 3,
        unit: 'g/L',
        notes: 'Perendaman ringan; hindari dosis tinggi pada benih.',
      },
      {
        drug: 'Inrofloxs (enrofloxacin)',
        ratePerLiter: 0.5,
        unit: 'mg/L',
        notes: 'Dosis umum lapangan — ikuti label resmi & resep teknisi. Puasakan saat perawatan.',
      },
    ],
  },
  {
    id: 'luka-borok',
    symptoms: ['Luka borok', 'Luka tubuh', 'Ulser', 'Sisik lepas', 'Infeksi bakteri'],
    keywords: ['luka', 'borok', 'sisik', 'merah', 'infeksi', 'ulcer', 'ulser'],
    title: 'Luka / Borok / Infeksi Bakteri',
    severity: 'warning',
    actions: [
      {
        title: 'Tindakan Air',
        steps: [
          'Isolasi ikan sakit berat jika memungkinkan.',
          'Ganti air 30% & kurangi kepadatan.',
        ],
      },
      {
        title: 'Tindakan Pakan',
        steps: [
          'Pakan berkualitas — hindari pakan basi.',
          'Kurangi dosis 20% selama pemulihan.',
        ],
      },
    ],
    saltDose: 'Garam krosok 5 ppt 3–5 hari.',
    medicineHint: 'PK (Potassium Permanganate) rendah untuk luka permukaan — catat di jurnal obat siklus.',
    drugRules: [
      {
        drug: 'PK (Kalium Permanganat)',
        ratePerLiter: 2,
        unit: 'mg/L',
        notes: 'Short bath 30–60 menit — air harus jernih, hentikan jika ikan stres berat.',
      },
      {
        drug: 'Garam krosok',
        ratePerLiter: 5,
        unit: 'g/L',
        maxSafePpt: 5,
      },
      {
        drug: 'Inrofloxs',
        ratePerLiter: 0.5,
        unit: 'mg/L',
        notes: 'Untuk infeksi bakteri sistemik — konsultasi teknisi budidaya.',
      },
    ],
  },
  {
    id: 'belly-up',
    symptoms: ['Belly up', 'Ikan telungkup', 'Ikan kembung', 'Perut membusung'],
    keywords: ['belly up', 'kembung', 'telungkup', 'perut'],
    title: 'Belly Up / Kembung',
    severity: 'warning',
    actions: [
      {
        title: 'Tindakan Air',
        steps: [
          'Kurangi pakan & cek overfeeding.',
          'Ganti air 20–30% — pastikan amonia/nitrit rendah.',
        ],
      },
      {
        title: 'Tindakan Pakan',
        steps: [
          'Puasakan 24 jam.',
          'Berikan pakan rendah protein / lebih kecil ukuran pellet.',
        ],
      },
    ],
    saltDose: 'Garam krosok 2–3 ppt short bath 30 menit untuk ikan terdampak ringan.',
    medicineHint: 'Antibiotik hanya jika infeksi bakterial terkonfirmasi — konsultasi teknisi/aquaculture.',
    drugRules: [
      {
        drug: 'Garam krosok',
        ratePerLiter: 2,
        unit: 'g/L',
        notes: 'Short bath — bukan kolam penuh jika ikan lemah.',
      },
    ],
  },
];

export function searchTrouble(query: string): TroubleEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return TROUBLE_LIBRARY;
  return TROUBLE_LIBRARY.filter((e) => {
    if (e.title.toLowerCase().includes(q)) return true;
    if (e.symptoms.some((s) => s.toLowerCase().includes(q))) return true;
    return e.keywords.some((k) => k.includes(q) || q.includes(k));
  });
}

export function computeDrugDose(rule: DrugDosageRule, volumeLiter: number): string | null {
  if (!Number.isFinite(volumeLiter) || volumeLiter <= 0) return null;
  if (rule.unit === 'g/L' || rule.unit === 'ppt') {
    const grams = Math.round(rule.ratePerLiter * volumeLiter * 10) / 10;
    const ppt = rule.ratePerLiter;
    if (rule.maxSafePpt != null && ppt > rule.maxSafePpt) {
      return `⚠ Melebihi batas aman ${rule.maxSafePpt} ppt — kurangi dosis.`;
    }
    return `${grams.toLocaleString('id-ID')} g ${rule.drug} (${ppt} g/L × ${volumeLiter.toLocaleString('id-ID')} L)`;
  }
  if (rule.unit === 'mg/L') {
    const mg = Math.round(rule.ratePerLiter * volumeLiter * 10) / 10;
    return `${mg.toLocaleString('id-ID')} mg ${rule.drug} (${rule.ratePerLiter} mg/L × ${volumeLiter.toLocaleString('id-ID')} L)`;
  }
  if (rule.unit === 'ml/L') {
    const ml = Math.round(rule.ratePerLiter * volumeLiter * 10) / 10;
    return `${ml.toLocaleString('id-ID')} ml ${rule.drug} (${rule.ratePerLiter} ml/L × ${volumeLiter.toLocaleString('id-ID')} L)`;
  }
  return null;
}

export function volumeLiterFromPond(pond: { volumeM3?: number | string | null; volumeLiter?: number | string | null }): number | null {
  const vl = pond.volumeLiter != null ? Number(pond.volumeLiter) : null;
  if (vl != null && Number.isFinite(vl) && vl > 0) return vl;
  const vm3 = pond.volumeM3 != null ? Number(pond.volumeM3) : null;
  if (vm3 != null && Number.isFinite(vm3) && vm3 > 0) return Math.round(vm3 * 1000);
  return null;
}

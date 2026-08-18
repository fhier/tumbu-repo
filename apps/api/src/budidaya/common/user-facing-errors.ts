/**
 * Pesan error budidaya ramah pengguna — dipakai exception filter & service layer.
 */

const FIELD_LABELS: Record<string, string> = {
  feedTypeId: 'Jenis pakan',
  quantityKg: 'Jumlah pakan (kg)',
  quantityPcs: 'Jumlah ekor',
  deadCountPcs: 'Jumlah kematian (ekor)',
  averageWeightGram: 'Berat rata-rata (g)',
  eventAt: 'Waktu kejadian',
  productName: 'Nama produk panen',
  categoryId: 'Kategori biaya',
  amount: 'Nominal',
  description: 'Keterangan',
  pondId: 'Kolam',
  speciesProfileId: 'Jenis ikan',
  metricCode: 'Indikator',
  greenBound: 'Batas hijau',
  yellowBound: 'Batas kuning',
  costClass: 'Klasifikasi biaya',
  costNature: 'Sifat biaya',
};

/** Pesan exact-match atau pola → terjemahan bisnis */
const EXACT: Record<string, string> = {
  'feedTypeId wajib.': 'Jenis pakan wajib dipilih.',
  'quantityKg harus > 0.': 'Jumlah pakan harus lebih dari 0 kg.',
  'quantityPcs harus > 0.': 'Jumlah ekor harus lebih dari 0.',
  'deadCountPcs harus > 0.': 'Jumlah kematian harus lebih dari 0 ekor.',
  'averageWeightGram harus > 0.': 'Berat rata-rata harus lebih dari 0 gram.',
  'eventAt tidak valid.': 'Waktu kejadian tidak valid.',
  'productName wajib.': 'Nama produk panen wajib diisi.',
  'categoryId wajib.': 'Kategori biaya wajib dipilih.',
  'amount harus > 0.': 'Nominal harus lebih dari 0.',
  'description wajib.': 'Keterangan wajib diisi.',
  'Event sudah VOIDED.': 'Catatan sudah dibatalkan sebelumnya.',
  'Tidak dapat void event pada siklus terminal.': 'Tidak bisa membatalkan catatan pada siklus yang sudah selesai.',
  'Panen mensyaratkan StockingEvent RECORDED.': 'Panen hanya bisa dicatat setelah tebar benih tercatat.',
  'Tutup siklus mensyaratkan StockingEvent RECORDED.': 'Tutup siklus hanya bisa setelah tebar benih tercatat.',
  'Siklus sudah memiliki CycleCloseEvent.': 'Siklus sudah pernah ditutup.',
  'Nilai numerik tidak valid.': 'Angka yang dimasukkan tidak valid.',
  'Nilai bilangan tidak valid.': 'Angka yang dimasukkan tidak valid.',
  'costClass harus DIRECT atau INDIRECT.': 'Klasifikasi biaya harus Langsung atau Tidak langsung.',
  'costNature harus VARIABLE atau FIXED.': 'Sifat biaya harus Variabel atau Tetap.',
  'direction harus LOWER_BETTER atau HIGHER_BETTER.': 'Arah indikator tidak valid.',
  'greenBound dan yellowBound wajib.': 'Batas warna indikator wajib diisi.',
  'greenBound wajib.': 'Batas hijau wajib diisi.',
  'yellowBound wajib.': 'Batas kuning wajib diisi.',
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(\w+) wajib\.$/, (m) => `${FIELD_LABELS[m[1]] || m[1]} wajib diisi.`],
  [/^(\w+) harus > 0\.$/, (m) => `${FIELD_LABELS[m[1]] || m[1]} harus lebih dari 0.`],
  [
    /^Transisi (\w+) → (\w+) dengan pemicu (\w+) tidak diizinkan \(WORKFLOW\)\.$/,
    () => 'Perubahan status siklus tidak diizinkan untuk kondisi saat ini.',
  ],
  [
    /^State siklus tidak dikenal: (.+)$/,
    () => 'Status siklus tidak dikenali.',
  ],
  [
    /^Kolam masih dipakai siklus (.+) \(([A-Z_]+)\)\.$/,
    (m) => `Kolam masih dipakai siklus ${m[1]}. Selesaikan atau tutup siklus tersebut dulu.`,
  ],
];

export function humanizeBudidayaError(raw: string | string[] | undefined): string {
  const msg = Array.isArray(raw) ? raw[0] : String(raw || '');
  if (!msg) return 'Permintaan tidak valid.';
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg
    .replace(/StockingEvent/g, 'catatan tebar')
    .replace(/FeedEvent/g, 'catatan pakan')
    .replace(/MortalityEvent/g, 'catatan kematian')
    .replace(/HarvestEvent/g, 'catatan panen')
    .replace(/CycleCloseEvent/g, 'penutupan siklus')
    .replace(/VOIDED/g, 'dibatalkan')
    .replace(/RECORDED/g, 'tercatat')
    .replace(/WORKFLOW/g, 'alur bisnis');
}

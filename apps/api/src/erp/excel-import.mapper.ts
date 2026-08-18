import * as ExcelJS from 'exceljs';
import type {
  EntityDef,
  EntityKind,
  EntityMapping,
  ExcelImportMapping,
  ImportMode,
  ParsedExcel,
  SheetInfo,
} from './excel-import.types';

export const ENTITY_CATALOG: EntityDef[] = [
  {
    kind: 'suppliers',
    label: 'Supplier',
    modes: ['master', 'master_plus_open', 'full_history'],
    fields: [
      { key: 'name', label: 'Nama', required: true },
      { key: 'phone', label: 'Telepon' },
      { key: 'address', label: 'Alamat' },
    ],
  },
  {
    kind: 'customers',
    label: 'Pelanggan',
    modes: ['master', 'master_plus_open', 'full_history'],
    fields: [
      { key: 'name', label: 'Nama', required: true },
      { key: 'phone', label: 'Telepon' },
      { key: 'address', label: 'Alamat' },
    ],
  },
  {
    kind: 'sizes',
    label: 'Ukuran',
    modes: ['master', 'master_plus_open', 'full_history'],
    fields: [
      { key: 'label', label: 'Label ukuran', required: true },
      { key: 'sortOrder', label: 'Urutan' },
    ],
  },
  {
    kind: 'products',
    label: 'Produk / Stok',
    modes: ['master', 'master_plus_open', 'full_history'],
    fields: [
      { key: 'name', label: 'Nama produk', required: true },
      { key: 'unit', label: 'Satuan' },
      { key: 'stock', label: 'Stok' },
      { key: 'minStock', label: 'Stok minimum' },
      { key: 'price', label: 'Harga' },
      { key: 'sizeLabel', label: 'Ukuran' },
    ],
  },
  {
    kind: 'purchases',
    label: 'Pembelian',
    modes: ['full_history'],
    fields: [
      { key: 'number', label: 'No dokumen' },
      { key: 'date', label: 'Tanggal', required: true },
      { key: 'partner', label: 'Supplier', required: true },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Keterangan' },
      { key: 'sizeLabel', label: 'Ukuran' },
      { key: 'quantity', label: 'Qty / Total Ekor' },
      { key: 'price', label: 'Harga/Ekor' },
      { key: 'total', label: 'Nominal Bayar (net) / Total' },
      { key: 'weight', label: 'Berat' },
      { key: 'sampling', label: 'Sampling' },
      { key: 'paidAmount', label: 'Nominal DP' },
      { key: 'plasePercent', label: 'Plase %' },
      { key: 'plaseAmount', label: 'Plase / Total potongan' },
    ],
  },
  {
    kind: 'sales',
    label: 'Penjualan',
    modes: ['full_history'],
    fields: [
      { key: 'number', label: 'No dokumen' },
      { key: 'date', label: 'Tanggal', required: true },
      { key: 'partner', label: 'Pelanggan', required: true },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Keterangan' },
      { key: 'sizeLabel', label: 'Ukuran' },
      { key: 'quantity', label: 'Qty / Total Ekor' },
      { key: 'price', label: 'Harga/Ekor' },
      { key: 'total', label: 'Total nominal transaksi' },
      { key: 'weight', label: 'Berat' },
      { key: 'sampling', label: 'Sampling' },
      { key: 'paidAmount', label: 'Nominal DP' },
    ],
  },
  {
    kind: 'expenses',
    label: 'Pengeluaran',
    modes: ['full_history', 'master_plus_open'],
    fields: [
      { key: 'date', label: 'Tanggal', required: true },
      { key: 'category', label: 'Kategori', required: true },
      { key: 'description', label: 'Keterangan' },
      { key: 'amount', label: 'Nominal', required: true },
      { key: 'account', label: 'Kas/Bank' },
    ],
  },
  {
    kind: 'cash',
    label: 'Kas / Bank',
    modes: ['full_history', 'master_plus_open'],
    fields: [
      { key: 'date', label: 'Tanggal', required: true },
      { key: 'category', label: 'Kategori' },
      { key: 'description', label: 'Keterangan', required: true },
      { key: 'amount', label: 'Nominal', required: true },
      { key: 'direction', label: 'Arah / Tipe (Masuk/Keluar)' },
      { key: 'account', label: 'Kas/Bank' },
    ],
  },
  {
    kind: 'beritaAcara',
    label: 'Berita Acara',
    modes: ['full_history'],
    fields: [
      { key: 'number', label: 'No BA' },
      { key: 'date', label: 'Tanggal', required: true },
      { key: 'supplier', label: 'Supplier', required: true },
      { key: 'sizeLabel', label: 'Ukuran' },
      { key: 'quantity', label: 'Qty' },
      { key: 'vehicle', label: 'Kendaraan' },
      { key: 'notes', label: 'Keterangan' },
    ],
  },
  {
    kind: 'suratJalan',
    label: 'Surat Jalan',
    modes: ['full_history'],
    fields: [
      { key: 'number', label: 'No SJ' },
      { key: 'date', label: 'Tanggal Berangkat', required: true },
      { key: 'partner', label: 'Pelanggan', required: true },
      { key: 'saleRef', label: 'No Penjualan' },
      { key: 'destination', label: 'Tujuan / Alamat' },
      { key: 'vehicle', label: 'Kendaraan' },
      { key: 'driver', label: 'Nama Sopir' },
      { key: 'notes', label: 'Keterangan' },
    ],
  },
  {
    kind: 'openBalances',
    label: 'Saldo / Hutang / Piutang terbuka',
    modes: ['master_plus_open'],
    fields: [
      { key: 'kind', label: 'Jenis (HUTANG/PIUTANG/KAS)', required: true },
      { key: 'partner', label: 'Mitra' },
      { key: 'amount', label: 'Nominal', required: true },
      { key: 'date', label: 'Tanggal' },
      { key: 'notes', label: 'Keterangan' },
    ],
  },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name: ['nama', 'name'],
  phone: ['telepon', 'telp', 'phone', 'hp', 'no hp', 'no. hp', 'whatsapp', 'wa'],
  address: ['alamat', 'address'],
  label: ['ukuran', 'label', 'nama ukuran'],
  sortOrder: ['urutan', 'sort order'],
  unit: ['satuan', 'unit'],
  stock: ['stok', 'stock', 'qty stok', 'jumlah stok'],
  minStock: ['stok min', 'min stock', 'minimum'],
  price: ['harga/ekor', 'harga ekor', 'harga satuan', 'harga'],
  sizeLabel: ['ukuran'],
  number: ['no transaksi', 'no ba', 'no dokumen', 'no. dokumen', 'no po', 'no sj', 'nomor', 'no'],
  date: ['tanggal', 'date', 'tgl', 'tanggal berangkat'],
  partner: ['supplier', 'pelanggan', 'customer', 'buyer', 'nama supplier', 'nama pelanggan'],
  status: ['status'],
  notes: ['keterangan', 'catatan', 'notes', 'note'],
  quantity: ['total ekor', 'qty ekor', 'qty', 'quantity', 'ekor', 'jumlah ekor'],
  saleRef: ['no penjualan', 'no pj', 'referensi penjualan', 'no transaksi penjualan'],
  destination: ['tujuan', 'alamat pelanggan', 'alamat tujuan', 'alamat'],
  driver: ['nama sopir', 'sopir', 'driver'],
  bagCount: ['jumlah kantong', 'kantong', 'bag'],
  binNote: ['bak', 'bak/keterangan', 'lokasi'],
  total: [
    'nominal bayar', 'total pembelian', 'total penjualan', 'total tagihan', 'nominal tagihan',
    'subtotal', 'total nominal', 'total',
  ],
  weight: ['berat (kg)', 'berat', 'weight'],
  sampling: ['sampling', 'sample'],
  paidAmount: ['nominal dp', 'uang muka', 'dp', 'dibayar', 'nominal bayar'],
  plasePercent: ['plase %', 'plase%', 'persen plase', '% plase'],
  plaseAmount: ['total potongan', 'plase nominal', 'nominal plase', 'potongan'],
  category: ['kategori'],
  description: ['keterangan', 'deskripsi', 'uraian', 'description'],
  amount: ['nominal'],
  direction: ['tipe', 'arah', 'direction', 'masuk/keluar'],
  account: ['metode', 'akun', 'via', 'kas/bank', 'account'],
  supplier: ['supplier', 'pemasok', 'nama supplier'],
  vehicle: ['kendaraan', 'plat', 'nopol', 'vehicle'],
  kind: ['jenis', 'kind', 'hutang/piutang'],
};

/** Headers that must not be used for a given field (false-positive guards). */
const FIELD_EXCLUDE: Record<string, string[]> = {
  quantity: ['jumlah ukuran', 'no urut', 'urutan'],
  price: ['potongan harga'],
  amount: ['saldo'],
  total: ['total ekor', 'total potongan', 'total dibayar', 'total hutang', 'total piutang', 'total awal', 'total aktual'],
  number: ['no urut', 'nominal', 'no hp'],
  partner: ['nama bank'],
  category: ['jenis flase'],
  direction: ['timestamp'],
};

function normHeader(h: string) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[._]+/g, ' ');
}

function cellToString(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const any = v as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (any.text) return String(any.text).trim();
    if (any.result != null) return String(any.result).trim();
    if (Array.isArray(any.richText)) return any.richText.map((t) => t.text).join('').trim();
  }
  return String(v).trim();
}

export function emptyMapping(mode: ImportMode = 'master'): ExcelImportMapping {
  return {
    mode,
    preset: null,
    entities: ENTITY_CATALOG.filter((e) => e.modes.includes(mode)).map((e) => ({
      kind: e.kind,
      sheetName: null,
      columns: Object.fromEntries(e.fields.map((f) => [f.key, null])),
      groupBy: ['purchases', 'sales', 'beritaAcara', 'suratJalan'].includes(e.kind) ? 'number' : null,
    })),
  };
}

function matchHeader(headers: string[], fieldKey: string): string | null {
  const aliases = FIELD_ALIASES[fieldKey] || [fieldKey];
  const excluded = (FIELD_EXCLUDE[fieldKey] || []).map(normHeader);
  const normalized = headers.map((h) => ({ raw: h, n: normHeader(h) }))
    .filter((h) => !excluded.some((ex) => h.n === ex || h.n.includes(ex)));

  // 1) exact alias match
  for (const alias of aliases) {
    const hit = normalized.find((h) => h.n === alias);
    if (hit) return hit.raw;
  }
  // 2) starts-with / contains (longer aliases first)
  const sorted = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of sorted) {
    const hit = normalized.find((h) => h.n.startsWith(alias) || h.n.includes(alias));
    if (hit) return hit.raw;
  }
  return null;
}

function findSheet(sheets: SheetInfo[], candidates: string[]): SheetInfo | undefined {
  const lower = candidates.map((c) => c.toLowerCase());
  return sheets.find((s) => lower.includes(s.name.trim().toLowerCase()));
}

/** MAT ERP / MAT Lite sheet naming shortcut — not required for import. */
export function detectMatErpPreset(sheets: SheetInfo[]): ExcelImportMapping | null {
  const has = (n: string) => sheets.some((s) => s.name.trim().toLowerCase() === n.toLowerCase());
  if (!(has('Supplier') || has('Pelanggan') || has('Ukuran') || has('Pembelian') || has('Penjualan'))) {
    return null;
  }

  const mapping = emptyMapping('full_history');
  mapping.preset = 'mat_erp';

  const apply = (kind: EntityKind, sheetName: string | null) => {
    const ent = mapping.entities.find((e) => e.kind === kind);
    if (!ent || !sheetName) return;
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) return;
    ent.sheetName = sheetName;
    const def = ENTITY_CATALOG.find((d) => d.kind === kind)!;
    for (const f of def.fields) {
      ent.columns[f.key] = matchHeader(sheet.headers, f.key);
    }
    // MAT-specific overrides
    if (kind === 'suppliers' || kind === 'customers') {
      ent.columns.name = matchHeader(sheet.headers, 'name') || sheet.headers.find((h) => /nama/i.test(h)) || null;
    }
    if (kind === 'sizes') {
      ent.columns.label = matchHeader(sheet.headers, 'label') || sheet.headers.find((h) => /ukuran|nama/i.test(h)) || null;
    }
  };

  apply('suppliers', findSheet(sheets, ['Supplier', 'Suppliers'])?.name || null);
  apply('customers', findSheet(sheets, ['Pelanggan', 'Customer', 'Customers'])?.name || null);
  apply('sizes', findSheet(sheets, ['Ukuran', 'Size', 'Sizes'])?.name || null);
  apply('products', findSheet(sheets, ['Stok', 'Produk', 'Product', 'Products'])?.name || null);

  // Ringkasan transaksi (1 baris = 1 dokumen) — lebih andal daripada Detail tanpa join
  const buySummary = findSheet(sheets, ['Pembelian', 'Purchase', 'PO']);
  const saleSummary = findSheet(sheets, ['Penjualan', 'Sales', 'Sale']);
  apply('purchases', buySummary?.name || null);
  apply('sales', saleSummary?.name || null);

  // Kas = buku kas (saldo). Pengeluaran sheet = sumber P&L (bisa beda dari salinan di Kas).
  apply('cash', findSheet(sheets, ['Kas', 'Cash'])?.name || null);
  apply('expenses', findSheet(sheets, ['Pengeluaran', 'Expense', 'Expenses'])?.name || null);
  apply('beritaAcara', findSheet(sheets, ['Berita Acara', 'BA', 'BeritaAcara'])?.name || null);
  apply('suratJalan', findSheet(sheets, ['Surat Jalan', 'SuratJalan', 'SJ'])?.name || null);

  const force = (kind: EntityKind, cols: Record<string, string>) => {
    const ent = mapping.entities.find((e) => e.kind === kind);
    const sheet = ent?.sheetName ? sheets.find((s) => s.name === ent.sheetName) : null;
    if (!ent || !sheet) return;
    for (const [k, want] of Object.entries(cols)) {
      const hit = sheet.headers.find((h) => normHeader(h) === normHeader(want))
        || sheet.headers.find((h) => normHeader(h).includes(normHeader(want)));
      if (hit) ent.columns[k] = hit;
    }
  };

  force('suppliers', { name: 'Nama Supplier', phone: 'No HP', address: 'Alamat' });
  force('customers', { name: 'Nama Pelanggan', phone: 'No HP', address: 'Alamat' });
  // Sheet Ukuran: header tunggal "Ukuran"
  force('sizes', { label: 'Ukuran' });
  if (!mapping.entities.find((e) => e.kind === 'sizes')?.columns.label) {
    const ent = mapping.entities.find((e) => e.kind === 'sizes');
    const sheet = ent?.sheetName ? sheets.find((s) => s.name === ent.sheetName) : null;
    if (ent && sheet?.headers[0]) ent.columns.label = sheet.headers[0];
  }
  // Sheet Stok: Ukuran | Stok Masuk | Stok Keluar | Stok Akhir (bukan nama produk)
  force('products', {
    name: 'Ukuran',
    sizeLabel: 'Ukuran',
    stock: 'Stok Akhir',
  });
  const prod = mapping.entities.find((e) => e.kind === 'products');
  if (prod) {
    prod.columns.unit = null; // default ekor di commit
    if (!prod.columns.name && prod.sheetName) {
      const sh = sheets.find((s) => s.name === prod.sheetName);
      if (sh?.headers[0]) prod.columns.name = sh.headers[0];
    }
  }

  force('purchases', {
    number: 'No Transaksi', date: 'Tanggal', partner: 'Supplier',
    quantity: 'Total Ekor', total: 'Nominal Bayar', paidAmount: 'Nominal DP',
    plaseAmount: 'Total Potongan', status: 'Status', notes: 'Keterangan',
  });
  force('sales', {
    number: 'No Transaksi', date: 'Tanggal', partner: 'Pelanggan',
    quantity: 'Total Ekor', total: 'Total Penjualan', paidAmount: 'Nominal DP',
    status: 'Status', notes: 'Keterangan',
  });
  force('cash', {
    number: 'No Transaksi', date: 'Tanggal', direction: 'Tipe',
    category: 'Kategori', amount: 'Nominal', description: 'Keterangan',
  });
  force('expenses', {
    date: 'Tanggal', category: 'Kategori', amount: 'Nominal',
    description: 'Keterangan', account: 'Metode',
  });
  force('beritaAcara', {
    number: 'No BA', date: 'Tanggal Tiba', supplier: 'Supplier',
    notes: 'Keterangan', vehicle: 'Kendaraan',
  });
  force('suratJalan', {
    number: 'No SJ', date: 'Tanggal Berangkat', partner: 'Pelanggan',
    saleRef: 'No Penjualan', destination: 'Tujuan', vehicle: 'Kendaraan', driver: 'Nama Sopir',
  });

  return mapping;
}

function suggestGenericMapping(sheets: SheetInfo[], mode: ImportMode): ExcelImportMapping {
  const mapping = emptyMapping(mode);
  for (const ent of mapping.entities) {
    const def = ENTITY_CATALOG.find((d) => d.kind === ent.kind)!;
    // Score sheets by how many required/alias headers match
    let best: { sheet: SheetInfo; score: number } | null = null;
    for (const sheet of sheets) {
      let score = 0;
      for (const f of def.fields) {
        if (matchHeader(sheet.headers, f.key)) score += f.required ? 3 : 1;
      }
      // name boost for sheet title
      const titleHints: Record<string, string[]> = {
        suppliers: ['supplier', 'pemasok'],
        customers: ['pelanggan', 'customer', 'customer'],
        sizes: ['ukuran', 'size'],
        products: ['produk', 'stok', 'product', 'barang'],
        purchases: ['pembelian', 'purchase', 'po'],
        sales: ['penjualan', 'sales', 'sale'],
        expenses: ['pengeluaran', 'expense', 'biaya'],
        cash: ['kas', 'bank', 'cash'],
        beritaAcara: ['berita', 'ba'],
        suratJalan: ['surat jalan', 'suratjalan', 'sj'],
        openBalances: ['saldo', 'hutang', 'piutang', 'balance'],
      };
      const hints = titleHints[ent.kind] || [];
      if (hints.some((h) => sheet.name.toLowerCase().includes(h))) score += 5;
      if (!best || score > best.score) best = { sheet, score };
    }
    if (best && best.score >= 2) {
      ent.sheetName = best.sheet.name;
      for (const f of def.fields) {
        ent.columns[f.key] = matchHeader(best.sheet.headers, f.key);
      }
    }
  }
  return mapping;
}

export async function parseExcelBuffer(buffer: Buffer): Promise<ParsedExcel> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings expect Buffer-like; Node Buffer is fine at runtime
  await wb.xlsx.load(buffer as never);

  const sheets: SheetInfo[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals[colNumber - 1] = cellToString(cell.value);
      });
      // trim trailing empties
      while (vals.length && !vals[vals.length - 1]) vals.pop();
      if (vals.some((v) => v)) rows.push(vals.map((v) => v ?? ''));
      void rowNumber;
    });
    if (!rows.length) {
      sheets.push({ name: ws.name, headers: [], sampleRows: [], rowCount: 0 });
      return;
    }
    const headers = rows[0].map((h, i) => h || `Kolom ${i + 1}`);
    const dataRows = rows.slice(1);
    sheets.push({
      name: ws.name,
      headers,
      sampleRows: dataRows.slice(0, 5).map((r) => {
        const padded = [...r];
        while (padded.length < headers.length) padded.push('');
        return padded.slice(0, headers.length);
      }),
      rowCount: dataRows.length,
    });
  });

  const mat = detectMatErpPreset(sheets);
  const suggestedMapping = mat || suggestGenericMapping(sheets, 'master');
  return {
    sheets,
    suggestedMapping,
    detectedPreset: mat?.preset || null,
  };
}

export function sheetRowsAsObjects(sheet: SheetInfo, allRows: string[][]): Record<string, string>[] {
  return allRows.map((r) => {
    const obj: Record<string, string> = {};
    sheet.headers.forEach((h, i) => {
      obj[h] = r[i] ?? '';
    });
    return obj;
  });
}

export async function loadAllSheetRows(buffer: Buffer): Promise<Map<string, { headers: string[]; rows: string[][] }>> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings expect Buffer-like; Node Buffer is fine at runtime
  await wb.xlsx.load(buffer as never);
  const map = new Map<string, { headers: string[]; rows: string[][] }>();
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        vals[colNumber - 1] = cellToString(cell.value);
      });
      while (vals.length && !vals[vals.length - 1]) vals.pop();
      if (vals.some((v) => v)) rows.push(vals.map((v) => v ?? ''));
    });
    if (!rows.length) {
      map.set(ws.name, { headers: [], rows: [] });
      return;
    }
    const headers = rows[0].map((h, i) => h || `Kolom ${i + 1}`);
    const dataRows = rows.slice(1).map((r) => {
      const padded = [...r];
      while (padded.length < headers.length) padded.push('');
      return padded.slice(0, headers.length);
    });
    map.set(ws.name, { headers, rows: dataRows });
  });
  return map;
}

export function getMappedValue(row: Record<string, string>, columns: Record<string, string | null>, key: string): string {
  const header = columns[key];
  if (!header) return '';
  return String(row[header] ?? '').trim();
}

export function parseNumberLoose(v: string): number {
  if (!v) return 0;
  const cleaned = String(v).replace(/Rp\s*/i, '').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseDateLoose(v: string): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  // Excel serial sometimes comes as number string
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + Number(s) * 86400000);
  }
  // Prioritas DD/MM/YYYY (format Indonesia) — jangan biarkan Date() baca sebagai MM/DD
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const dd = new Date(year, month, day, 12, 0, 0);
      if (!Number.isNaN(dd.getTime())) return dd;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

export function normalizeStatus(raw: string, type: 'PURCHASE' | 'SALE'): 'PAID' | 'DUE' | 'DP' {
  const s = raw.toLowerCase();
  if (/lunas|paid|bayar/.test(s) && !/hutang|piutang|dp|sebagian/.test(s)) return 'PAID';
  if (/dp|uang muka|sebagian/.test(s)) return 'DP';
  if (/hutang|piutang|due|belum/.test(s)) return 'DUE';
  return type === 'PURCHASE' || type === 'SALE' ? 'DUE' : 'DUE';
}

/** Samakan alias ukuran: "6 cm" / "6cm" / "Benih 6" → "6"; "5-6 cm" → "5-6". */
export function normalizeSizeKey(raw: string): string {
  let s = String(raw || '').trim().toLowerCase();
  s = s.replace(/^benih\s+/i, '').trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*cm$/i, '').trim();
  return s;
}

/** Pilih label kanonik: prioritas master Ukuran, lalu yang sudah ada " cm", lalu label mentah. */
export function preferSizeLabel(candidates: string[], sizeMaster: string[] = []): string {
  const cleaned = candidates.map((c) => String(c || '').trim()).filter(Boolean);
  if (!cleaned.length) return 'Umum';
  const keys = new Map(cleaned.map((c) => [normalizeSizeKey(c), c]));
  for (const m of sizeMaster) {
    const hit = keys.get(normalizeSizeKey(m));
    if (hit) return m.trim();
  }
  const withCm = cleaned.find((c) => /\s*cm$/i.test(c));
  if (withCm) return withCm;
  return cleaned[0];
}

/** Cari celah nomor dokumen bertipe PREFIX-YYMMDD-SEQ. */
export function findDocumentNumberGaps(numbers: string[]): string[] {
  const byPrefix = new Map<string, number[]>();
  for (const raw of numbers) {
    const m = String(raw || '').trim().match(/^([A-Za-z]+)-(\d{6})-(\d+)$/);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}`;
    const seq = Number(m[3]);
    if (!Number.isFinite(seq)) continue;
    const list = byPrefix.get(key) || [];
    list.push(seq);
    byPrefix.set(key, list);
  }
  const gaps: string[] = [];
  for (const [key, seqs] of byPrefix) {
    const uniq = [...new Set(seqs)].sort((a, b) => a - b);
    if (uniq.length < 2) continue;
    const pad = String(Math.max(...uniq)).length;
    for (let n = uniq[0]; n <= uniq[uniq.length - 1]; n++) {
      if (!uniq.includes(n)) {
        gaps.push(`${key}-${String(n).padStart(pad, '0')}`);
      }
    }
  }
  return gaps;
}

export function entitiesForMode(mode: ImportMode): EntityKind[] {
  return ENTITY_CATALOG.filter((e) => e.modes.includes(mode)).map((e) => e.kind);
}

// @ts-nocheck
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from './tenant.context';
import {
  ENTITY_CATALOG,
  entitiesForMode,
  getMappedValue,
  loadAllSheetRows,
  parseDateLoose,
  parseExcelBuffer,
  parseNumberLoose,
  normalizeStatus,
  normalizeSizeKey,
  preferSizeLabel,
  findDocumentNumberGaps,
} from './excel-import.mapper';
import type {
  CommitResult,
  EntityKind,
  EntityMapping,
  ExcelImportMapping,
  ImportMode,
  PreviewRowIssue,
  PreviewSummary,
} from './excel-import.types';

type DecodedPayload = {
  buffer: Buffer;
  mapping: ExcelImportMapping;
  mode: ImportMode;
};

@Injectable()
export class ExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tenantId;
  }

  catalog() {
    return {
      entities: ENTITY_CATALOG,
      modes: [
        { id: 'master', label: 'Master saja', description: 'Supplier, pelanggan, ukuran, produk' },
        { id: 'master_plus_open', label: 'Master + saldo terbuka', description: 'Master plus hutang/piutang/kas awal' },
        { id: 'full_history', label: 'Full histori', description: 'Master + pembelian, penjualan, kas, BA' },
      ],
    };
  }

  private decodeBase64File(fileBase64?: string, fileName?: string): Buffer {
    if (!fileBase64) throw new BadRequestException('File Excel wajib diunggah.');
    const raw = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
    let buf: Buffer;
    try {
      buf = Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('File base64 tidak valid.');
    }
    if (!buf.length) throw new BadRequestException('File kosong.');
    if (buf.length > 15 * 1024 * 1024) throw new BadRequestException('File terlalu besar (maks 15 MB).');
    const name = String(fileName || '').toLowerCase();
    if (name && !/\.(xlsx|xlsm)$/.test(name)) {
      throw new BadRequestException('Format harus .xlsx');
    }
    return buf;
  }

  private normalizeMapping(input: Partial<ExcelImportMapping> = {}, mode?: ImportMode): ExcelImportMapping {
    const m: ImportMode = (mode || input.mode || 'master') as ImportMode;
    if (!['master', 'master_plus_open', 'full_history'].includes(m)) {
      throw new BadRequestException('Mode impor tidak valid.');
    }
    const allowed = new Set(entitiesForMode(m));
    const entities = (input.entities || [])
      .filter((e) => allowed.has(e.kind))
      .map((e) => ({
        kind: e.kind,
        sheetName: e.sheetName || null,
        columns: e.columns || {},
        groupBy: e.groupBy ?? null,
      }));
    return { mode: m, preset: input.preset || null, entities };
  }

  async parse(input: { fileBase64?: string; fileName?: string } = {}) {
    const buffer = this.decodeBase64File(input.fileBase64, input.fileName);
    const parsed = await parseExcelBuffer(buffer);
    return {
      ...parsed,
      catalog: this.catalog(),
      fileMeta: { name: input.fileName || 'upload.xlsx', bytes: buffer.length },
    };
  }

  private async prepare(input: {
    fileBase64?: string;
    fileName?: string;
    mapping?: ExcelImportMapping;
    mode?: ImportMode;
  }): Promise<DecodedPayload & { sheets: Map<string, { headers: string[]; rows: string[][] }> }> {
    const buffer = this.decodeBase64File(input.fileBase64, input.fileName);
    const mapping = this.normalizeMapping(input.mapping || {}, input.mode);
    const sheets = await loadAllSheetRows(buffer);
    return { buffer, mapping, mode: mapping.mode, sheets };
  }

  private entityMap(mapping: ExcelImportMapping, kind: EntityKind): EntityMapping | undefined {
    return mapping.entities.find((e) => e.kind === kind && e.sheetName);
  }

  private rowsFor(sheets: Map<string, { headers: string[]; rows: string[][] }>, ent: EntityMapping) {
    if (!ent.sheetName) return [] as Record<string, string>[];
    const sheet = sheets.get(ent.sheetName);
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const obj: Record<string, string> = {};
      sheet.headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
  }

  async preview(input: {
    fileBase64?: string;
    fileName?: string;
    mapping?: ExcelImportMapping;
    mode?: ImportMode;
  } = {}): Promise<PreviewSummary> {
    const { mapping, mode, sheets } = await this.prepare(input);
    const issues: PreviewRowIssue[] = [];
    const warnings: string[] = [];
    const counts: PreviewSummary['counts'] = {};

    const cashMapped = Boolean(this.entityMap(mapping, 'cash')?.sheetName);
    const expensesMapped = Boolean(this.entityMap(mapping, 'expenses')?.sheetName);
    if (cashMapped && expensesMapped) {
      warnings.push('Kas + Pengeluaran dipetakan. Pengeluaran masuk buku P&L (account PNL) agar tidak dobel di saldo kas — selaras MAT ERP.');
    }

    const bump = (kind: string, key: 'ok' | 'skip' | 'error') => {
      if (!counts[kind]) counts[kind] = { ok: 0, skip: 0, error: 0 };
      counts[kind][key]++;
    };

    for (const kind of entitiesForMode(mode)) {
      const ent = this.entityMap(mapping, kind);
      if (!ent) {
        if (['suppliers', 'customers', 'sizes', 'products'].includes(kind) && mode === 'master') {
          warnings.push(`${kind}: belum dipetakan — dilewati.`);
        }
        continue;
      }
      const def = ENTITY_CATALOG.find((d) => d.kind === kind)!;
      const required = def.fields.filter((f) => f.required).map((f) => f.key);
      const missingReq = required.filter((k) => !ent.columns[k]);
      if (missingReq.length) {
        warnings.push(`${def.label}: kolom wajib belum dipetakan (${missingReq.join(', ')}).`);
      }

      const rows = this.rowsFor(sheets, ent);
      if (kind === 'purchases' || kind === 'sales') {
        const groups = this.groupTxRows(rows, ent, 'partner');
        let sumNominal = 0;
        let okDocs = 0;
        for (const g of groups) {
          if (g.error) {
            bump(kind, 'error');
            issues.push({ entity: kind, row: g.row, message: g.error });
          } else {
            bump(kind, 'ok');
            okDocs++;
            const first = g.items[0];
            const t = parseNumberLoose(getMappedValue(first, ent.columns, 'total'))
              || parseNumberLoose(String(first['Nominal Bayar'] || first['Total Pembelian'] || first['Total Penjualan'] || ''));
            sumNominal += t;
          }
        }
        const label = kind === 'purchases' ? 'Pembelian' : 'Penjualan';
        warnings.push(
          `${label} di file: ${okDocs} dokumen valid, total kolom terpetakan ≈ Rp ${Math.round(sumNominal).toLocaleString('id-ID')}`
          + (issues.filter((i) => i.entity === kind).length
            ? ` · ${issues.filter((i) => i.entity === kind).length} baris gagal/dilewati (lihat detail).`
            : ''),
        );
        const nums = groups.map((g) => getMappedValue(g.items[0], ent.columns, 'number')).filter(Boolean);
        const gaps = findDocumentNumberGaps(nums);
        if (gaps.length) {
          warnings.push(
            `${label}: celah nomor di file (${gaps.length}): ${gaps.slice(0, 12).join(', ')}${gaps.length > 12 ? '…' : ''}. `
            + 'Cek apakah dibatalkan di MAT atau gagal diekspor.',
          );
        }
        continue;
      }
      if (kind === 'suratJalan') {
        rows.forEach((row, idx) => {
          const partner = getMappedValue(row, ent.columns, 'partner');
          if (!partner) {
            bump(kind, 'error');
            issues.push({ entity: kind, row: idx + 2, message: 'Pelanggan kosong' });
          } else bump(kind, 'ok');
        });
        continue;
      }
      if (kind === 'beritaAcara') {
        rows.forEach((row, idx) => {
          const supplier = getMappedValue(row, ent.columns, 'supplier') || getMappedValue(row, ent.columns, 'partner');
          if (!supplier) {
            bump(kind, 'error');
            issues.push({ entity: kind, row: idx + 2, message: 'Supplier kosong' });
          } else bump(kind, 'ok');
        });
        continue;
      }

      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        for (const k of required) {
          if (!getMappedValue(row, ent.columns, k)) {
            bump(kind, 'error');
            issues.push({ entity: kind, row: rowNum, message: `Kolom wajib kosong: ${k}` });
            return;
          }
        }
        if (kind === 'expenses' || kind === 'cash' || kind === 'openBalances') {
          const amount = parseNumberLoose(getMappedValue(row, ent.columns, 'amount'));
          if (amount <= 0) {
            bump(kind, 'error');
            issues.push({ entity: kind, row: rowNum, message: 'Nominal harus > 0' });
            return;
          }
        }
        bump(kind, 'ok');
      });
    }

    return { mode, counts, issues: issues.slice(0, 80), warnings };
  }

  private groupTxRows(
    rows: Record<string, string>[],
    ent: EntityMapping,
    partnerKey: 'partner' | 'supplier',
  ): Array<{ row: number; error?: string; key: string; items: Record<string, string>[] }> {
    const map = new Map<string, { row: number; items: Record<string, string>[] }>();
    const out: Array<{ row: number; error?: string; key: string; items: Record<string, string>[] }> = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const number = getMappedValue(row, ent.columns, 'number');
      const date = getMappedValue(row, ent.columns, 'date');
      const partner = getMappedValue(row, ent.columns, partnerKey === 'supplier' ? 'supplier' : 'partner')
        || getMappedValue(row, ent.columns, 'partner')
        || getMappedValue(row, ent.columns, 'supplier');
      const qty = parseNumberLoose(getMappedValue(row, ent.columns, 'quantity'));
      const total = parseNumberLoose(getMappedValue(row, ent.columns, 'total'));
      const price = parseNumberLoose(getMappedValue(row, ent.columns, 'price'));

      // Detail lines: only No Transaksi + ukuran/qty — allow without date/partner
      if (number && !date && !partner) {
        if (qty <= 0 && total <= 0 && price <= 0) {
          out.push({ row: rowNum, key: `err-${rowNum}`, error: 'Baris detail tanpa qty/harga', items: [] });
          return;
        }
        const existing = map.get(number);
        if (existing) existing.items.push(row);
        else map.set(number, { row: rowNum, items: [row] });
        return;
      }

      if (!date || !partner) {
        out.push({ row: rowNum, key: `err-${rowNum}`, error: 'Tanggal/partner wajib', items: [] });
        return;
      }
      // Summary rows may have Total without per-line price
      if (qty <= 0 && total <= 0) {
        out.push({ row: rowNum, key: `err-${rowNum}`, error: 'Qty/Total harus > 0', items: [] });
        return;
      }
      const key = number || `${date}||${partner}`;
      const existing = map.get(key);
      if (existing) existing.items.push(row);
      else map.set(key, { row: rowNum, items: [row] });
    });

    for (const [key, g] of map) {
      out.push({ row: g.row, key, items: g.items });
    }
    return out;
  }

  async commit(input: {
    fileBase64?: string;
    fileName?: string;
    mapping?: ExcelImportMapping;
    mode?: ImportMode;
    confirmWorkspaceCode?: string;
  } = {}): Promise<CommitResult> {
    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    if (input.confirmWorkspaceCode && input.confirmWorkspaceCode !== t.code) {
      throw new BadRequestException(`Kode workspace tidak cocok. Aktif: ${t.code}`);
    }

    const { mapping, mode, sheets } = await this.prepare(input);
    const added: Record<string, number> = {};
    const skipped: Record<string, number> = {};
    const errors: PreviewRowIssue[] = [];
    const warnings: string[] = [];
    const bump = (k: string, bag: Record<string, number>, n = 1) => { bag[k] = (bag[k] || 0) + n; };

    // --- Master ---
    const sizesEnt = this.entityMap(mapping, 'sizes');
    if (sizesEnt) {
      for (const [idx, row] of this.rowsFor(sheets, sizesEnt).entries()) {
        const label = getMappedValue(row, sizesEnt.columns, 'label');
        if (!label) { bump('sizes', skipped); continue; }
        const exists = await this.prisma.size.findFirst({ where: { tenantId: t.id, label } });
        if (exists) { bump('sizes', skipped); continue; }
        const sortOrder = parseNumberLoose(getMappedValue(row, sizesEnt.columns, 'sortOrder')) || idx;
        await this.prisma.size.create({ data: { tenantId: t.id, label, sortOrder } });
        bump('sizes', added);
      }
    }

    for (const kind of ['suppliers', 'customers'] as const) {
      const ent = this.entityMap(mapping, kind);
      if (!ent) continue;
      const type = kind === 'suppliers' ? 'SUPPLIER' : 'CUSTOMER';
      for (const [idx, row] of this.rowsFor(sheets, ent).entries()) {
        const name = getMappedValue(row, ent.columns, 'name');
        if (!name) { bump(kind, skipped); continue; }
        const exists = await this.prisma.partner.findFirst({ where: { tenantId: t.id, name, type } });
        if (exists) { bump(kind, skipped); continue; }
        await this.prisma.partner.create({
          data: {
            tenantId: t.id,
            name,
            type,
            phone: getMappedValue(row, ent.columns, 'phone') || null,
            address: getMappedValue(row, ent.columns, 'address') || null,
          },
        });
        bump(kind, added);
        void idx;
      }
    }

    const productsEnt = this.entityMap(mapping, 'products');
    if (productsEnt) {
      const sizeMaster = (await this.prisma.size.findMany({ where: { tenantId: t.id } })).map((s) => s.label);
      for (const row of this.rowsFor(sheets, productsEnt)) {
        let name = getMappedValue(row, productsEnt.columns, 'name');
        if (!name) { bump('products', skipped); continue; }
        let sizeLabel = getMappedValue(row, productsEnt.columns, 'sizeLabel') || name;
        // MAT Stok sheet: "Ukuran" dipakai sebagai identitas produk
        if (!/^benih\b/i.test(name) && sizeLabel === name) name = `Benih ${name}`;
        sizeLabel = preferSizeLabel([sizeLabel], sizeMaster);
        name = `Benih ${sizeLabel}`;
        const exists = await this.findProductBySize(t.id, sizeLabel);
        if (exists) {
          // Alias ukuran ("6" vs "6 cm") — jangan tambah stok lagi (hindari dobel)
          const exact = (exists.sizeLabel || '') === sizeLabel;
          if (!exact) {
            // Rapikan label ke master bila produk lama masih pakai alias
            await this.prisma.product.update({
              where: { id: exists.id },
              data: { sizeLabel, name },
            });
          }
          bump('products', skipped);
          continue;
        }
        await this.prisma.product.create({
          data: {
            tenantId: t.id,
            name,
            unit: getMappedValue(row, productsEnt.columns, 'unit') || 'ekor',
            stock: parseNumberLoose(getMappedValue(row, productsEnt.columns, 'stock')),
            minStock: parseNumberLoose(getMappedValue(row, productsEnt.columns, 'minStock')),
            price: parseNumberLoose(getMappedValue(row, productsEnt.columns, 'price')),
            sizeLabel: sizeLabel || null,
          },
        });
        bump('products', added);
      }
    }

    if (mode === 'master_plus_open' || mode === 'full_history') {
      await this.commitOpeningFromSetting(t.id, sheets, added, bump);
      await this.commitOpenAndCash(t.id, mapping, sheets, mode, added, skipped, errors, bump);
    }
    if (mode === 'full_history') {
      await this.commitTransactions(t.id, mapping, sheets, added, skipped, errors, bump);
      await this.commitBeritaAcara(t.id, mapping, sheets, added, skipped, errors, bump);
      await this.linkBeritaAcaraToPurchases(t.id, added, bump);
      await this.commitSuratJalan(t.id, mapping, sheets, added, skipped, errors, bump);
    }
    await this.mergeDuplicateSizeProducts(t.id);

    // Audit celah nomor di DB setelah impor
    for (const type of ['PURCHASE', 'SALE'] as const) {
      const rows = await this.prisma.transaction.findMany({
        where: { tenantId: t.id, type },
        select: { number: true },
      });
      const gaps = findDocumentNumberGaps(rows.map((r) => r.number));
      if (gaps.length) {
        const label = type === 'PURCHASE' ? 'Pembelian' : 'Penjualan';
        warnings.push(
          `${label}: ${gaps.length} nomor hilang di workspace: ${gaps.slice(0, 10).join(', ')}${gaps.length > 10 ? '…' : ''}`,
        );
      }
    }

    const criticalSkip = (skipped.purchases || 0) + (skipped.sales || 0) + (skipped.beritaAcara || 0);
    const hasErrors = errors.length > 0;
    const ok = !hasErrors;
    const message = hasErrors
      ? `Impor selesai dengan ${errors.length} error — periksa daftar di bawah.`
      : criticalSkip > 0
        ? `Impor selesai. ${criticalSkip} dokumen dilewati (sudah ada / tidak valid).`
        : 'Impor Excel selesai (non-destruktif).';

    return {
      ok,
      message,
      added,
      skipped,
      errors: errors.slice(0, 80),
      warnings: warnings.slice(0, 40),
      workspace: { code: t.code, name: t.name },
    };
  }

  private async findProductBySize(tenantId: string, sizeLabel: string) {
    const key = normalizeSizeKey(sizeLabel || 'Umum');
    if (!key) return null;
    const products = await this.prisma.product.findMany({ where: { tenantId } });
    return products.find((p) => normalizeSizeKey(p.sizeLabel || p.name) === key) || null;
  }

  private async ensureProductBySize(tenantId: string, sizeLabel: string, price: number) {
    const raw = sizeLabel || 'Umum';
    const sizeMaster = (await this.prisma.size.findMany({ where: { tenantId } })).map((s) => s.label);
    const label = preferSizeLabel([raw], sizeMaster);
    const name = `Benih ${label}`;
    let p = await this.findProductBySize(tenantId, label);
    if (!p) {
      p = await this.prisma.product.create({
        data: { tenantId, name, unit: 'ekor', stock: 0, minStock: 0, price, sizeLabel: label },
      });
    } else if (p.sizeLabel !== label || p.name !== name) {
      p = await this.prisma.product.update({
        where: { id: p.id },
        data: { sizeLabel: label, name },
      });
    }
    return p;
  }

  /**
   * Gabungkan produk alias ukuran ("6" + "6 cm") pakai data stok/harga restore saat ini.
   * Label kanonik mengikuti master Ukuran bila ada.
   */
  async mergeDuplicateSizeProducts(tenantId: string) {
    const sizeMaster = (await this.prisma.size.findMany({ where: { tenantId } })).map((s) => s.label);
    const products = await this.prisma.product.findMany({ where: { tenantId } });
    const groups = new Map<string, typeof products>();
    for (const p of products) {
      const key = normalizeSizeKey(p.sizeLabel || p.name);
      if (!key || /^(umum|saldo awal)$/i.test(key)) continue;
      const list = groups.get(key) || [];
      list.push(p);
      groups.set(key, list);
    }

    // Item sintetis "Umum" yang salah tempel ke produk ukuran → pindah ke Benih Umum
    const umum = await this.ensureProductBySize(tenantId, 'Umum', 0);
    await this.prisma.transactionItem.updateMany({
      where: {
        sizeLabel: 'Umum',
        productId: { not: umum.id },
        transaction: { tenantId },
      },
      data: { productId: umum.id },
    });

    for (const [, list] of groups) {
      if (list.length < 2) continue;
      const canonical = preferSizeLabel(
        list.map((p) => p.sizeLabel || p.name.replace(/^Benih\s+/i, '')),
        sizeMaster,
      );
      const keeper =
        list.find((p) => (p.sizeLabel || '') === canonical)
        || list.find((p) => normalizeSizeKey(p.sizeLabel || '') === normalizeSizeKey(canonical))
        || list[0];
      const dupes = list.filter((p) => p.id !== keeper.id);
      // Pakai stok/harga produk kanonik (data restore), bukan penjumlahan alias
      const price = Number(keeper.price) > 0
        ? Number(keeper.price)
        : Math.max(...list.map((p) => Number(p.price) || 0));

      for (const d of dupes) {
        await this.prisma.transactionItem.updateMany({
          where: { productId: d.id },
          data: { productId: keeper.id, sizeLabel: canonical },
        });
        await this.prisma.product.delete({ where: { id: d.id } });
      }
      await this.prisma.product.update({
        where: { id: keeper.id },
        data: {
          name: `Benih ${canonical}`,
          sizeLabel: canonical,
          ...(price > 0 ? { price } : {}),
        },
      });
    }
  }

  private async ensurePartner(tenantId: string, name: string, type: 'SUPPLIER' | 'CUSTOMER') {
    let p = await this.prisma.partner.findFirst({ where: { tenantId, name, type } });
    if (!p) p = await this.prisma.partner.create({ data: { tenantId, name, type } });
    return p;
  }

  private async nextNumber(tenantId: string, prefix: string) {
    const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const docType = prefix;
    const row = await this.prisma.docCounter.upsert({
      where: { tenantId_docType_yymmdd: { tenantId, docType, yymmdd } },
      update: { lastSeq: { increment: 1 } },
      create: { tenantId, docType, yymmdd, lastSeq: 1 },
    });
    return `${prefix}-${yymmdd}-${String(row.lastSeq).padStart(3, '0')}`;
  }

  /** Sheet Setting MAT: saldo awal + rugi ditahan → company settings. */
  private async commitOpeningFromSetting(
    tenantId: string,
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    added: Record<string, number>,
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    const sheet = sheets.get('Setting') || sheets.get('Pengaturan');
    if (!sheet?.headers?.length) return;
    const paramIdx = sheet.headers.findIndex((h) => /parameter/i.test(h));
    const nilaiIdx = sheet.headers.findIndex((h) => /nilai/i.test(h));
    if (paramIdx < 0 || nilaiIdx < 0) return;

    let openingCash: number | undefined;
    let openingBank: number | undefined;
    let rugiDitahan: number | undefined;
    let periodeRugiDitahan: string | undefined;
    let keteranganRugiDitahan: string | undefined;
    let namaPerusahaan: string | undefined;
    let alamat: string | undefined;
    let telepon: string | undefined;
    let tagline: string | undefined;
    let invoiceUraian: string | undefined;
    for (const r of sheet.rows) {
      const param = String(r[paramIdx] || '').trim();
      const rawNilai = String(r[nilaiIdx] || '').trim();
      const nilai = parseNumberLoose(rawNilai);
      if (param === 'SaldoAwalKas') openingCash = nilai;
      if (param === 'SaldoAwalBank') openingBank = nilai;
      if (param === 'RugiDitahan') rugiDitahan = nilai;
      if (param === 'PeriodeRugiDitahan') periodeRugiDitahan = rawNilai;
      if (param === 'KeteranganRugiDitahan') keteranganRugiDitahan = rawNilai;
      if (param === 'NamaPerusahaan' && rawNilai) namaPerusahaan = rawNilai;
      if (param === 'Alamat' && rawNilai) alamat = rawNilai;
      if ((param === 'Telepon1' || param === 'Telepon') && rawNilai) telepon = rawNilai;
      if (param === 'Tagline' && rawNilai) tagline = rawNilai;
      if ((param === 'InvoiceUraian' || param === 'NamaKomoditas') && rawNilai) invoiceUraian = rawNilai;
    }
    const hasAny = openingCash !== undefined || openingBank !== undefined
      || rugiDitahan !== undefined || periodeRugiDitahan !== undefined || keteranganRugiDitahan !== undefined
      || namaPerusahaan !== undefined || alamat !== undefined || telepon !== undefined
      || tagline !== undefined || invoiceUraian !== undefined;
    if (!hasAny) return;

    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: tenantId } });
    let prev: Record<string, unknown> = {};
    try { prev = JSON.parse(tenant.settingsJson || '{}') as Record<string, unknown>; } catch { prev = {}; }
    const next = {
      ...prev,
      ...(openingCash !== undefined ? { openingCash } : {}),
      ...(openingBank !== undefined ? { openingBank } : {}),
      ...(rugiDitahan !== undefined ? { rugiDitahan: Math.max(0, rugiDitahan) } : {}),
      ...(periodeRugiDitahan !== undefined ? { periodeRugiDitahan } : {}),
      ...(keteranganRugiDitahan !== undefined ? { keteranganRugiDitahan } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
      ...(invoiceUraian !== undefined ? { invoiceUraian } : {}),
    };
    await this.prisma.workspace.update({
      where: { id: tenantId },
      data: {
        settingsJson: JSON.stringify(next),
        ...(namaPerusahaan ? { name: namaPerusahaan } : {}),
        ...(alamat !== undefined ? { address: alamat || null } : {}),
        ...(telepon !== undefined ? { phone: telepon || null } : {}),
      },
    });
    bump('settings', added);
  }

  private async commitOpenAndCash(
    tenantId: string,
    mapping: ExcelImportMapping,
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    mode: ImportMode,
    added: Record<string, number>,
    skipped: Record<string, number>,
    errors: PreviewRowIssue[],
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    const cash = this.entityMap(mapping, 'cash');
    const expenses = this.entityMap(mapping, 'expenses');
    // MAT: sheet Pengeluaran = sumber P&L; sheet Kas = buku kas (boleh berisi salinan).
    // Jika keduanya ada: impor Pengeluaran ke account PNL (masuk rekap, tidak dobel di saldo kas).
    const cashAlsoMapped = Boolean(cash?.sheetName);

    if (expenses && (mode === 'full_history' || mode === 'master_plus_open')) {
      for (const [idx, row] of this.rowsFor(sheets, expenses).entries()) {
        const amount = parseNumberLoose(getMappedValue(row, expenses.columns, 'amount'));
        const rawCat = getMappedValue(row, expenses.columns, 'category') || 'Operasional';
        const category = /^pengeluaran/i.test(rawCat) ? rawCat : `Pengeluaran: ${rawCat}`;
        const date = parseDateLoose(getMappedValue(row, expenses.columns, 'date')) || new Date();
        if (amount <= 0) { bump('expenses', skipped); continue; }
        const accountRaw = getMappedValue(row, expenses.columns, 'account').toUpperCase();
        const description = getMappedValue(row, expenses.columns, 'description') || category;
        // Hindari duplikat antar re-impor (tanggal+nominal+deskripsi+PNL)
        const exists = await this.prisma.cashEntry.findFirst({
          where: {
            tenantId,
            amount,
            direction: 'OUT',
            account: cashAlsoMapped ? 'PNL' : (accountRaw.includes('BANK') ? 'BANK' : 'CASH'),
            description,
            date,
          },
        });
        if (exists) { bump('expenses', skipped); continue; }
        await this.prisma.cashEntry.create({
          data: {
            tenantId,
            date,
            category,
            description,
            amount,
            direction: 'OUT',
            account: cashAlsoMapped ? 'PNL' : (accountRaw.includes('BANK') ? 'BANK' : 'CASH'),
          },
        });
        bump('expenses', added);
        void idx;
      }
    }

    if (cash) {
      for (const row of this.rowsFor(sheets, cash)) {
        const amount = parseNumberLoose(getMappedValue(row, cash.columns, 'amount'));
        if (amount <= 0) { bump('cash', skipped); continue; }
        const number = getMappedValue(row, cash.columns, 'number') || null;
        if (number) {
          const exists = await this.prisma.cashEntry.findFirst({ where: { tenantId, number } });
          if (exists) { bump('cash', skipped); continue; }
        }
        const dirRaw = getMappedValue(row, cash.columns, 'direction').toUpperCase();
        const directionFinal = /KELUAR|OUT|DEBIT/.test(dirRaw) ? 'OUT' : 'IN';
        const accountRaw = getMappedValue(row, cash.columns, 'account').toUpperCase();
        await this.prisma.cashEntry.create({
          data: {
            tenantId,
            date: parseDateLoose(getMappedValue(row, cash.columns, 'date')) || new Date(),
            category: getMappedValue(row, cash.columns, 'category') || (directionFinal === 'IN' ? 'Pemasukan' : 'Pengeluaran'),
            description: getMappedValue(row, cash.columns, 'description') || 'Impor Excel',
            amount,
            direction: directionFinal,
            account: accountRaw.includes('BANK') ? 'BANK' : 'CASH',
            number,
          },
        });
        bump('cash', added);
      }
    }

    const open = this.entityMap(mapping, 'openBalances');
    if (open && mode === 'master_plus_open') {
      for (const [idx, row] of this.rowsFor(sheets, open).entries()) {
        const kindRaw = getMappedValue(row, open.columns, 'kind').toUpperCase();
        const amount = parseNumberLoose(getMappedValue(row, open.columns, 'amount'));
        const partner = getMappedValue(row, open.columns, 'partner') || 'Mitra';
        const date = parseDateLoose(getMappedValue(row, open.columns, 'date')) || new Date();
        const notes = getMappedValue(row, open.columns, 'notes') || 'Saldo awal impor';
        if (amount <= 0) { bump('openBalances', skipped); continue; }

        if (/KAS|BANK|SALDO/.test(kindRaw) && !/HUTANG|PIUTANG/.test(kindRaw)) {
          await this.prisma.cashEntry.create({
            data: {
              tenantId, date, category: 'Modal', description: notes, amount,
              direction: 'IN', account: /BANK/.test(kindRaw) ? 'BANK' : 'CASH',
            },
          });
          bump('openBalances', added);
          continue;
        }

        const isPayable = /HUTANG|PAYABLE|UTANG/.test(kindRaw);
        const type = isPayable ? 'PURCHASE' : 'SALE';
        await this.ensurePartner(tenantId, partner, isPayable ? 'SUPPLIER' : 'CUSTOMER');
        const product = await this.ensureProductBySize(tenantId, 'Saldo Awal', amount);
        const number = await this.nextNumber(tenantId, isPayable ? 'PUR' : 'SLS');
        try {
          await this.prisma.transaction.create({
            data: {
              tenantId,
              number,
              date,
              type,
              partner,
              total: amount,
              paidAmount: 0,
              status: 'DUE',
              notes,
              account: 'CASH',
              metaJson: JSON.stringify({ imported: true, openBalance: true }),
              items: {
                create: [{ productId: product.id, quantity: 1, price: amount, sizeLabel: 'Saldo Awal' }],
              },
            },
          });
          bump('openBalances', added);
        } catch (e) {
          bump('openBalances', skipped);
          errors.push({ entity: 'openBalances', row: idx + 2, message: e instanceof Error ? e.message : 'Gagal' });
        }
      }
    }
  }

  private loadSummaryIndex(
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    summarySheetName: string | null | undefined,
  ) {
    const idx = new Map<string, Record<string, string>>();
    if (!summarySheetName) return idx;
    const sheet = sheets.get(summarySheetName);
    if (!sheet) return idx;
    const numHeader = sheet.headers.find((h) => /no\s*transaksi/i.test(h)) || sheet.headers[0];
    for (const r of sheet.rows) {
      const obj: Record<string, string> = {};
      sheet.headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      const no = String(obj[numHeader] || '').trim();
      if (no) idx.set(no, obj);
    }
    return idx;
  }

  private async commitTransactions(
    tenantId: string,
    mapping: ExcelImportMapping,
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    added: Record<string, number>,
    skipped: Record<string, number>,
    errors: PreviewRowIssue[],
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    for (const kind of ['purchases', 'sales'] as const) {
      const ent = this.entityMap(mapping, kind);
      if (!ent) continue;
      const type = kind === 'purchases' ? 'PURCHASE' : 'SALE';
      const summaryName = ent.columns._summarySheet || null;
      const summaryIdx = this.loadSummaryIndex(sheets, summaryName);
      const groups = this.groupTxRows(this.rowsFor(sheets, ent), ent, 'partner');
      for (const g of groups) {
        if (g.error || !g.items.length) {
          if (g.error) errors.push({ entity: kind, row: g.row, message: g.error });
          bump(kind, skipped);
          continue;
        }
        const first = g.items[0];
        const srcNumber = getMappedValue(first, ent.columns, 'number');
        const summary = srcNumber ? summaryIdx.get(srcNumber) : undefined;

        let partner = getMappedValue(first, ent.columns, 'partner')
          || String(first['Supplier'] || first['Pelanggan'] || '').trim();
        let dateRaw = getMappedValue(first, ent.columns, 'date') || String(first['Tanggal'] || '').trim();
        let statusRaw = getMappedValue(first, ent.columns, 'status') || String(first['Status'] || '').trim();
        let notes = getMappedValue(first, ent.columns, 'notes') || 'Impor Excel';
        let paidAmount = parseNumberLoose(getMappedValue(first, ent.columns, 'paidAmount'));
        let plaseAmount = parseNumberLoose(getMappedValue(first, ent.columns, 'plaseAmount'))
          || parseNumberLoose(String(first['Total Potongan'] || ''));
        let headerTotal = parseNumberLoose(getMappedValue(first, ent.columns, 'total'));
        if (type === 'PURCHASE') {
          const netBayar = parseNumberLoose(String(first['Nominal Bayar'] || ''));
          const bruto = parseNumberLoose(String(first['Total Pembelian'] || ''));
          if (netBayar > 0) headerTotal = netBayar;
          else if (!headerTotal && bruto > 0) headerTotal = Math.max(0, bruto - plaseAmount);
        } else if (!headerTotal) {
          headerTotal = parseNumberLoose(String(first['Total Penjualan'] || first['Nominal Tagihan'] || ''));
        }

        if (summary) {
          partner = partner || String(summary['Supplier'] || summary['Pelanggan'] || '').trim();
          dateRaw = dateRaw || String(summary['Tanggal'] || '').trim();
          statusRaw = statusRaw || String(summary['Status'] || '').trim();
          notes = getMappedValue(first, ent.columns, 'notes')
            || String(summary['Keterangan'] || '').trim()
            || 'Impor Excel';
          if (!plaseAmount) plaseAmount = parseNumberLoose(String(summary['Total Potongan'] || ''));
          // MAT: pembelian P&L = Nominal Bayar (net); DP = Nominal DP (bukan Nominal Bayar).
          if (type === 'PURCHASE') {
            const netBayar = parseNumberLoose(String(summary['Nominal Bayar'] || ''));
            if (netBayar > 0) headerTotal = netBayar;
            else if (!headerTotal) headerTotal = parseNumberLoose(String(summary['Total Pembelian'] || ''));
            const dp = parseNumberLoose(String(summary['Nominal DP'] || ''));
            if (dp > 0 || Object.prototype.hasOwnProperty.call(summary, 'Nominal DP')) {
              paidAmount = dp;
            }
          } else {
            if (!paidAmount) paidAmount = parseNumberLoose(String(summary['Nominal DP'] || ''));
            if (!headerTotal) headerTotal = parseNumberLoose(String(summary['Total Penjualan'] || ''));
          }
        }

        if (!partner) {
          bump(kind, skipped);
          errors.push({
            entity: kind,
            row: g.row,
            message: `${srcNumber || 'Tanpa nomor'}: partner/supplier kosong`,
          });
          continue;
        }

        const date = parseDateLoose(dateRaw);
        if (!date) {
          bump(kind, skipped);
          errors.push({
            entity: kind,
            row: g.row,
            message: `${srcNumber || 'Tanpa nomor'}: tanggal tidak valid (${dateRaw || 'kosong'})`,
          });
          continue;
        }
        const status = normalizeStatus(statusRaw, type);
        if (srcNumber) {
          const exists = await this.prisma.transaction.findFirst({
            where: { tenantId, number: srcNumber },
          });
          if (exists) {
            bump(kind, skipped);
            errors.push({
              entity: kind,
              row: g.row,
              message: `${srcNumber}: dilewati (nomor sudah ada, tipe ${exists.type})`,
            });
            continue;
          }
        }
        const number = srcNumber || await this.nextNumber(tenantId, type === 'PURCHASE' ? 'PUR' : 'SLS');

        await this.ensurePartner(tenantId, partner, type === 'PURCHASE' ? 'SUPPLIER' : 'CUSTOMER');

        const itemCreates: Array<{
          productId: string; quantity: number; price: number; weight: number; sampling: number; sizeLabel: string | null;
        }> = [];
        let total = 0;
        for (const row of g.items) {
          const sizeLabel = getMappedValue(row, ent.columns, 'sizeLabel') || 'Umum';
          let qty = parseNumberLoose(getMappedValue(row, ent.columns, 'quantity'));
          let price = parseNumberLoose(getMappedValue(row, ent.columns, 'price'));
          const rowTotal = parseNumberLoose(getMappedValue(row, ent.columns, 'total'));
          // Summary-only row: Total Pembelian/Penjualan without Harga/Ekor
          if (price <= 0 && (rowTotal > 0 || headerTotal > 0)) {
            const trow = rowTotal > 0 ? rowTotal : headerTotal;
            if (qty <= 0) qty = 1;
            price = trow / qty;
          }
          if (qty <= 0) continue;
          const product = await this.ensureProductBySize(tenantId, sizeLabel, price);
          itemCreates.push({
            productId: product.id,
            quantity: qty,
            price,
            weight: parseNumberLoose(getMappedValue(row, ent.columns, 'weight')),
            sampling: parseNumberLoose(getMappedValue(row, ent.columns, 'sampling')),
            sizeLabel,
          });
          total += qty * price;
        }
        // Ringkasan MAT tanpa detail: buat 1 item sintetik dari Nominal Bayar
        if (!itemCreates.length && headerTotal > 0) {
          const product = await this.ensureProductBySize(tenantId, 'Umum', headerTotal);
          itemCreates.push({
            productId: product.id, quantity: 1, price: headerTotal, weight: 0, sampling: 0, sizeLabel: 'Umum',
          });
          total = headerTotal;
        }
        if (!itemCreates.length) {
          bump(kind, skipped);
          errors.push({
            entity: kind,
            row: g.row,
            message: `${srcNumber || 'Tanpa nomor'}: tidak ada item/nominal valid`,
          });
          continue;
        }
        if (headerTotal > 0) total = headerTotal;

        const plasePercent = parseNumberLoose(getMappedValue(first, ent.columns, 'plasePercent'));
        // Jika total masih bruto (tanpa Nominal Bayar), kurangi potongan → net = HPP MAT.
        if (type === 'PURCHASE' && plaseAmount > 0 && headerTotal <= 0) {
          total = Math.max(0, total - plaseAmount);
        }

        if (status === 'PAID') paidAmount = total;
        else if (status === 'DUE') paidAmount = 0;
        else if (paidAmount > total) paidAmount = total;

        try {
          await this.prisma.$transaction(async (tx) => {
            // Mutasi stok hanya untuk pembelian; penjualan tidak dikaitkan ke stok (sementara).
            if (type === 'PURCHASE') {
              for (const item of itemCreates) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
              }
            }
            await tx.transaction.create({
              data: {
                tenantId,
                number: number!,
                date,
                type,
                partner,
                total,
                paidAmount,
                status: paidAmount <= 0 ? 'DUE' : paidAmount >= total ? 'PAID' : 'DP',
                notes,
                account: 'CASH',
                discountAmount: type === 'PURCHASE' ? plaseAmount : 0,
                feeAmount: 0,
                metaJson: JSON.stringify({ imported: true, sourceNumber: srcNumber || null, plasePercent, plaseAmount }),
                items: { create: itemCreates },
              },
            });
          });
          bump(kind, added);
        } catch (e) {
          bump(kind, skipped);
          errors.push({ entity: kind, row: g.row, message: e instanceof Error ? e.message : 'Gagal simpan' });
        }
      }
    }
  }

  private async commitBeritaAcara(
    tenantId: string,
    mapping: ExcelImportMapping,
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    added: Record<string, number>,
    skipped: Record<string, number>,
    errors: PreviewRowIssue[],
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    const ent = this.entityMap(mapping, 'beritaAcara');
    if (!ent) return;
    const detailSheet = sheets.get('BeritaAcaraDetail') || sheets.get('Berita Acara Detail');
    for (const [idx, row] of this.rowsFor(sheets, ent).entries()) {
      const supplier = getMappedValue(row, ent.columns, 'supplier') || getMappedValue(row, ent.columns, 'partner');
      const date = parseDateLoose(getMappedValue(row, ent.columns, 'date')) || new Date();
      const srcNumber = getMappedValue(row, ent.columns, 'number');
      if (!supplier) {
        bump('beritaAcara', skipped);
        errors.push({ entity: 'beritaAcara', row: idx + 2, message: 'Supplier kosong' });
        continue;
      }
      if (srcNumber) {
        const exists = await this.prisma.beritaAcara.findFirst({ where: { tenantId, number: srcNumber } });
        if (exists) { bump('beritaAcara', skipped); continue; }
      }
      const number = srcNumber || await this.nextNumber(tenantId, 'BA');
      await this.ensurePartner(tenantId, supplier, 'SUPPLIER');

      let lines: Array<{ sizeLabel: string; quantity: number; qtyInitial: number; price: number }> = [];
      if (detailSheet && srcNumber) {
        const numIdx = detailSheet.headers.findIndex((h) => /no\s*ba/i.test(h));
        const sizeIdx = detailSheet.headers.findIndex((h) => /ukuran/i.test(h));
        const awalIdx = detailSheet.headers.findIndex((h) => /jumlah\s*awal/i.test(h));
        const aktualIdx = detailSheet.headers.findIndex((h) => /jumlah\s*aktual/i.test(h));
        const hargaIdx = detailSheet.headers.findIndex((h) => /harga/i.test(h));
        for (const dr of detailSheet.rows) {
          if (numIdx < 0 || String(dr[numIdx] || '').trim() !== srcNumber) continue;
          const qty = parseNumberLoose(String(dr[aktualIdx >= 0 ? aktualIdx : awalIdx] || ''));
          if (qty <= 0) continue;
          lines.push({
            sizeLabel: String(dr[sizeIdx] || 'Umum').trim() || 'Umum',
            quantity: qty,
            qtyInitial: parseNumberLoose(String(dr[awalIdx] || qty)),
            price: parseNumberLoose(String(dr[hargaIdx] || '')),
          });
        }
      }
      if (!lines.length) {
        // Fallback: satu baris dari Total Aktual di sheet ringkasan
        const qty = parseNumberLoose(
          String(row['Total Aktual'] || row['Total Awal'] || getMappedValue(row, ent.columns, 'quantity') || ''),
        );
        if (qty > 0) lines = [{ sizeLabel: 'Umum', quantity: qty, qtyInitial: qty, price: 0 }];
      }
      if (!lines.length) {
        bump('beritaAcara', skipped);
        errors.push({ entity: 'beritaAcara', row: idx + 2, message: 'Tidak ada baris detail/qty' });
        continue;
      }

      try {
        await this.prisma.beritaAcara.create({
          data: {
            tenantId,
            number,
            date,
            supplier,
            vehicle: getMappedValue(row, ent.columns, 'vehicle') || null,
            notes: getMappedValue(row, ent.columns, 'notes') || 'Impor Excel',
            totalAktual: lines.reduce((s, l) => s + l.quantity, 0),
            totalAwal: lines.reduce((s, l) => s + l.qtyInitial, 0),
            lines: { create: lines },
          },
        });
        bump('beritaAcara', added);
      } catch (e) {
        bump('beritaAcara', skipped);
        errors.push({ entity: 'beritaAcara', row: idx + 2, message: e instanceof Error ? e.message : 'Gagal' });
      }
    }
  }

  /** Hubungkan BA ke PO yang cocok (supplier + tanggal yang sama / terdekat). */
  private async linkBeritaAcaraToPurchases(
    tenantId: string,
    added: Record<string, number>,
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    const bas = await this.prisma.beritaAcara.findMany({
      where: { tenantId, purchaseId: null },
      orderBy: { date: 'asc' },
    });
    if (!bas.length) return;
    const pos = await this.prisma.transaction.findMany({
      where: { tenantId, type: 'PURCHASE' },
      orderBy: { date: 'asc' },
    });
    const used = new Set(
      (await this.prisma.beritaAcara.findMany({
        where: { tenantId, purchaseId: { not: null } },
        select: { purchaseId: true },
      })).map((b) => b.purchaseId!).filter(Boolean),
    );

    for (const ba of bas) {
      const sameDay = pos.filter((p) => {
        if (used.has(p.id)) return false;
        if (p.partner.trim().toLowerCase() !== ba.supplier.trim().toLowerCase()) return false;
        const pd = p.date.toISOString().slice(0, 10);
        const bd = ba.date.toISOString().slice(0, 10);
        return pd === bd;
      });
      let pick = sameDay[0];
      if (!pick) {
        // fallback: PO supplier sama dalam ±3 hari, belum terpakai
        const baMs = ba.date.getTime();
        pick = pos
          .filter((p) => !used.has(p.id) && p.partner.trim().toLowerCase() === ba.supplier.trim().toLowerCase())
          .map((p) => ({ p, d: Math.abs(p.date.getTime() - baMs) }))
          .filter((x) => x.d <= 3 * 86400000)
          .sort((a, b) => a.d - b.d)[0]?.p;
      }
      if (!pick) continue;
      await this.prisma.beritaAcara.update({
        where: { id: ba.id },
        data: { purchaseId: pick.id, status: 'IMPORTED' },
      });
      used.add(pick.id);
      bump('baLinked', added);
    }
  }

  private async commitSuratJalan(
    tenantId: string,
    mapping: ExcelImportMapping,
    sheets: Map<string, { headers: string[]; rows: string[][] }>,
    added: Record<string, number>,
    skipped: Record<string, number>,
    errors: PreviewRowIssue[],
    bump: (k: string, bag: Record<string, number>, n?: number) => void,
  ) {
    const ent = this.entityMap(mapping, 'suratJalan');
    if (!ent) return;
    const detailSheet = sheets.get('SuratJalanDetail')
      || sheets.get('Surat Jalan Detail')
      || sheets.get('SJ Detail');

    for (const [idx, row] of this.rowsFor(sheets, ent).entries()) {
      const customer = getMappedValue(row, ent.columns, 'partner');
      const date = parseDateLoose(getMappedValue(row, ent.columns, 'date')) || new Date();
      const srcNumber = getMappedValue(row, ent.columns, 'number');
      const saleRef = getMappedValue(row, ent.columns, 'saleRef') || null;
      if (!customer) {
        bump('suratJalan', skipped);
        errors.push({ entity: 'suratJalan', row: idx + 2, message: 'Pelanggan kosong' });
        continue;
      }
      if (srcNumber) {
        const exists = await this.prisma.suratJalan.findFirst({ where: { tenantId, number: srcNumber } });
        if (exists) {
          bump('suratJalan', skipped);
          errors.push({ entity: 'suratJalan', row: idx + 2, message: `${srcNumber}: sudah ada — dilewati` });
          continue;
        }
      }
      const number = srcNumber || await this.nextNumber(tenantId, 'SJ');
      await this.ensurePartner(tenantId, customer, 'CUSTOMER');

      let lines: Array<{ productName: string; sizeLabel: string | null; quantity: number; bagCount: number; binNote: string | null }> = [];
      if (detailSheet && srcNumber) {
        const numIdx = detailSheet.headers.findIndex((h) => /no\s*sj/i.test(h));
        const sizeIdx = detailSheet.headers.findIndex((h) => /ukuran/i.test(h));
        const qtyIdx = detailSheet.headers.findIndex((h) => /jumlah\s*ekor|qty|ekor/i.test(h));
        const bagIdx = detailSheet.headers.findIndex((h) => /kantong/i.test(h));
        const bakIdx = detailSheet.headers.findIndex((h) => /bak|keterangan/i.test(h));
        for (const dr of detailSheet.rows) {
          if (numIdx < 0 || String(dr[numIdx] || '').trim() !== srcNumber) continue;
          const qty = parseNumberLoose(String(dr[qtyIdx] || ''));
          if (qty <= 0) continue;
          const sizeLabel = String(dr[sizeIdx] || '').trim() || null;
          lines.push({
            productName: sizeLabel ? `Benih ${sizeLabel}` : 'Benih',
            sizeLabel,
            quantity: qty,
            bagCount: parseNumberLoose(String(dr[bagIdx] || '')),
            binNote: bakIdx >= 0 ? String(dr[bakIdx] || '').trim() || null : null,
          });
        }
      }
      if (!lines.length && saleRef) {
        const sale = await this.prisma.transaction.findFirst({
          where: { tenantId, type: 'SALE', number: saleRef },
          include: { items: true },
        });
        if (sale?.items?.length) {
          const products = await this.prisma.product.findMany({ where: { tenantId } });
          const pmap = new Map(products.map((p) => [p.id, p]));
          lines = sale.items.map((it) => {
            const p = pmap.get(it.productId);
            return {
              productName: p?.name || it.sizeLabel || 'Benih',
              sizeLabel: it.sizeLabel || p?.sizeLabel || null,
              quantity: Number(it.quantity),
              bagCount: 0,
              binNote: null,
            };
          });
        }
      }
      if (!lines.length) {
        bump('suratJalan', skipped);
        errors.push({ entity: 'suratJalan', row: idx + 2, message: `${srcNumber || 'SJ'}: tidak ada baris detail` });
        continue;
      }

      try {
        await this.prisma.suratJalan.create({
          data: {
            tenantId,
            number,
            date,
            customer,
            saleRef,
            destination: getMappedValue(row, ent.columns, 'destination') || null,
            vehicle: getMappedValue(row, ent.columns, 'vehicle') || null,
            driver: getMappedValue(row, ent.columns, 'driver') || null,
            notes: getMappedValue(row, ent.columns, 'notes') || 'Impor Excel',
            status: 'DRAFT',
            lines: { create: lines },
          },
        });
        bump('suratJalan', added);
      } catch (e) {
        bump('suratJalan', skipped);
        errors.push({ entity: 'suratJalan', row: idx + 2, message: e instanceof Error ? e.message : 'Gagal' });
      }
    }
  }
}


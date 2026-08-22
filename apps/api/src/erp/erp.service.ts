// @ts-nocheck
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from './tenant.context';
import { escapeHtml } from '../common/html.util';
import { findDocumentNumberGaps } from './excel-import.mapper';
import { buildPrintLetterheadHtml, printLetterheadCss } from './print-letterhead';
import {
  COMMODITY_CATEGORIES,
  FISH_SPECIES_OPTIONS,
  formatQtyWithUnit,
  inferCommodityFromUnit,
  normalizeCommodityCategory,
  unitForCommodity,
  unitLabelForCommodity,
} from '@tumbu/domain';
import { formatStockSkuName } from '../platform/filter-context';

type ProductInput = {
  name?: string;
  unit?: string;
  stock?: number;
  minStock?: number;
  price?: number;
  sizeLabel?: string;
  commodityCategory?: string;
  species?: string;
};
type PartnerInput = { name?: string; phone?: string; type?: 'CUSTOMER' | 'SUPPLIER' };
type CashInput = {
  id?: string;
  date?: string;
  category?: string;
  description?: string;
  amount?: number;
  direction?: 'IN' | 'OUT';
  account?: 'CASH' | 'BANK';
};
type RekapPengeluaranInput = {
  mode?: 'bulan' | 'rentang' | string;
  periode?: string;
  from?: string;
  to?: string;
  dari?: string;
  sampai?: string;
  keterangan?: string;
};
type TxItemInput = {
  productId?: string;
  quantity: number;
  price?: number;
  weight?: number;
  sampling?: number;
  flaseType?: 'none' | 'bonus' | 'potongan' | string;
  flasePercent?: number;
  sizeLabel?: string;
  commodityCategory?: string;
  species?: string;
  unit?: string;
};
type TxFeeInput = { kind?: string; label?: string; amount?: number };
type TransactionInput = {
  type?: 'SALE' | 'PURCHASE';
  partner?: string;
  partnerPhone?: string;
  partnerAddress?: string;
  status?: 'PAID' | 'DUE' | 'DP' | string;
  date?: string;
  account?: 'CASH' | 'BANK';
  notes?: string;
  paidAmount?: number;
  nominalDP?: number;
  baId?: string;
  plasePercent?: number;
  priorDebt?: number;
  priorDebtRef?: string;
  transport?: number;
  jasaBongkar?: number;
  upahSopir?: number;
  fees?: TxFeeInput[];
  items?: TxItemInput[];
};
type BeritaAcaraLineInput = {
  binNote?: string;
  bak?: string;
  sizeLabel?: string;
  ukuran?: string;
  qtyInitial?: number;
  jumlahAwal?: number;
  quantity?: number;
  jumlahAktual?: number;
  price?: number;
  hargaEkor?: number;
};
type BeritaAcaraInput = {
  id?: string;
  number?: string;
  supplier?: string;
  notes?: string;
  status?: string;
  date?: string;
  dateDepart?: string;
  tanggalTiba?: string;
  tanggalBerangkat?: string;
  refNumber?: string;
  noReferensi?: string;
  vehicle?: string;
  kendaraan?: string;
  pondLocation?: string;
  lokasiKolam?: string;
  checker?: string;
  adminName?: string;
  admin?: string;
  receiver?: string;
  penerimaBarang?: string;
  plasePercent?: number;
  persenPlase?: number;
  dpNote?: number;
  dpDipakai?: number;
  transport?: number;
  jasaBongkar?: number;
  upahSopir?: number;
  priorDebtNote?: number;
  sisaPOSebelumnya?: number;
  priorDebtRef?: string;
  refPOSebelumnya?: string;
  payMethodNote?: string;
  metodeBayar?: string;
  keterangan?: string;
  lines?: BeritaAcaraLineInput[];
  items?: BeritaAcaraLineInput[];
};
type SuratJalanInput = {
  customer?: string;
  saleRef?: string;
  notes?: string;
  status?: string;
  date?: string;
  destination?: string;
  vehicle?: string;
  driver?: string;
  lines?: Array<{ productName: string; sizeLabel?: string; quantity: number; bagCount?: number; binNote?: string }>;
};

const KATEGORI_PENGELUARAN = [
  'Operasional', 'Transportasi', 'Gaji / Upah', 'Listrik & Air',
  'Perawatan Kolam', 'Pakan Tambahan', 'Obat & Vitamin',
  'Perlengkapan', 'Lain-lain',
] as const;

@Injectable()
export class ErpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  private tid() {
    return this.tenant.tryTenantId();
  }

  private num(v: Prisma.Decimal | number | null | undefined) {
    return Number(v ?? 0);
  }

  private e(v: unknown) {
    return escapeHtml(v);
  }

  private async assertPeriodOpen(date = new Date()) {
    const periodYm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const latest = await this.prisma.closingPeriod.findFirst({
      where: { tenantId: this.tid() },
      orderBy: { periodYm: 'desc' },
      select: { periodYm: true },
    });
    if (latest && periodYm <= latest.periodYm) {
      throw new BadRequestException(
        `Tanggal transaksi berada pada periode ${periodYm} yang sudah ditutup buku (terakhir tutup: ${latest.periodYm}). Gunakan tanggal setelah periode tersebut.`,
      );
    }
  }

  private async nextDocNumber(docType: string, prefix: string) {
    const yymmdd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const counter = await this.prisma.docCounter.upsert({
      where: { tenantId_docType_yymmdd: { tenantId: this.tid(), docType, yymmdd } },
      update: { lastSeq: { increment: 1 } },
      create: { tenantId: this.tid(), docType, yymmdd, lastSeq: 1 },
    });
    return `${prefix}-${yymmdd}-${String(counter.lastSeq).padStart(4, '0')}`;
  }

  private parseSettings(raw?: string | null): {
    logoUrl?: string; letterheadUrl?: string; letterheadMode?: 'template' | 'custom';
    bankName?: string; bankAccount?: string;
    openingCash?: number; openingBank?: number;
    rugiDitahan?: number; periodeRugiDitahan?: string; keteranganRugiDitahan?: string;
    tagline?: string; invoiceUraian?: string;
  } {
    try {
      const parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
      const modeRaw = String(parsed.letterheadMode || 'template');
      const letterheadMode = modeRaw === 'custom' ? 'custom' : 'template';
      return {
        logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : '',
        letterheadUrl: typeof parsed.letterheadUrl === 'string' ? parsed.letterheadUrl : '',
        letterheadMode,
        bankName: typeof parsed.bankName === 'string' ? parsed.bankName : '',
        bankAccount: typeof parsed.bankAccount === 'string' ? parsed.bankAccount : '',
        openingCash: Number(parsed.openingCash) || 0,
        openingBank: Number(parsed.openingBank) || 0,
        rugiDitahan: Math.max(0, Number(parsed.rugiDitahan) || 0),
        periodeRugiDitahan: typeof parsed.periodeRugiDitahan === 'string' ? parsed.periodeRugiDitahan : '',
        keteranganRugiDitahan: typeof parsed.keteranganRugiDitahan === 'string' ? parsed.keteranganRugiDitahan : '',
        tagline: typeof parsed.tagline === 'string' ? parsed.tagline : '',
        invoiceUraian: typeof parsed.invoiceUraian === 'string' ? parsed.invoiceUraian : '',
      };
    } catch {
      return {
        logoUrl: '', letterheadUrl: '', letterheadMode: 'template', bankName: '', bankAccount: '',
        openingCash: 0, openingBank: 0, rugiDitahan: 0, periodeRugiDitahan: '', keteranganRugiDitahan: '',
        tagline: '', invoiceUraian: '',
      };
    }
  }

  private async patchTenantSettings(patch: Record<string, unknown>) {
    const current = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    let prev: Record<string, unknown> = {};
    try { prev = JSON.parse(current.settingsJson || '{}') as Record<string, unknown>; } catch { prev = {}; }
    await this.prisma.workspace.update({
      where: { id: this.tid() },
      data: { settingsJson: JSON.stringify({ ...prev, ...patch }) },
    });
  }

  /** Selaras MAT getLabaRugi: prioritas buku PNL (sheet Pengeluaran); else Kas berawalan Pengeluaran. */
  private hasPnlBook(cash: Array<{ account?: string | null }>) {
    return cash.some((c) => c.account === 'PNL');
  }

  private isRekapPengeluaran(
    e: { direction?: string | null; category?: string | null; account?: string | null },
    preferPnl = false,
  ): boolean {
    if (e.direction !== 'OUT') return false;
    if (preferPnl) return e.account === 'PNL';
    if (e.account === 'PNL') return false;
    const cat = String(e.category || '').trim();
    if (!cat) return false;
    if (/^pengeluaran/i.test(cat)) return true;
    const ledger = new Set(['Pembelian', 'Pelunasan Hutang', 'Penjualan', 'Pelunasan Piutang']);
    return !ledger.has(cat);
  }

  private remainingDue(t: {
    status: string;
    total: Prisma.Decimal | number | null | undefined;
    paidAmount?: Prisma.Decimal | number | null | undefined;
  }): number {
    if (!['DUE', 'DP'].includes(t.status)) return 0;
    return Math.max(0, this.num(t.total) - this.num(t.paidAmount));
  }

  private buildInvoiceHtml(opts: {
    tenant: { name: string; address: string | null; phone: string | null; settingsJson?: string | null };
    invoice: { number: string; date: string; partner: string; items: any[]; total: number; paid: number; status: string };
  }) {
    const s = this.parseSettings(opts.tenant.settingsJson);
    const body = `
      <div class="head">
        <h1>INVOICE</h1>
        <div>${this.e(opts.invoice.number)}</div>
        <div>${this.e(opts.invoice.date)}</div>
      </div>
      <p>Mitra: ${this.e(opts.invoice.partner)}</p>
      <table>
        <thead><tr><th>Produk</th><th>Qty/Harga</th><th>Total</th></tr></thead>
        <tbody>
          ${opts.invoice.items.map(i => `
            <tr>
              <td>${this.e(i.productName)}</td>
              <td>${i.quantity} x ${i.price}</td>
              <td style="text-align:right">${i.nominal}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="tot" style="text-align:right">
        <div>Subtotal: ${opts.invoice.total}</div>
        <div>Status: ${this.e(opts.invoice.status)}</div>
      </div>
    `;
    return `<!DOCTYPE html><html><head><style>${this.thermalCss()}</style></head><body>
      <div class="thermal-container">
        <div class="head">
          <b>${this.e(opts.tenant.name)}</b><br/>
          <small>${this.e(opts.tenant.address || '')}</small><br/>
          <small>${this.e(opts.tenant.phone || '')}</small>
        </div>
        ${body}
        <div class="footer">Terima kasih atas kepercayaan Anda.</div>
      </div></body></html>`;
  }

  private buildSuratJalanHtml(opts: {
    tenant: { name: string; address: string | null; phone: string | null; settingsJson?: string | null };
    sj: { number: string; destination: string; items: any[] };
  }) {
    const body = `
      <div class="head"><h1>SURAT JALAN</h1></div>
      <p>Tujuan: ${this.e(opts.sj.destination)}</p>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Ket</th></tr></thead>
        <tbody>
          ${opts.sj.items.map(i => `<tr><td>${this.e(i.productName)}</td><td>${i.quantity}</td><td>${i.binNote || '-'}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
    return `<!DOCTYPE html><html><head><style>${this.thermalCss()}</style></head><body>
      <div class="thermal-container">
        <div class="head"><b>${this.e(opts.tenant.name)}</b></div>
        ${body}
        <div class="footer">Harap periksa barang sebelum diterima.</div>
      </div></body></html>`;
  }

  private buildOfficialDoc(opts: {
    tenant: { name: string; address: string | null; phone: string | null; settingsJson?: string | null };
    title: string;
    badge?: string;
    subjudul?: string;
    refItems?: Array<{ label: string; value: string; color?: string }>;
    infoItems?: Array<{ label: string; value: string }>;
    bodyHtml: string;
    note?: string;
    signatures?: Array<{ label: string; name: string }>;
    footer?: string;
  }) {
    const refs = (opts.refItems || []).map((r) =>
      `<div><span>${this.e(r.label)}</span><b style="color:${r.color || '#0D1B3D'}">${this.e(r.value || '—')}</b></div>`).join('');
    const infos = (opts.infoItems || []).map((i) =>
      `<div><label>${this.e(i.label)}</label><b>${this.e(i.value || '—')}</b></div>`).join('');
    const signs = (opts.signatures || [
      { label: 'Dibuat oleh', name: 'Admin' },
      { label: 'Diperiksa', name: '—' },
      { label: 'Penerima', name: '—' },
    ]).map((s) => `<div>${this.e(s.label)}<div class="line">${this.e(s.name || '—')}</div></div>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${this.e(opts.title)}</title>
<style>${this.docCss()}</style></head><body>
<div class="invoice-container">
${this.printHeaderHtml(opts.tenant)}
<div class="head">
  <div><h1>${this.e(opts.title)}</h1>${opts.subjudul ? `<div class="subjudul">${this.e(opts.subjudul)}</div>` : ''}</div>
  <div class="ref">${refs}</div>
</div>
${infos ? `<div class="info">${infos}</div>` : ''}
${opts.bodyHtml}
${opts.note ? `<p class="muted" style="margin-top:12px;font-style:italic">Keterangan: ${this.e(opts.note)}</p>` : ''}
<div class="sign">${signs}</div>
<div class="foot">${this.e(opts.footer || 'Dokumen resmi TUMBU · Cetak / Simpan sebagai PDF dari browser')}</div>
<button class="noprint" onclick="window.print()" style="margin-top:14px;padding:8px 14px;border-radius:8px;border:0;background:#0D1B3D;color:#fff;font-weight:600;cursor:pointer">Cetak / Simpan PDF</button>
</div>
</body></html>`;
  }

  private statusBadgeHtml(status: string) {
    const s = String(status || '').toUpperCase();
    if (s === 'PAID' || s === 'LUNAS') return '<span class="badge badge-ok">LUNAS</span>';
    if (s === 'DP') return '<span class="badge badge-dp">DP</span>';
    return '<span class="badge badge-due">BELUM LUNAS</span>';
  }

  private printHeaderHtml(tenant: { name: string; address: string | null; phone: string | null; settingsJson?: string | null }) {
    const s = this.parseSettings(tenant.settingsJson);
    return buildPrintLetterheadHtml(
      {
        name: tenant.name,
        address: tenant.address,
        phone: tenant.phone,
        logoUrl: s.logoUrl,
        letterheadUrl: s.letterheadUrl,
        letterheadMode: s.letterheadMode || 'template',
        tagline: s.tagline,
        bankName: s.bankName,
        bankAccount: s.bankAccount,
      },
      (v) => this.e(v),
    );
  }

  private async deleteCashForTx(tx: Prisma.TransactionClient, number: string) {
    const rows = await tx.cashEntry.findMany({ where: { tenantId: this.tid() } });
    const ids = rows
      .filter((e) => e.description === number || e.description.startsWith(`${number} ·`) || e.description.startsWith(`${number} `))
      .map((e) => e.id);
    if (ids.length) await this.prisma.cashEntry.deleteMany({ where: { id: { in: ids }, workspaceId: this.tid() } });
  }

  private async ensureProductBySizeLabel(
    labelRaw: string,
    priceHint?: number,
    opts: { commodityCategory?: string; species?: string } = {},
  ) {
    const label = String(labelRaw || '').trim();
    if (!label) throw new BadRequestException('Ukuran / produk wajib diisi.');
    const commodityCategory = normalizeCommodityCategory(
      opts.commodityCategory || 'BENIH',
    );
    const unit = unitForCommodity(commodityCategory);
    const species = String(opts.species || '').trim() || null;
    const defaultName = commodityCategory === 'IKAN_KONSUMSI'
      ? `${species || 'Ikan'} ${label}`.trim()
      : `Benih ${label}`;
    let product = await this.prisma.product.findFirst({
      where: {
        tenantId: this.tid(),
        OR: [
          { sizeLabel: label, commodityCategory },
          { sizeLabel: label },
          { name: label },
          { name: defaultName },
          { name: `Benih ${label}` },
        ],
      },
    });
    if (!product) {
      product = await this.prisma.product.create({
        data: {
          tenantId: this.tid(),
          name: defaultName,
          unit,
          commodityCategory,
          species,
          sizeLabel: label,
          price: Number.isFinite(Number(priceHint)) ? Number(priceHint) : 0,
          stock: 0,
          minStock: 0,
        },
      });
    } else {
      const patch: Prisma.ProductUpdateInput = {};
      if (!product.commodityCategory) patch.commodityCategory = commodityCategory;
      if (!product.species && species) patch.species = species;
      if (product.unit !== unit) patch.unit = unit;
      if (Object.keys(patch).length) {
        product = await this.prisma.product.update({ where: { id: product.id }, data: patch });
      }
    }
    const size = await this.prisma.size.findFirst({ where: { tenantId: this.tid(), label } });
    if (!size) {
      const max = await this.prisma.size.aggregate({ where: { tenantId: this.tid() }, _max: { sortOrder: true } });
      await this.prisma.size.create({
        data: { tenantId: this.tid(), label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
      });
    }
    return product;
  }

  /** Resolve productId dari productId atau sizeLabel (auto-buat SKU bila perlu). */
  private async resolveTxItemProducts(inputItems: TxItemInput[]): Promise<TxItemInput[]> {
    const resolved: TxItemInput[] = [];
    for (let idx = 0; idx < inputItems.length; idx++) {
      const item = inputItems[idx];
      const sizeLabel = String(item.sizeLabel || '').trim();
      const commodityCategory = item.commodityCategory
        ? normalizeCommodityCategory(item.commodityCategory)
        : undefined;
      const species = String(item.species || '').trim() || undefined;
      let productId = String(item.productId || '').trim();
      if (productId) {
        const exists = await this.prisma.product.findFirst({ where: { id: productId, tenantId: this.tid() } });
        if (!exists) {
          if (!sizeLabel) throw new BadRequestException(`Item #${idx + 1}: produk tidak ditemukan.`);
          productId = (await this.ensureProductBySizeLabel(sizeLabel, item.price, { commodityCategory, species })).id;
        } else if (commodityCategory || species) {
          await this.prisma.product.update({
            where: { id: exists.id },
            data: {
              ...(commodityCategory ? { commodityCategory, unit: unitForCommodity(commodityCategory) } : {}),
              ...(species ? { species } : {}),
            },
          });
        }
      } else if (sizeLabel) {
        productId = (await this.ensureProductBySizeLabel(sizeLabel, item.price, { commodityCategory, species })).id;
      } else {
        throw new BadRequestException(`Item #${idx + 1}: pilih produk/ukuran atau ketik ukuran.`);
      }
      resolved.push({
        ...item,
        productId,
        sizeLabel: sizeLabel || item.sizeLabel,
        commodityCategory,
        species,
      });
    }
    return resolved;
  }

  private prepareTxItems(
    inputItems: TxItemInput[],
    productMap: Map<string, {
      id: string; name: string; stock: Prisma.Decimal; price: Prisma.Decimal;
      sizeLabel?: string | null; unit?: string | null; commodityCategory?: string | null; species?: string | null;
    }>,
    type: 'SALE' | 'PURCHASE',
  ) {
    if (!inputItems.length) throw new BadRequestException('Minimal satu item wajib.');
    if (inputItems.length > 10) throw new BadRequestException('Maksimal 10 item per transaksi.');
    return inputItems.map((item, idx) => {
      const product = productMap.get(String(item.productId || ''));
      if (!product || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(`Item #${idx + 1} tidak valid.`);
      }
      const quantity = Number(item.quantity);
      const price = item.price != null && Number.isFinite(item.price) ? Number(item.price) : this.num(product.price);
      if (!(price >= 0)) throw new BadRequestException(`Harga item #${idx + 1} tidak valid.`);
      const subtotal = quantity * price;
      const flaseType = ['bonus', 'potongan'].includes(String(item.flaseType || '')) ? String(item.flaseType) : 'none';
      const flasePercent = Math.max(0, Number(item.flasePercent) || 0);
      const bonusQty = flaseType === 'bonus' ? Math.round(quantity * flasePercent / 100) : 0;
      const discountAmount = flaseType === 'potongan' ? Math.round(subtotal * flasePercent / 100) : 0;
      const nominal = Math.max(0, subtotal - discountAmount);
      const stockQty = quantity + bonusQty;
      const commodityCategory = normalizeCommodityCategory(
        item.commodityCategory || product.commodityCategory || inferCommodityFromUnit(product.unit),
      );
      const unit = unitForCommodity(commodityCategory);
      const species = String(item.species || product.species || '').trim() || undefined;
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        price,
        weight: Number(item.weight) || 0,
        sampling: Number(item.sampling) || 0,
        flaseType,
        flasePercent,
        bonusQty,
        discountAmount,
        sizeLabel: item.sizeLabel || product.sizeLabel || undefined,
        unit,
        species,
        commodityCategory,
        nominal,
        stockQty,
        product,
      };
    });
  }

  private buildFees(input: TransactionInput): Array<{ kind: string; label: string; amount: number }> {
    const fees: Array<{ kind: string; label: string; amount: number }> = [];
    if (Array.isArray(input.fees)) {
      for (const f of input.fees) {
        const amount = Number(f.amount) || 0;
        if (amount <= 0) continue;
        fees.push({
          kind: String(f.kind || 'OTHER'),
          label: String(f.label || f.kind || 'Biaya'),
          amount,
        });
      }
    }
    const pushNamed = (kind: string, label: string, amount?: number) => {
      const n = Number(amount) || 0;
      if (n > 0) fees.push({ kind, label, amount: n });
    };
    pushNamed('TRANSPORT', 'Transport', input.transport);
    pushNamed('BONGKAR', 'Jasa bongkar', input.jasaBongkar);
    pushNamed('SOPIR', 'Upah sopir', input.upahSopir);
    return fees;
  }

  private computeTxTotals(type: 'SALE' | 'PURCHASE', items: Array<{ nominal: number }>, fees: Array<{ amount: number }>, input: TransactionInput) {
    const goodsTotal = items.reduce((s, i) => s + i.nominal, 0);
    const feeAmount = fees.reduce((s, f) => s + f.amount, 0);
    const plasePercent = Math.max(0, Number(input.plasePercent) || 0);
    const plaseAmount = type === 'PURCHASE' ? Math.round(goodsTotal * plasePercent / 100) : 0;
    const priorDebt = type === 'PURCHASE' ? Math.max(0, Number(input.priorDebt) || 0) : 0;
    const discountAmount = items.reduce((s, i) => s + ((i as { discountAmount?: number }).discountAmount || 0), 0) + plaseAmount;
    let total = type === 'SALE'
      ? goodsTotal + feeAmount
      : Math.max(0, goodsTotal - plaseAmount) + priorDebt;

    const statusRaw = String(input.status || 'PAID').toUpperCase();
    let paidAmount = 0;
    let status: 'PAID' | 'DUE' = 'PAID';
    const dp = input.paidAmount != null ? Number(input.paidAmount) : Number(input.nominalDP) || 0;

    if (statusRaw === 'DUE' || statusRaw === 'HUTANG' || statusRaw === 'PIUTANG') {
      status = 'DUE';
      paidAmount = 0;
    } else if (statusRaw === 'DP' || (dp > 0 && dp < total - 0.001)) {
      status = 'DUE';
      paidAmount = Math.min(Math.max(0, dp), total);
      if (paidAmount + 0.001 >= total) {
        status = 'PAID';
        paidAmount = total;
      }
    } else {
      status = 'PAID';
      paidAmount = total;
    }

    return {
      goodsTotal, feeAmount, plasePercent, plaseAmount, priorDebt, discountAmount, total, paidAmount, status,
    };
  }

  private mapTransaction(
    t: {
      id: string; number: string; date: Date; type: string; partner: string; total: Prisma.Decimal;
      paidAmount: Prisma.Decimal; status: string; notes?: string | null; account?: string | null;
      baId?: string | null; discountAmount?: Prisma.Decimal | null; feeAmount?: Prisma.Decimal | null;
      metaJson?: string | null;
      items: Array<{
        productId: string; quantity: Prisma.Decimal; price: Prisma.Decimal;
        weight?: Prisma.Decimal | null; sampling?: Prisma.Decimal | null; flaseType?: string | null;
        flasePercent?: Prisma.Decimal | null; bonusQty?: Prisma.Decimal | null; discountAmount?: Prisma.Decimal | null;
        sizeLabel?: string | null; unit?: string | null; species?: string | null; commodityCategory?: string | null;
      }>;
      fees?: Array<{ id: string; kind: string; label: string; amount: Prisma.Decimal }>;
    },
    pmap?: Map<string, { name: string; sizeLabel?: string | null; unit?: string | null; species?: string | null; commodityCategory?: string | null }>,
  ) {
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(t.metaJson || '{}') as Record<string, unknown>; } catch { meta = {}; }
    return {
      id: t.id,
      number: t.number,
      date: t.date.toISOString(),
      type: t.type as 'SALE' | 'PURCHASE',
      partner: t.partner,
      total: this.num(t.total),
      paidAmount: this.num(t.paidAmount),
      remaining: Math.max(0, this.num(t.total) - this.num(t.paidAmount)),
      status: t.status as 'PAID' | 'DUE',
      notes: t.notes || '',
      account: (t.account || 'CASH') as 'CASH' | 'BANK',
      baId: t.baId || undefined,
      discountAmount: this.num(t.discountAmount),
      feeAmount: this.num(t.feeAmount),
      meta,
      fees: (t.fees || []).map((f) => ({ id: f.id, kind: f.kind, label: f.label, amount: this.num(f.amount) })),
      items: t.items.map((i) => {
        const p = pmap?.get(i.productId);
        const commodityCategory = normalizeCommodityCategory(
          i.commodityCategory || p?.commodityCategory || inferCommodityFromUnit(i.unit || p?.unit),
        );
        const unit = i.unit || unitForCommodity(commodityCategory);
        const quantity = this.num(i.quantity);
        return {
          productId: i.productId,
          productName: p?.name || i.productId,
          sizeLabel: i.sizeLabel || p?.sizeLabel || undefined,
          quantity,
          unit,
          unitLabel: unitLabelForCommodity(commodityCategory),
          quantityText: formatQtyWithUnit(quantity, commodityCategory),
          species: i.species || p?.species || undefined,
          commodityCategory,
          price: this.num(i.price),
          weight: this.num(i.weight),
          sampling: this.num(i.sampling),
          flaseType: i.flaseType || 'none',
          flasePercent: this.num(i.flasePercent),
          bonusQty: this.num(i.bonusQty),
          discountAmount: this.num(i.discountAmount),
        };
      }),
    };
  }

  async dashboard() {
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const settings = this.parseSettings(tenant.settingsJson);
    const openingCash = Number(settings.openingCash) || 0;
    const openingBank = Number(settings.openingBank) || 0;
    const transactions = await this.prisma.transaction.findMany({ where: { tenantId: this.tid() }, orderBy: { date: 'desc' }, take: 8, include: { items: true } });
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const cashEntries = await this.prisma.cashEntry.findMany({ where: { tenantId: this.tid() } });
    const allTx = await this.prisma.transaction.findMany({ where: { tenantId: this.tid() }, include: { items: true } });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const inMonth = (d: Date) => d >= monthStart && d <= monthEnd;
    const inPrevMonth = (d: Date) => d >= prevMonthStart && d <= prevMonthEnd;
    const pctChange = (cur: number, prev: number) => {
      if (prev === 0) return cur === 0 ? 0 : 100;
      return Math.round(((cur - prev) / Math.abs(prev)) * 100);
    };

    const salesAll = allTx.filter((t) => t.type === 'SALE').reduce((s, t) => s + this.num(t.total), 0);
    const purchasesAll = allTx.filter((t) => t.type === 'PURCHASE').reduce((s, t) => s + this.num(t.total), 0);
    const purchaseRows = allTx.filter((t) => t.type === 'PURCHASE' && inMonth(t.date));
    const saleRows = allTx.filter((t) => t.type === 'SALE' && inMonth(t.date));
    const sales = saleRows.reduce((s, t) => s + this.num(t.total), 0);
    const purchases = purchaseRows.reduce((s, t) => s + this.num(t.total), 0);
    const cashMut = cashEntries
      .filter((e) => (e.account || 'CASH') !== 'BANK' && e.account !== 'PNL')
      .reduce((s, e) => s + (e.direction === 'IN' ? this.num(e.amount) : -this.num(e.amount)), 0);
    const bankMut = cashEntries
      .filter((e) => e.account === 'BANK')
      .reduce((s, e) => s + (e.direction === 'IN' ? this.num(e.amount) : -this.num(e.amount)), 0);
    const cashOnly = openingCash + cashMut;
    const bankBalance = openingBank + bankMut;
    const cashBalance = cashOnly + bankBalance;
    const receivables = allTx.reduce((s, t) => (t.type === 'SALE' ? s + this.remainingDue(t) : s), 0);
    const payables = allTx.reduce((s, t) => (t.type === 'PURCHASE' ? s + this.remainingDue(t) : s), 0);
    const preferPnl = this.hasPnlBook(cashEntries);
    const expenseRows = cashEntries.filter((e) => this.isRekapPengeluaran(e, preferPnl) && inMonth(e.date));
    const expensesAll = cashEntries.filter((e) => this.isRekapPengeluaran(e, preferPnl))
      .reduce((s, e) => s + this.num(e.amount), 0);
    const expenses = expenseRows.reduce((s, e) => s + this.num(e.amount), 0);
    const rugiBulan = await this.nominalRugiDitahanUntukRentang(monthStart, monthEnd);
    const labaBulan = sales - purchases - expenses - rugiBulan;

    const prevPurchases = allTx.filter((t) => t.type === 'PURCHASE' && inPrevMonth(t.date)).reduce((s, t) => s + this.num(t.total), 0);
    const prevSales = allTx.filter((t) => t.type === 'SALE' && inPrevMonth(t.date)).reduce((s, t) => s + this.num(t.total), 0);
    const prevExpenses = cashEntries
      .filter((e) => this.isRekapPengeluaran(e, this.hasPnlBook(cashEntries)) && inPrevMonth(e.date))
      .reduce((s, e) => s + this.num(e.amount), 0);
    const prevRugi = await this.nominalRugiDitahanUntukRentang(prevMonthStart, prevMonthEnd);
    const prevLaba = prevSales - prevPurchases - prevExpenses - prevRugi;

    const lowStock = products.filter((p) => this.num(p.stock) <= this.num(p.minStock));

    const stockIn = new Map<string, number>();
    const stockOut = new Map<string, number>();
    for (const t of allTx) {
      for (const i of t.items) {
        const q = this.num(i.quantity);
        if (t.type === 'PURCHASE') stockIn.set(i.productId, (stockIn.get(i.productId) || 0) + q);
        else stockOut.set(i.productId, (stockOut.get(i.productId) || 0) + q);
      }
    }
    const stockRows = products.map((p) => {
      const mapped = this.mapProduct(p);
      return {
        id: p.id,
        name: p.name,
        sizeLabel: p.sizeLabel,
        unit: mapped.unit,
        unitLabel: mapped.unitLabel,
        commodityCategory: mapped.commodityCategory,
        masuk: stockIn.get(p.id) || 0,
        keluar: stockOut.get(p.id) || 0,
        akhir: this.num(p.stock),
      };
    });

    /** Agregasi terpisah per UOM — jangan campur ekor + kg. */
    const totalStokBenih = stockRows
      .filter((r) => r.commodityCategory === 'BENIH')
      .reduce((s, r) => s + r.akhir, 0);
    const totalStokKonsumsi = stockRows
      .filter((r) => r.commodityCategory === 'IKAN_KONSUMSI')
      .reduce((s, r) => s + r.akhir, 0);
    const totalStok = totalStokBenih;

    const stockAvailable = [...stockRows]
      .filter((r) => r.akhir > 0)
      .sort((a, b) => b.akhir - a.akhir)
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        name: formatStockSkuName(r.name, r.sizeLabel),
        qty: r.akhir,
        unit: r.unitLabel || (r.unit === 'kg' ? 'Kg' : 'Ekor'),
        commodityCategory: r.commodityCategory,
      }));

    const custMap = new Map<string, { name: string; count: number; total: number }>();
    for (const t of allTx.filter((x) => x.type === 'SALE')) {
      const cur = custMap.get(t.partner) || { name: t.partner, count: 0, total: 0 };
      cur.count += 1;
      cur.total += this.num(t.total);
      custMap.set(t.partner, cur);
    }
    const topCustomers = [...custMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    const trend: Array<{ tanggal: string; pembelian: number; penjualan: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      const onDay = (d: Date) => d >= dayStart && d <= dayEnd;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      trend.push({
        tanggal: `${day.getDate()} ${months[day.getMonth()]}`,
        pembelian: allTx.filter((t) => t.type === 'PURCHASE' && onDay(t.date)).reduce((s, t) => s + this.num(t.total), 0),
        penjualan: allTx.filter((t) => t.type === 'SALE' && onDay(t.date)).reduce((s, t) => s + this.num(t.total), 0),
      });
    }

    const recentActivity = [...allTx]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        number: t.number,
        type: t.type,
        partner: t.partner,
        total: this.num(t.total),
        status: t.status,
        date: t.date.toISOString(),
        title: t.type === 'SALE' ? `Pesanan baru dari ${t.partner}` : `Pembelian dari ${t.partner}`,
        badge: t.type === 'SALE' ? 'Penjualan' : 'Pembelian',
      }));

    return {
      tenant: {
        name: tenant.name,
        blueprint: tenant.blueprint,
        logoUrl: settings.logoUrl || '',
        tagline: settings.tagline || '',
      },
      alurKerjaHariIni: 'Berita Acara → Pembelian → Stok → Penjualan → Surat Jalan → Kas / Piutang',
      totalStok,
      totalStokBenih,
      totalStokKonsumsi,
      bulanIni: {
        pembelian: purchases,
        penjualan: sales,
        pengeluaran: expenses,
        laba: labaBulan,
        pembelianCount: purchaseRows.length,
        penjualanCount: saleRows.length,
        pengeluaranCount: expenseRows.length,
        pembelianPct: pctChange(purchases, prevPurchases),
        penjualanPct: pctChange(sales, prevSales),
        pengeluaranPct: pctChange(expenses, prevExpenses),
        labaPct: pctChange(labaBulan, prevLaba),
      },
      metrics: {
        sales, purchases, expenses, laba: labaBulan,
        salesAll, purchasesAll, expensesAll,
        cashBalance, cashOnly, bankBalance, receivables, payables,
        modalBersih: cashBalance - payables + receivables,
        openingCash, openingBank,
      },
      lowStock: lowStock.map((p) => this.mapProduct(p)),
      topCustomers,
      stockRows,
      stockAvailable,
      trend,
      recentActivity,
      recentTransactions: transactions.map((t) => ({
        number: t.number,
        type: t.type,
        partner: t.partner,
        total: this.num(t.total),
        status: t.status,
      })),
    };
  }

  private mapProduct(p: {
    id: string; name: string; unit: string; stock: Prisma.Decimal; minStock: Prisma.Decimal; price: Prisma.Decimal;
    sizeLabel?: string | null; commodityCategory?: string | null; species?: string | null;
  }) {
    // Prefer unit-based infer when unit clearly konsumsi (soft migrate legacy rows with default BENIH).
    const fromUnit = inferCommodityFromUnit(p.unit);
    const commodityCategory = fromUnit === 'IKAN_KONSUMSI'
      ? 'IKAN_KONSUMSI'
      : normalizeCommodityCategory(p.commodityCategory || 'BENIH');
    const unit = unitForCommodity(commodityCategory);
    return {
      id: p.id,
      name: p.name,
      unit,
      unitLabel: unitLabelForCommodity(commodityCategory),
      stock: this.num(p.stock),
      minStock: this.num(p.minStock),
      price: this.num(p.price),
      sizeLabel: p.sizeLabel ?? undefined,
      commodityCategory,
      commodityLabel: commodityCategory === 'IKAN_KONSUMSI' ? 'Ikan Konsumsi' : 'Benih',
      species: p.species ?? undefined,
    };
  }

  async listFisheryCommodityOptions() {
    return {
      categories: COMMODITY_CATEGORIES,
      species: [...FISH_SPECIES_OPTIONS],
    };
  }

  async listProducts() {
    const rows = await this.prisma.product.findMany({ where: { tenantId: this.tid() }, orderBy: { name: 'asc' } });
    return rows.map((p) => this.mapProduct(p));
  }

  async createProduct(input: ProductInput = {}) {
    if (!input.name || !Number.isFinite(input.price)) throw new BadRequestException('Nama dan harga wajib diisi.');
    const commodityCategory = normalizeCommodityCategory(
      input.commodityCategory || inferCommodityFromUnit(input.unit),
    );
    const unit = unitForCommodity(commodityCategory);
    const species = String(input.species || '').trim() || null;
    const sizeLabel = String(input.sizeLabel || '').trim() || null;
    const product = await this.prisma.product.create({
      data: {
        tenantId: this.tid(),
        name: input.name,
        unit,
        commodityCategory,
        species,
        stock: input.stock ?? 0,
        minStock: input.minStock ?? 0,
        price: input.price,
        sizeLabel,
      },
    });
    return this.mapProduct(product);
  }

  async listPartners(type?: 'CUSTOMER' | 'SUPPLIER') {
    const rows = await this.prisma.partner.findMany({
      where: { tenantId: this.tid(), ...(type ? { type } : {}) },
      orderBy: { name: 'asc' },
    });
    return rows.map((p) => ({ id: p.id, name: p.name, phone: p.phone ?? undefined, type: p.type as 'CUSTOMER' | 'SUPPLIER' }));
  }

  async createPartner(input: PartnerInput & { address?: string; notes?: string } = {}) {
    if (!input.name || !input.type || !['CUSTOMER', 'SUPPLIER'].includes(input.type)) throw new BadRequestException('Nama dan tipe partner wajib diisi.');
    const partner = await this.prisma.partner.create({
      data: {
        tenantId: this.tid(), name: input.name, phone: input.phone, type: input.type,
        address: input.address || null, notes: input.notes || null,
      },
    });
    return {
      id: partner.id, name: partner.name, phone: partner.phone ?? undefined,
      address: partner.address ?? undefined, notes: partner.notes ?? undefined,
      type: partner.type as 'CUSTOMER' | 'SUPPLIER',
    };
  }

  kategoriPengeluaran() {
    return [...KATEGORI_PENGELUARAN];
  }

  private mapCash(e: {
    id: string; number: string | null; date: Date; category: string; description: string;
    amount: Prisma.Decimal; direction: string; account: string;
  }) {
    return {
      id: e.id,
      number: e.number || undefined,
      date: e.date.toISOString(),
      category: e.category,
      description: e.description,
      amount: this.num(e.amount),
      direction: e.direction as 'IN' | 'OUT',
      account: e.account || 'CASH',
    };
  }

  async listCash() {
    const rows = await this.prisma.cashEntry.findMany({ where: { tenantId: this.tid() }, orderBy: { date: 'desc' } });
    return rows.map((e) => this.mapCash(e));
  }

  async createCash(input: CashInput = {}) {
    const category = String(input.category || '').trim() || 'Lain-lain';
    const description = String(input.description || '').trim() || category;
    if (!input.direction || !Number.isFinite(input.amount) || Number(input.amount) <= 0) {
      throw new BadRequestException('Arah dan nominal positif wajib diisi.');
    }
    const date = input.date ? new Date(input.date) : new Date();
    await this.assertPeriodOpen(date);
    const number = input.direction === 'OUT' ? await this.nextDocNumber('OUT', 'OUT') : undefined;
    const entry = await this.prisma.cashEntry.create({
      data: {
        tenantId: this.tid(),
        number,
        date,
        category,
        description,
        amount: input.amount!,
        direction: input.direction,
        account: input.account === 'BANK' ? 'BANK' : 'CASH',
      },
    });
    return this.mapCash(entry);
  }

  async createCashFromSync(input: CashInput, idempotencyKey: string, serverVersion: number = 1) {
    const category = String(input.category || '').trim() || 'Lain-lain';
    const description = String(input.description || '').trim() || category;
    
    const amount = Number(input.amount);
    if (!input.direction || isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Arah dan nominal positif wajib diisi.');
    }
    
    const date = input.date ? new Date(input.date) : new Date();
    await this.assertPeriodOpen(date);
    const number = input.direction === 'OUT' ? await this.nextDocNumber('OUT', 'OUT') : undefined;
    
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashEntry.create({
        data: {
          tenantId: this.tid(),
          number,
          date,
          category,
          description,
          amount: amount,
          direction: input.direction as string,
          account: input.account === 'BANK' ? 'BANK' : 'CASH',
        },
      });

      const res = { id: idempotencyKey, status: 'SYNCED', serverVersion };
      await tx.syncIdempotency.update({
        where: { tenantId_idempotencyKey: { tenantId: this.tid(), idempotencyKey } },
        data: {
          status: 'SYNCED',
          response: JSON.stringify(res),
        }
      });

      return created;
    });

    return this.mapCash(entry);
  }

  async createCashBatch(input: { entries?: CashInput[]; date?: string } = {}) {
    if (!Array.isArray(input.entries) || !input.entries.length) throw new BadRequestException('Minimal satu baris pengeluaran.');
    const created: Array<{
      id: string; number?: string; date: string; category: string; description: string;
      amount: number; direction: 'IN' | 'OUT'; account: string;
    }> = [];
    for (const row of input.entries) {
      created.push(await this.createCash({
        ...row,
        date: row.date || input.date,
        direction: row.direction || 'OUT',
        category: row.category || 'Lain-lain',
        description: row.description || row.category || 'Lain-lain',
      }));
    }
    return { ok: true, count: created.length, entries: created };
  }

  async updateCash(input: CashInput = {}) {
    if (!input.id) throw new BadRequestException('ID entri kas wajib.');
    const existing = await this.prisma.cashEntry.findFirst({ where: { id: input.id, tenantId: this.tid() } });
    if (!existing) throw new NotFoundException('Entri kas tidak ditemukan.');
    const lockedCats = ['Pembelian', 'Pelunasan Hutang', 'Penjualan', 'Pelunasan Piutang'];
    if (lockedCats.includes(existing.category)) {
      throw new BadRequestException(
        `Entri otomatis (${existing.category}) tidak bisa diedit di sini. Ubah lewat transaksi terkait.`,
      );
    }
    const date = input.date ? new Date(input.date) : existing.date;
    await this.assertPeriodOpen(existing.date);
    await this.assertPeriodOpen(date);
    const amount = Number.isFinite(input.amount) ? Number(input.amount) : this.num(existing.amount);
    if (amount <= 0) throw new BadRequestException('Nominal harus positif.');
    const direction = input.direction === 'IN' || input.direction === 'OUT' ? input.direction : existing.direction;
    const category = String(input.category || existing.category).trim() || 'Lain-lain';
    const description = String(input.description ?? existing.description).trim() || category;
    const entry = await this.prisma.cashEntry.update({
      where: { id: existing.id },
      data: {
        date,
        category,
        description,
        amount,
        direction,
        account: input.account === 'BANK' ? 'BANK' : (input.account === 'CASH' ? 'CASH' : existing.account),
      },
    });
    return this.mapCash(entry);
  }

  async deleteCash(input: { id?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID entri kas wajib.');
    const existing = await this.prisma.cashEntry.findFirst({ where: { id: input.id, tenantId: this.tid() } });
    if (!existing) throw new NotFoundException('Entri kas tidak ditemukan.');
    const lockedCats = ['Pembelian', 'Pelunasan Hutang', 'Penjualan', 'Pelunasan Piutang'];
    if (lockedCats.includes(existing.category)) {
      throw new BadRequestException(
        `Entri otomatis (${existing.category}) tidak bisa dihapus di sini. Batalkan lewat transaksi terkait.`,
      );
    }
    await this.assertPeriodOpen(existing.date);
    await this.prisma.cashEntry.delete({ where: { id: existing.id } });
    return { ok: true, id: existing.id };
  }

  private resolveRentangPengeluaran(input: RekapPengeluaranInput = {}) {
    const mode = input.mode === 'rentang' ? 'rentang' : 'bulan';
    if (mode === 'rentang') {
      const dariStr = input.dari || input.from;
      const sampaiStr = input.sampai || input.to;
      if (!dariStr || !sampaiStr) throw new BadRequestException('Tanggal awal dan akhir wajib untuk mode rentang.');
      const from = new Date(dariStr);
      const to = new Date(sampaiStr);
      to.setHours(23, 59, 59, 999);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('Tanggal rekap tidak valid.');
      return {
        from,
        to,
        label: `${from.toLocaleDateString('id-ID')} — ${to.toLocaleDateString('id-ID')}`,
      };
    }
    const periode = input.periode || (input.from ? String(input.from).slice(0, 7) : new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(periode)) throw new BadRequestException('Periode bulan harus format YYYY-MM.');
    const [y, m] = periode.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59, 999);
    const label = from.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return { from, to, label };
  }

  async rekapPengeluaran(input: RekapPengeluaranInput = {}) {
    const rentang = this.resolveRentangPengeluaran(input);
    const preferPnl = await this.prisma.cashEntry.count({
      where: { tenantId: this.tid(), account: 'PNL' },
    }) > 0;
    const cash = await this.prisma.cashEntry.findMany({
      where: preferPnl
        ? {
            tenantId: this.tid(),
            date: { gte: rentang.from, lte: rentang.to },
            direction: 'OUT',
            account: 'PNL',
          }
        : {
            tenantId: this.tid(),
            date: { gte: rentang.from, lte: rentang.to },
            direction: 'OUT',
            NOT: {
              OR: [
                { category: { in: ['Pembelian', 'Pelunasan Hutang'] } },
                { account: 'PNL' },
              ],
            },
          },
      orderBy: { date: 'asc' },
    });
    const perKategori: Record<string, number> = {};
    let total = 0;
    let totalKas = 0;
    let totalBank = 0;
    for (const c of cash) {
      const nom = this.num(c.amount);
      const kat = c.category || 'Lain-lain';
      perKategori[kat] = (perKategori[kat] || 0) + nom;
      total += nom;
      if ((c.account || 'CASH') === 'BANK') totalBank += nom;
      else totalKas += nom;
    }
    return {
      labelPeriode: rentang.label,
      dari: rentang.from.toISOString().slice(0, 10),
      sampai: rentang.to.toISOString().slice(0, 10),
      jumlah: cash.length,
      total,
      totalKas,
      totalBank,
      keterangan: input.keterangan || '',
      rincianKategori: Object.keys(perKategori).sort().map((kategori) => ({ kategori, nominal: perKategori[kategori] })),
      entries: cash.map((c) => this.mapCash(c)),
    };
  }

  async listTransactions(type?: 'SALE' | 'PURCHASE') {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId: this.tid(), ...(type ? { type } : {}) },
      include: { items: true, fees: true },
      orderBy: { date: 'desc' },
    });
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const pmap = new Map(products.map((p) => [p.id, p]));
    return rows.map((t) => this.mapTransaction(t, pmap));
  }

  /**
   * Applies (or reverses) the inventory effect of a business transaction.
   * SALE deductions use a conditional update so the availability check and
   * decrement are one database operation, even when requests overlap.
   */
  private async deductStockFIFO(productId: string, requiredQty: number, tx: Prisma.TransactionClient) {
    // Fetch batches ordered by expiry (FIFO) where remainingQty > 0
    const batches = await tx.inventoryBatch.findMany({
      where: { productId, tenantId: this.tid(), remainingQty: { gt: 0 } },
      orderBy: { expiredDate: 'asc' },
    });

    let remaining = requiredQty;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.remainingQty, remaining);
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { remainingQty: { decrement: deduct } },
      });
      remaining -= deduct;
    }
    if (remaining > 0) {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId: this.tid() } });
      const name = product?.name || productId;
      throw new BadRequestException(`Stok tidak mencukupi untuk produk ${name}.`);
    }
  }

  public async createDraftDeliveryOrderFromSale(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { items: true, partner: true },
      });

      if (!transaction || transaction.type !== 'SALE_OUT') {
        throw new BadRequestException(`Transaction ${transactionId} is not a valid SALE_OUT transaction.`);
      }

      // Deduct FIFO stock for each item
      for (const item of transaction.items) {
        await this.deductStockFIFO(item.productId, item.quantity, tx);
      }

      // Generate Delivery Order number
      const doNumber = await this.nextDocNumber('DELIVERY_ORDER', 'SJ');

      // Create DeliveryOrder with lines
      const deliveryOrder = await tx.deliveryOrder.create({
        data: {
          workspaceId: transaction.workspaceId,
          transactionId: transaction.id,
          partnerId: transaction.partnerId,
          doNumber,
          status: 'DRAFT',
          lines: {
            create: transaction.items.map((it) => ({
              productId: it.productId,
              qty: it.quantity,
              uom: it.product?.unit ?? 'KG',
              price: it.unitPrice,
              subtotal: it.subtotal,
            })),
          },
        },
        include: { lines: true },
      });

      return deliveryOrder;
    });
  }

  private async _executeTransactionWrite(
    tx: Prisma.TransactionClient,
    input: TransactionInput,
    resolved: {
      items: ReturnType<ErpService['prepareTxItems']>;
      fees: TxFeeInput[];
      calc: ReturnType<ErpService['computeTxTotals']>;
      number: string;
      date: Date;
      account: 'CASH' | 'BANK';
      meta: any;
    },
    syncHooks?: { tenantId: string; idempotencyKey: string; serverVersion: number }
  ) {
    await this.applyTransactionStock(tx, input.type!, resolved.items, 'APPLY');

    const created = await tx.transaction.create({
      data: {
        tenantId: syncHooks ? syncHooks.tenantId : this.tid(),
        number: resolved.number,
        date: resolved.date,
        type: input.type!,
        partner: input.partner!,
        total: resolved.calc.total,
        paidAmount: resolved.calc.paidAmount,
        status: resolved.calc.status,
        notes: input.notes || null,
        account: resolved.account,
        baId: input.baId || null,
        discountAmount: resolved.calc.discountAmount,
        feeAmount: resolved.calc.feeAmount,
        metaJson: JSON.stringify(resolved.meta),
        items: {
          create: resolved.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            weight: i.weight,
            sampling: i.sampling,
            flaseType: i.flaseType,
            flasePercent: i.flasePercent,
            bonusQty: i.bonusQty,
            discountAmount: i.discountAmount,
            sizeLabel: i.sizeLabel,
            unit: i.unit,
            species: i.species || null,
            commodityCategory: i.commodityCategory,
          })),
        },
        fees: resolved.fees.length ? { 
          create: resolved.fees.map(f => ({
            kind: f.kind || '',
            label: f.label || '',
            amount: f.amount || 0
          })) 
        } : undefined,
      },
      include: { items: true, fees: true },
    });

    if (resolved.calc.paidAmount > 0) {
      await tx.cashEntry.create({
        data: {
          tenantId: syncHooks ? syncHooks.tenantId : this.tid(),
          date: resolved.date,
          category: input.type === 'SALE'
            ? (resolved.calc.status === 'PAID' ? 'Penjualan' : 'Pelunasan Piutang')
            : (resolved.calc.status === 'PAID' ? 'Pembelian' : 'Pelunasan Hutang'),
          description: resolved.calc.status === 'PAID' ? resolved.number : `${resolved.number} · ${input.partner}${resolved.calc.status === 'DUE' ? ' (DP)' : ''}`,
          amount: resolved.calc.paidAmount,
          direction: input.type === 'SALE' ? 'IN' : 'OUT',
          account: resolved.account,
        },
      });
    }

    if (input.type === 'PURCHASE' && resolved.calc.feeAmount > 0 && resolved.calc.paidAmount > 0) {
      await tx.cashEntry.create({
        data: {
          tenantId: syncHooks ? syncHooks.tenantId : this.tid(),
          date: resolved.date,
          category: 'Biaya PO',
          description: `${resolved.number} · biaya operasional`,
          amount: resolved.calc.feeAmount,
          direction: 'OUT',
          account: resolved.account,
        },
      });
    }

    if (input.baId && input.type === 'PURCHASE') {
      await tx.beritaAcara.updateMany({
        where: { id: input.baId, tenantId: syncHooks ? syncHooks.tenantId : this.tid() },
        data: { status: 'IMPORTED', purchaseId: created.id },
      });
    }

    if (input.notes === 'CRASH_SIMULATION') {
      const err = new Error('Simulated hard crash');
      err.name = 'HardCrashError';
      throw err;
    }

    if (syncHooks) {
      const res = { id: syncHooks.idempotencyKey, status: 'SYNCED', serverVersion: syncHooks.serverVersion };
      await tx.syncIdempotency.update({
        where: { tenantId_idempotencyKey: { tenantId: syncHooks.tenantId, idempotencyKey: syncHooks.idempotencyKey } },
        data: {
          status: 'SYNCED',
          response: JSON.stringify(res),
        },
      });
    }

    // After transaction persisted, handle FIFO stock deduction and draft DeliveryOrder for SALE_OUT
    if (resolved.calc.type === 'SALE_OUT' || input.type === 'SALE') {
      // Use the same transaction context to ensure atomicity
      await this.createDraftDeliveryOrderFromSale(created.id, tx);
    }
    return created;
  }

  async createTransaction(input: TransactionInput = {}) {
    if (!input.type || !input.partner || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Tipe, partner, dan minimal satu item wajib diisi.');
    }
    const date = input.date ? new Date(input.date) : new Date();
    await this.assertPeriodOpen(date);

    const resolvedItems = await this.resolveTxItemProducts(input.items);
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = this.prepareTxItems(resolvedItems, productMap, input.type);
    const fees = this.buildFees(input);
    const calc = this.computeTxTotals(input.type, items, fees, input);
    const account = input.account === 'BANK' ? 'BANK' : 'CASH';
    const prefix = input.type === 'SALE' ? 'SLS' : 'PUR';
    const number = await this.nextDocNumber(input.type, prefix);
    const meta = {
      plasePercent: calc.plasePercent,
      plaseAmount: calc.plaseAmount,
      priorDebt: calc.priorDebt,
      priorDebtRef: input.priorDebtRef || '',
      partnerPhone: input.partnerPhone || '',
      partnerAddress: input.partnerAddress || '',
      transport: Number(input.transport) || 0,
      jasaBongkar: Number(input.jasaBongkar) || 0,
      upahSopir: Number(input.upahSopir) || 0,
    };

    const partnerType = input.type === 'SALE' ? 'CUSTOMER' : 'SUPPLIER';
    await this.upsertPartnerQuick(input.partner, partnerType, input.partnerPhone, input.partnerAddress);

    const transaction = await this.prisma.$transaction(async (tx) => {
      return this._executeTransactionWrite(tx, input, {
        items, fees, calc, number, date, account, meta
      });
    });

    const products2 = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    return this.mapTransaction(transaction as any, new Map(products2.map((p) => [p.id, p])));
  }

  async createTransactionFromSync(input: TransactionInput, idempotencyKey: string, serverVersion: number) {
    if (!input.type || !input.partner || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Tipe, partner, dan minimal satu item wajib diisi.');
    }
    const date = input.date ? new Date(input.date) : new Date();
    await this.assertPeriodOpen(date);

    const resolvedItems = await this.resolveTxItemProducts(input.items);
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = this.prepareTxItems(resolvedItems, productMap, input.type);
    const fees = this.buildFees(input);
    const calc = this.computeTxTotals(input.type, items, fees, input);
    const account = input.account === 'BANK' ? 'BANK' : 'CASH';
    const prefix = input.type === 'SALE' ? 'SLS' : 'PUR';
    const number = await this.nextDocNumber(input.type, prefix);
    const meta = {
      plasePercent: calc.plasePercent,
      plaseAmount: calc.plaseAmount,
      priorDebt: calc.priorDebt,
      priorDebtRef: input.priorDebtRef || '',
      partnerPhone: input.partnerPhone || '',
      partnerAddress: input.partnerAddress || '',
      transport: Number(input.transport) || 0,
      jasaBongkar: Number(input.jasaBongkar) || 0,
      upahSopir: Number(input.upahSopir) || 0,
    };

    const partnerType = input.type === 'SALE' ? 'CUSTOMER' : 'SUPPLIER';
    await this.upsertPartnerQuick(input.partner, partnerType, input.partnerPhone, input.partnerAddress);

    await this.prisma.$transaction(async (tx) => {
      await this._executeTransactionWrite(tx, input, {
        items, fees, calc, number, date, account, meta
      }, { tenantId: this.tid(), idempotencyKey, serverVersion });
    });

    return { id: idempotencyKey, status: 'SYNCED', serverVersion };
  }

  private async upsertPartnerQuick(name: string, type: 'CUSTOMER' | 'SUPPLIER', phone?: string, address?: string) {
    const existing = await this.prisma.partner.findFirst({ where: { tenantId: this.tid(), name, type } });
    if (existing) {
      if (phone || address) {
        await this.prisma.partner.update({
          where: { id: existing.id },
          data: {
            ...(phone ? { phone } : {}),
            ...(address ? { address } : {}),
          },
        });
      }
      return;
    }
    await this.prisma.partner.create({
      data: { tenantId: this.tid(), name, type, phone: phone || null, address: address || null },
    });
  }

  async updateTransaction(input: TransactionInput & { id?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID transaksi wajib.');
    if (!input.partner || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Partner dan minimal satu item wajib diisi.');
    }
    const existing = await this.prisma.transaction.findFirst({
      where: { id: input.id, tenantId: this.tid() },
      include: { items: true, fees: true },
    });
    if (!existing) throw new NotFoundException('Transaksi tidak ditemukan.');
    const date = input.date ? new Date(input.date) : existing.date;
    await this.assertPeriodOpen(existing.date);
    await this.assertPeriodOpen(date);

    const type = existing.type as 'SALE' | 'PURCHASE';
    const resolvedItems = await this.resolveTxItemProducts(input.items);
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = this.prepareTxItems(resolvedItems, productMap, type);
    const fees = this.buildFees(input);
    const calc = this.computeTxTotals(type, items, fees, {
      ...input,
      status: input.status || (this.num(existing.paidAmount) > 0 && this.num(existing.paidAmount) < this.num(existing.total) ? 'DP' : existing.status),
      paidAmount: input.paidAmount != null ? input.paidAmount : (input.nominalDP != null ? input.nominalDP : this.num(existing.paidAmount)),
    });
    const account = input.account === 'BANK' ? 'BANK' : (existing.account === 'BANK' ? 'BANK' : 'CASH');
    const meta = {
      plasePercent: calc.plasePercent,
      plaseAmount: calc.plaseAmount,
      priorDebt: calc.priorDebt,
      priorDebtRef: input.priorDebtRef || '',
      partnerPhone: input.partnerPhone || '',
      partnerAddress: input.partnerAddress || '',
      transport: Number(input.transport) || 0,
      jasaBongkar: Number(input.jasaBongkar) || 0,
      upahSopir: Number(input.upahSopir) || 0,
    };

    await this.upsertPartnerQuick(input.partner, type === 'SALE' ? 'CUSTOMER' : 'SUPPLIER', input.partnerPhone, input.partnerAddress);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.applyTransactionStock(tx, type, existing.items.filter((old) => !!old.productId).map((old) => ({
        productId: old.productId!,
        stockQty: this.num(old.quantity) + this.num(old.bonusQty),
      })), 'REVERSE');
      await this.deleteCashForTx(tx, existing.number);

      await tx.transactionItem.deleteMany({ where: { transactionId: existing.id } });
      await tx.transactionFee.deleteMany({ where: { transactionId: existing.id } });

      await this.applyTransactionStock(tx, type, items, 'APPLY');

      const row = await tx.transaction.update({
        where: { id: existing.id },
        data: {
          partner: input.partner!,
          date,
          total: calc.total,
          paidAmount: calc.paidAmount,
          status: calc.status,
          notes: input.notes !== undefined ? (input.notes || null) : existing.notes,
          account,
          discountAmount: calc.discountAmount,
          feeAmount: calc.feeAmount,
          metaJson: JSON.stringify(meta),
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
              weight: i.weight,
              sampling: i.sampling,
              flaseType: i.flaseType,
              flasePercent: i.flasePercent,
              bonusQty: i.bonusQty,
              discountAmount: i.discountAmount,
              sizeLabel: i.sizeLabel,
              unit: i.unit,
              species: i.species || null,
              commodityCategory: i.commodityCategory,
            })),
          },
          fees: fees.length ? { create: fees } : undefined,
        },
        include: { items: true, fees: true },
      });

      if (calc.paidAmount > 0) {
        await tx.cashEntry.create({
          data: {
            tenantId: this.tid(),
            date,
            category: type === 'SALE'
              ? (calc.status === 'PAID' ? 'Penjualan' : 'Pelunasan Piutang')
              : (calc.status === 'PAID' ? 'Pembelian' : 'Pelunasan Hutang'),
            description: calc.status === 'PAID' ? existing.number : `${existing.number} · ${row.partner}${calc.status === 'DUE' ? ' (DP)' : ''}`,
            amount: calc.paidAmount,
            direction: type === 'SALE' ? 'IN' : 'OUT',
            account,
          },
        });
      }
      if (type === 'PURCHASE' && calc.feeAmount > 0 && calc.paidAmount > 0) {
        await tx.cashEntry.create({
          data: {
            tenantId: this.tid(),
            date,
            category: 'Biaya PO',
            description: `${existing.number} · biaya operasional`,
            amount: calc.feeAmount,
            direction: 'OUT',
            account,
          },
        });
      }

      return row;
    });

    return this.mapTransaction(updated, productMap);
  }

  async deleteTransaction(input: { id?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID transaksi wajib.');
    const existing = await this.prisma.transaction.findFirst({
      where: { id: input.id, tenantId: this.tid() },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Transaksi tidak ditemukan.');
    await this.assertPeriodOpen(existing.date);

    await this.prisma.$transaction(async (tx) => {
      await this.applyTransactionStock(tx, existing.type as 'SALE' | 'PURCHASE', existing.items.filter((old) => !!old.productId).map((old) => ({
        productId: old.productId!,
        stockQty: this.num(old.quantity) + this.num(old.bonusQty),
      })), 'REVERSE');
      await this.deleteCashForTx(tx, existing.number);
      await tx.suratJalan.updateMany({
        where: { tenantId: this.tid(), saleRef: existing.number },
        data: { saleRef: null },
      });
      if (existing.type === 'PURCHASE') {
        await tx.beritaAcara.updateMany({
          where: {
            tenantId: this.tid(),
            OR: [{ purchaseId: existing.id }, ...(existing.baId ? [{ id: existing.baId }] : [])],
          },
          data: { status: 'DRAFT', purchaseId: null },
        });
      }
      await tx.transaction.delete({ where: { id: existing.id } });
    });
    return { ok: true, number: existing.number };
  }

  async adjustStock(input: { productId?: string; physicalQty?: number; note?: string } = {}) {
    if (!input.productId || !Number.isFinite(input.physicalQty)) throw new BadRequestException('Produk dan stok fisik wajib.');
    const product = await this.prisma.product.findFirst({ where: { id: input.productId, tenantId: this.tid() } });
    if (!product) throw new BadRequestException('Produk tidak ditemukan.');
    const physical = Number(input.physicalQty);
    if (physical < 0) throw new BadRequestException('Stok fisik tidak boleh negatif.');
    const before = this.num(product.stock);
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: { stock: physical },
    });
    return {
      ...this.mapProduct(updated),
      adjustment: { before, after: physical, delta: physical - before, note: input.note || '' },
    };
  }

  async payTransaction(input: { id?: string; account?: 'CASH' | 'BANK'; amount?: number } = {}) {
    if (!input.id) throw new BadRequestException('ID transaksi wajib.');
    const row = await this.prisma.transaction.findFirst({ where: { id: input.id, tenantId: this.tid() } });
    if (!row) throw new BadRequestException('Transaksi tidak ditemukan.');
    if (row.status === 'PAID') throw new BadRequestException('Transaksi sudah lunas.');
    const already = this.num(row.paidAmount);
    const remaining = Math.max(0, this.num(row.total) - already);
    const payAmount = input.amount != null ? Number(input.amount) : remaining;
    if (!Number.isFinite(payAmount) || payAmount <= 0) throw new BadRequestException('Nominal pembayaran tidak valid.');
    if (payAmount > remaining + 0.001) throw new BadRequestException(`Nominal melebihi sisa tagihan (${remaining}).`);
    await this.assertPeriodOpen();
    const account = input.account === 'BANK' ? 'BANK' : 'CASH';
    const nextPaid = already + payAmount;
    const nextStatus = nextPaid + 0.001 >= this.num(row.total) ? 'PAID' : 'DUE';
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: row.id },
        data: { paidAmount: nextPaid, status: nextStatus },
      });
      await tx.cashEntry.create({
        data: {
          tenantId: this.tid(),
          date: new Date(),
          category: row.type === 'SALE' ? 'Pelunasan Piutang' : 'Pelunasan Hutang',
          description: `${row.number} · ${row.partner}${nextStatus === 'DUE' ? ' (cicilan)' : ''}`,
          amount: payAmount,
          direction: row.type === 'SALE' ? 'IN' : 'OUT',
          account,
        },
      });
    });
    return this.listTransactions(row.type as 'SALE' | 'PURCHASE');
  }

  async importBaToPurchase(input: { baId?: string; status?: 'PAID' | 'DUE'; account?: 'CASH' | 'BANK' } = {}) {
    if (!input.baId) throw new BadRequestException('ID Berita Acara wajib.');
    const ba = await this.prisma.beritaAcara.findFirst({
      where: { id: input.baId, tenantId: this.tid() },
      include: { lines: true },
    });
    if (!ba) throw new BadRequestException('Berita Acara tidak ditemukan.');
    if (!ba.lines.length) throw new BadRequestException('BA tidak memiliki baris.');
    const items: Array<{ productId: string; quantity: number; price: number }> = [];
    for (const line of ba.lines) {
      const label = line.sizeLabel;
      let product = await this.prisma.product.findFirst({
        where: { tenantId: this.tid(), OR: [{ sizeLabel: label }, { name: { contains: label } }] },
      });
      if (!product) {
        product = await this.prisma.product.create({
          data: {
            tenantId: this.tid(),
            name: `Benih ${label}`,
            unit: 'ekor',
            sizeLabel: label,
            price: this.num(line.price) || 0,
            stock: 0,
            minStock: 0,
          },
        });
      }
      items.push({
        productId: product.id,
        quantity: this.num(line.quantity),
        price: this.num(line.price) || this.num(product.price),
      });
    }
    return this.createTransaction({
      type: 'PURCHASE',
      partner: ba.supplier,
      status: input.status === 'PAID' ? 'PAID' : 'DUE',
      account: input.account,
      items,
      baId: ba.id,
    });
  }

  async previewBaToPurchase(input: { baId?: string } = {}) {
    if (!input.baId) throw new BadRequestException('ID Berita Acara wajib.');
    const ba = await this.prisma.beritaAcara.findFirst({
      where: { id: input.baId, tenantId: this.tid() },
      include: { lines: true },
    });
    if (!ba) throw new BadRequestException('Berita Acara tidak ditemukan.');
    const items: Array<{ productId: string; productName: string; sizeLabel?: string; quantity: number; price: number }> = [];
    for (const line of ba.lines) {
      const label = line.sizeLabel;
      const qty = this.num(line.quantity);
      if (qty <= 0) continue;
      let product = await this.prisma.product.findFirst({
        where: { tenantId: this.tid(), OR: [{ sizeLabel: label }, { name: { contains: label } }] },
      });
      if (!product) {
        product = await this.prisma.product.create({
          data: {
            tenantId: this.tid(),
            name: `Benih ${label}`,
            unit: 'ekor',
            sizeLabel: label,
            price: this.num(line.price) || 0,
            stock: 0,
            minStock: 0,
          },
        });
      }
      items.push({
        productId: product.id,
        productName: product.name,
        sizeLabel: product.sizeLabel ?? label,
        quantity: qty,
        price: this.num(line.price) || this.num(product.price),
      });
    }
    if (!items.length) throw new BadRequestException('BA tidak memiliki qty aktual.');
    return {
      baId: ba.id,
      baNumber: ba.number,
      partner: ba.supplier,
      status: 'DUE' as const,
      items,
      // estimasi dari BA — pembayaran resmi tetap di form Pembelian
      plasePercent: this.num(ba.plasePercent),
      transport: this.num(ba.transport),
      jasaBongkar: this.num(ba.jasaBongkar),
      upahSopir: this.num(ba.upahSopir),
      dpNote: this.num(ba.dpNote),
      priorDebt: this.num(ba.priorDebtNote),
      priorDebtRef: ba.priorDebtRef || '',
      account: ba.payMethodNote === 'Bank' ? 'BANK' as const : 'CASH' as const,
      notes: ba.notes || `Dari BA ${ba.number}`,
    };
  }

  async createSize(input: { label?: string } = {}) {
    const label = String(input.label || '').trim();
    if (!label) throw new BadRequestException('Label ukuran wajib.');
    const max = await this.prisma.size.aggregate({ where: { tenantId: this.tid() }, _max: { sortOrder: true } });
    try {
      const row = await this.prisma.size.create({
        data: { tenantId: this.tid(), label, sortOrder: (max._max.sortOrder ?? 0) + 1 },
      });
      return { id: row.id, label: row.label, sortOrder: row.sortOrder };
    } catch {
      throw new BadRequestException('Ukuran sudah ada.');
    }
  }

  async report(input: { from?: string; to?: string; jenis?: string } = {}) {
    const from = input.from ? new Date(input.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = input.to ? new Date(input.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const jenis = String(input.jenis || 'SEMUA').toUpperCase();
    const tx = await this.prisma.transaction.findMany({
      where: { tenantId: this.tid(), date: { gte: from, lte: to } },
      include: { items: true },
      orderBy: { date: 'desc' },
    });
    const cash = await this.prisma.cashEntry.findMany({
      where: { tenantId: this.tid(), date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    });
    const sales = tx.filter((t) => t.type === 'SALE');
    const purchases = tx.filter((t) => t.type === 'PURCHASE');
    const sum = (rows: typeof tx) => rows.reduce((s, t) => s + this.num(t.total), 0);
    const cashIn = cash.filter((c) => c.direction === 'IN').reduce((s, c) => s + this.num(c.amount), 0);
    const cashOut = cash.filter((c) => c.direction === 'OUT').reduce((s, c) => s + this.num(c.amount), 0);
    const bankBal = (dir: string) => cash.filter((c) => c.account === 'BANK' && c.direction === dir).reduce((s, c) => s + this.num(c.amount), 0);
    const cashBal = (dir: string) => cash.filter((c) => (c.account || 'CASH') !== 'BANK' && c.account !== 'PNL' && c.direction === dir).reduce((s, c) => s + this.num(c.amount), 0);
    const mapTx = (t: (typeof tx)[0]) => ({
      number: t.number, partner: t.partner, total: this.num(t.total), status: t.status, date: t.date.toISOString(),
    });
    const mapCash = (c: (typeof cash)[0]) => ({
      date: c.date.toISOString(), category: c.category, description: c.description,
      amount: this.num(c.amount), account: c.account, direction: c.direction,
    });
    const preferPnl = this.hasPnlBook(cash);
    const expenses = cash.filter((c) => this.isRekapPengeluaran(c, preferPnl));
    const kasRows = cash.filter((c) => (c.account || 'CASH') !== 'BANK' && c.account !== 'PNL');
    const bankRows = cash.filter((c) => c.account === 'BANK');
    let detail: Array<Record<string, unknown>> = [];
    if (jenis === 'PJ' || jenis === 'PENJUALAN') detail = sales.map(mapTx);
    else if (jenis === 'PO' || jenis === 'PEMBELIAN') detail = purchases.map(mapTx);
    else if (jenis === 'OUT' || jenis === 'PENGELUARAN') detail = expenses.map(mapCash);
    else if (jenis === 'KAS') detail = kasRows.map(mapCash);
    else if (jenis === 'BANK') detail = bankRows.map(mapCash);
    else {
      detail = [
        ...sales.map((t) => ({ ...mapTx(t), jenis: 'PJ' })),
        ...purchases.map((t) => ({ ...mapTx(t), jenis: 'PO' })),
        ...expenses.map((c) => ({ ...mapCash(c), jenis: 'OUT' })),
      ];
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      jenis,
      salesTotal: sum(sales),
      purchaseTotal: sum(purchases),
      grossProfit: sum(sales) - sum(purchases),
      cashIn, cashOut,
      cashNet: cashBal('IN') - cashBal('OUT'),
      bankNet: bankBal('IN') - bankBal('OUT'),
      sales: sales.map(mapTx),
      purchases: purchases.map(mapTx),
      expenses: expenses.map(mapCash),
      kas: kasRows.map(mapCash),
      bank: bankRows.map(mapCash),
      detail,
    };
  }

  async listSizes() {
    const rows = await this.prisma.size.findMany({ where: { tenantId: this.tid() }, orderBy: { sortOrder: 'asc' } });
    return rows.map((s) => ({ id: s.id, label: s.label, sortOrder: s.sortOrder }));
  }

  private prepareBaLines(raw: BeritaAcaraLineInput[] = []) {
    if (!raw.length) throw new BadRequestException('Minimal harus ada 1 baris Bak/Ukuran.');
    if (raw.length > 30) throw new BadRequestException('Maksimal 30 baris Bak/Ukuran per Berita Acara.');
    return raw.map((it, idx) => {
      const binNote = String(it.binNote || it.bak || '').trim();
      const sizeLabel = String(it.sizeLabel || it.ukuran || '').trim();
      if (!binNote || !sizeLabel) throw new BadRequestException(`Baris #${idx + 1}: bak dan ukuran wajib.`);
      const qtyInitial = Number(it.qtyInitial ?? it.jumlahAwal ?? 0);
      const quantity = Number(it.quantity ?? it.jumlahAktual ?? 0);
      if (!(qtyInitial >= 0) || !(quantity >= 0)) throw new BadRequestException(`Baris #${idx + 1}: jumlah tidak valid.`);
      if (qtyInitial <= 0 && quantity <= 0) throw new BadRequestException(`Baris #${idx + 1}: isi jumlah awal atau aktual.`);
      const price = Math.max(0, Number(it.price ?? it.hargaEkor ?? 0) || 0);
      return { binNote, sizeLabel, qtyInitial, quantity, price, selisih: quantity - qtyInitial };
    });
  }

  private computeBaRingkas(lines: Array<{ qtyInitial: number; quantity: number; price: number; sizeLabel: string }>, input: BeritaAcaraInput) {
    const persenPlase = Number(input.plasePercent ?? input.persenPlase ?? 3) || 0;
    const perUkuran: Record<string, { qty: number; harga: number }> = {};
    for (const it of lines) {
      if (!perUkuran[it.sizeLabel]) perUkuran[it.sizeLabel] = { qty: 0, harga: it.price };
      perUkuran[it.sizeLabel].qty += it.quantity;
      if (it.price > 0) perUkuran[it.sizeLabel].harga = it.price;
    }
    let notaBenihAktual = 0;
    for (const p of Object.values(perUkuran)) notaBenihAktual += p.qty * p.harga;
    const totalPlase = Math.round(notaBenihAktual * persenPlase / 100);
    const transport = Math.max(0, Number(input.transport) || 0);
    const jasaBongkar = Math.max(0, Number(input.jasaBongkar) || 0);
    const upahSopir = Math.max(0, Number(input.upahSopir) || 0);
    const sisaPOSebelumnya = Math.max(0, Number(input.priorDebtNote ?? input.sisaPOSebelumnya) || 0);
    const dpDipakai = Math.max(0, Number(input.dpNote ?? input.dpDipakai) || 0);
    const totalTagihan = notaBenihAktual + sisaPOSebelumnya;
    const totalUangMasuk = dpDipakai + transport + jasaBongkar + upahSopir + totalPlase;
    const sisaPembayaran = totalTagihan - totalUangMasuk;
    const totalAwal = lines.reduce((s, it) => s + it.qtyInitial, 0);
    const totalAktual = lines.reduce((s, it) => s + it.quantity, 0);
    const selisihEkor = totalAktual - totalAwal;
    const persenPenyusutan = totalAwal > 0 ? ((totalAwal - totalAktual) / totalAwal) * 100 : 0;
    return {
      persenPlase, transport, jasaBongkar, upahSopir, sisaPOSebelumnya, dpDipakai,
      notaBenihAktual, totalPlase, totalTagihan, totalUangMasuk, sisaPembayaran,
      totalAwal, totalAktual, selisihEkor, persenPenyusutan,
      refPOSebelumnya: String(input.priorDebtRef || input.refPOSebelumnya || '').trim(),
      metodeBayar: String(input.payMethodNote || input.metodeBayar || 'Kas'),
    };
  }

  private mapBeritaAcara(ba: {
    id: string; number: string; date: Date; dateDepart: Date | null; supplier: string;
    refNumber: string | null; vehicle: string | null; pondLocation: string | null;
    checker: string | null; adminName: string | null; receiver: string | null;
    plasePercent: Prisma.Decimal; dpNote: Prisma.Decimal; transport: Prisma.Decimal;
    jasaBongkar: Prisma.Decimal; upahSopir: Prisma.Decimal; priorDebtNote: Prisma.Decimal;
    priorDebtRef: string | null; payMethodNote: string; notaAktual: Prisma.Decimal;
    totalPlase: Prisma.Decimal; totalTagihan: Prisma.Decimal; totalUangMasuk: Prisma.Decimal;
    sisaEstimasi: Prisma.Decimal; totalAwal: Prisma.Decimal; totalAktual: Prisma.Decimal;
    status: string; notes: string | null; purchaseId: string | null;
    lines: Array<{ binNote: string | null; sizeLabel: string; qtyInitial: Prisma.Decimal; quantity: Prisma.Decimal; price: Prisma.Decimal }>;
  }, purchaseNumber?: string | null, purchaseStatus?: string | null, purchaseRemaining?: number) {
    let statusLabel = 'Belum PO';
    if (ba.purchaseId || ba.status === 'IMPORTED') {
      if (purchaseStatus === 'PAID' || (purchaseRemaining != null && purchaseRemaining <= 0)) statusLabel = 'Lunas';
      else statusLabel = 'Belum Lunas';
    }
    return {
      id: ba.id, number: ba.number, date: ba.date.toISOString(),
      dateDepart: (ba.dateDepart || ba.date).toISOString(),
      supplier: ba.supplier, refNumber: ba.refNumber || '', vehicle: ba.vehicle || '',
      pondLocation: ba.pondLocation || '', checker: ba.checker || '', adminName: ba.adminName || '',
      receiver: ba.receiver || '', plasePercent: this.num(ba.plasePercent), dpNote: this.num(ba.dpNote),
      transport: this.num(ba.transport), jasaBongkar: this.num(ba.jasaBongkar), upahSopir: this.num(ba.upahSopir),
      priorDebtNote: this.num(ba.priorDebtNote), priorDebtRef: ba.priorDebtRef || '',
      payMethodNote: ba.payMethodNote || 'Kas', notaAktual: this.num(ba.notaAktual),
      totalPlase: this.num(ba.totalPlase), totalTagihan: this.num(ba.totalTagihan),
      totalUangMasuk: this.num(ba.totalUangMasuk), sisaEstimasi: this.num(ba.sisaEstimasi),
      totalAwal: this.num(ba.totalAwal), totalAktual: this.num(ba.totalAktual),
      status: ba.status, statusLabel, notes: ba.notes,
      purchaseId: ba.purchaseId ?? undefined, purchaseNumber: purchaseNumber || undefined,
      lines: ba.lines.map((l) => ({
        binNote: l.binNote || '', sizeLabel: l.sizeLabel,
        qtyInitial: this.num(l.qtyInitial), quantity: this.num(l.quantity), price: this.num(l.price),
        selisih: this.num(l.quantity) - this.num(l.qtyInitial),
      })),
    };
  }

  async listBeritaAcara() {
    const rows = await this.prisma.beritaAcara.findMany({
      where: { tenantId: this.tid() }, include: { lines: true }, orderBy: { date: 'desc' },
    });
    const purchaseIds = rows.map((r) => r.purchaseId).filter(Boolean) as string[];
    const purchases = purchaseIds.length
      ? await this.prisma.transaction.findMany({ where: { tenantId: this.tid(), id: { in: purchaseIds } } })
      : [];
    const pmap = new Map(purchases.map((p) => [p.id, p]));
    return rows.map((ba) => {
      const po = ba.purchaseId ? pmap.get(ba.purchaseId) : undefined;
      const remaining = po ? Math.max(0, this.num(po.total) - this.num(po.paidAmount)) : undefined;
      return this.mapBeritaAcara(ba, po?.number, po?.status, remaining);
    });
  }

  async listBaSisaNotes(input: { supplier?: string; excludeId?: string } = {}) {
    const supplier = String(input.supplier || '').trim().toLowerCase();
    if (!supplier) return [];
    const duePo = await this.prisma.transaction.findMany({
      where: { tenantId: this.tid(), type: 'PURCHASE', status: { in: ['DUE', 'DP'] } },
      orderBy: { date: 'desc' },
    });
    const poNotes = duePo.filter((p) => p.partner.trim().toLowerCase() === supplier).map((p) => {
      const sisa = Math.max(0, this.num(p.total) - this.num(p.paidAmount));
      return sisa > 0 ? {
        ref: p.number,
        label: `${p.number} · ${p.date.toLocaleDateString('id-ID')} · sisa ${sisa.toLocaleString('id-ID')}`,
        sisa, sumber: 'PO' as const,
      } : null;
    }).filter(Boolean);
    const bas = await this.prisma.beritaAcara.findMany({ where: { tenantId: this.tid() }, orderBy: { date: 'desc' } });
    const baNotes = bas.filter((b) => b.supplier.trim().toLowerCase() === supplier && b.id !== input.excludeId).map((b) => {
      const sisa = this.num(b.sisaEstimasi);
      return sisa > 0 ? {
        ref: b.number,
        label: `${b.number} · catatan · ${b.date.toLocaleDateString('id-ID')} · ${sisa.toLocaleString('id-ID')}`,
        sisa, sumber: 'BA_CATATAN' as const,
      } : null;
    }).filter(Boolean);
    return [...poNotes, ...baNotes];
  }

  private async syncPurchaseFromBa(purchaseId: string, ba: { supplier: string; notes: string | null }, lines: Array<{ sizeLabel: string; quantity: number; price: number }>) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: purchaseId, tenantId: this.tid(), type: 'PURCHASE' },
    });
    if (!existing) return;
    const items: TxItemInput[] = [];
    for (const line of lines) {
      if (line.quantity <= 0) continue;
      let product = await this.prisma.product.findFirst({
        where: { tenantId: this.tid(), OR: [{ sizeLabel: line.sizeLabel }, { name: { contains: line.sizeLabel } }] },
      });
      if (!product) {
        product = await this.prisma.product.create({
          data: {
            tenantId: this.tid(), name: `Benih ${line.sizeLabel}`, unit: 'ekor',
            sizeLabel: line.sizeLabel, price: line.price || 0, stock: 0, minStock: 0,
          },
        });
      }
      items.push({ productId: product.id, quantity: line.quantity, price: line.price || this.num(product.price) });
    }
    if (!items.length) return;
    await this.updateTransaction({
      id: existing.id, type: 'PURCHASE', partner: ba.supplier,
      status: existing.status as 'PAID' | 'DUE' | 'DP',
      account: existing.account === 'BANK' ? 'BANK' : 'CASH',
      notes: existing.notes || ba.notes || undefined,
      paidAmount: this.num(existing.paidAmount),
      date: existing.date.toISOString(),
      baId: existing.baId || undefined,
      items,
    });
  }

  async createBeritaAcara(input: BeritaAcaraInput = {}) {
    const supplier = String(input.supplier || '').trim();
    const checker = String(input.checker || '').trim();
    const adminName = String(input.adminName || input.admin || '').trim();
    if (!supplier) throw new BadRequestException('Supplier wajib diisi.');
    if (!checker || !adminName) throw new BadRequestException('Checker dan Admin wajib diisi.');
    const tanggalTiba = input.tanggalTiba || input.date || new Date().toISOString().slice(0, 10);
    const tanggalBerangkat = input.tanggalBerangkat || input.dateDepart || tanggalTiba;
    const date = new Date(tanggalTiba);
    await this.assertPeriodOpen(date);
    const lines = this.prepareBaLines(input.lines || input.items || []);
    const ringkas = this.computeBaRingkas(lines, input);
    const number = await this.nextDocNumber('BA', 'BA');
    const ba = await this.prisma.beritaAcara.create({
      data: {
        tenantId: this.tid(), number, date, dateDepart: new Date(tanggalBerangkat), supplier,
        refNumber: String(input.refNumber || input.noReferensi || '').trim() || null,
        vehicle: String(input.vehicle || input.kendaraan || '').trim() || null,
        pondLocation: String(input.pondLocation || input.lokasiKolam || '').trim() || null,
        checker, adminName,
        receiver: String(input.receiver || input.penerimaBarang || '').trim() || null,
        plasePercent: ringkas.persenPlase, dpNote: ringkas.dpDipakai, transport: ringkas.transport,
        jasaBongkar: ringkas.jasaBongkar, upahSopir: ringkas.upahSopir,
        priorDebtNote: ringkas.sisaPOSebelumnya, priorDebtRef: ringkas.refPOSebelumnya || null,
        payMethodNote: ringkas.metodeBayar === 'Bank' ? 'Bank' : 'Kas',
        notaAktual: ringkas.notaBenihAktual, totalPlase: ringkas.totalPlase,
        totalTagihan: ringkas.totalTagihan, totalUangMasuk: ringkas.totalUangMasuk,
        sisaEstimasi: ringkas.sisaPembayaran, totalAwal: ringkas.totalAwal, totalAktual: ringkas.totalAktual,
        status: 'DRAFT', notes: String(input.notes || input.keterangan || '').trim() || null,
        lines: { create: lines.map((l) => ({
          binNote: l.binNote, sizeLabel: l.sizeLabel, qtyInitial: l.qtyInitial, quantity: l.quantity, price: l.price,
        })) },
      },
      include: { lines: true },
    });
    return this.mapBeritaAcara(ba);
  }

  async updateBeritaAcara(input: BeritaAcaraInput = {}) {
    const id = input.id;
    const no = String(input.number || '').trim();
    if (!id && !no) throw new BadRequestException('ID atau nomor BA wajib.');
    const existing = await this.prisma.beritaAcara.findFirst({
      where: { tenantId: this.tid(), ...(id ? { id } : { number: no }) },
      include: { lines: true },
    });
    if (!existing) throw new NotFoundException('Berita Acara tidak ditemukan.');
    const supplier = String(input.supplier || existing.supplier).trim();
    const checker = String(input.checker || existing.checker || '').trim();
    const adminName = String(input.adminName || input.admin || existing.adminName || '').trim();
    if (!supplier || !checker || !adminName) throw new BadRequestException('Supplier, checker, dan admin wajib.');
    const tanggalTiba = input.tanggalTiba || input.date || existing.date.toISOString().slice(0, 10);
    const tanggalBerangkat = input.tanggalBerangkat || input.dateDepart
      || existing.dateDepart?.toISOString().slice(0, 10) || tanggalTiba;
    const date = new Date(tanggalTiba);
    await this.assertPeriodOpen(existing.date);
    await this.assertPeriodOpen(date);
    const lines = this.prepareBaLines(input.lines || input.items || []);
    const ringkas = this.computeBaRingkas(lines, {
      ...input,
      plasePercent: input.plasePercent ?? input.persenPlase ?? this.num(existing.plasePercent),
      dpNote: input.dpNote ?? input.dpDipakai ?? this.num(existing.dpNote),
      transport: input.transport ?? this.num(existing.transport),
      jasaBongkar: input.jasaBongkar ?? this.num(existing.jasaBongkar),
      upahSopir: input.upahSopir ?? this.num(existing.upahSopir),
      priorDebtNote: input.priorDebtNote ?? input.sisaPOSebelumnya ?? this.num(existing.priorDebtNote),
    });
    await this.prisma.beritaAcaraLine.deleteMany({ where: { beritaAcaraId: existing.id } });
    const ba = await this.prisma.beritaAcara.update({
      where: { id: existing.id },
      data: {
        date, dateDepart: new Date(tanggalBerangkat), supplier,
        refNumber: String(input.refNumber || input.noReferensi || existing.refNumber || '').trim() || null,
        vehicle: String(input.vehicle || input.kendaraan || existing.vehicle || '').trim() || null,
        pondLocation: String(input.pondLocation || input.lokasiKolam || existing.pondLocation || '').trim() || null,
        checker, adminName,
        receiver: String(input.receiver || input.penerimaBarang || existing.receiver || '').trim() || null,
        plasePercent: ringkas.persenPlase, dpNote: ringkas.dpDipakai, transport: ringkas.transport,
        jasaBongkar: ringkas.jasaBongkar, upahSopir: ringkas.upahSopir,
        priorDebtNote: ringkas.sisaPOSebelumnya, priorDebtRef: ringkas.refPOSebelumnya || null,
        payMethodNote: ringkas.metodeBayar === 'Bank' ? 'Bank' : 'Kas',
        notaAktual: ringkas.notaBenihAktual, totalPlase: ringkas.totalPlase,
        totalTagihan: ringkas.totalTagihan, totalUangMasuk: ringkas.totalUangMasuk,
        sisaEstimasi: ringkas.sisaPembayaran, totalAwal: ringkas.totalAwal, totalAktual: ringkas.totalAktual,
        notes: String(input.notes || input.keterangan || existing.notes || '').trim() || null,
        lines: { create: lines.map((l) => ({
          binNote: l.binNote, sizeLabel: l.sizeLabel, qtyInitial: l.qtyInitial, quantity: l.quantity, price: l.price,
        })) },
      },
      include: { lines: true },
    });
    if (existing.purchaseId) {
      try { await this.syncPurchaseFromBa(existing.purchaseId, ba, lines); } catch { /* keep BA save */ }
    }
    return this.mapBeritaAcara(ba);
  }

  private mapSuratJalan(sj: {
    id: string; number: string; date: Date; customer: string; saleRef: string | null;
    destination: string | null; vehicle: string | null; driver: string | null;
    status: string; notes: string | null;
    lines: Array<{ productName: string; sizeLabel: string | null; quantity: Prisma.Decimal; bagCount: Prisma.Decimal; binNote: string | null }>;
  }) {
    return {
      id: sj.id,
      number: sj.number,
      date: sj.date.toISOString(),
      customer: sj.customer,
      saleRef: sj.saleRef,
      destination: sj.destination || '',
      vehicle: sj.vehicle || '',
      driver: sj.driver || '',
      status: sj.status,
      notes: sj.notes,
      lines: sj.lines.map((l) => ({
        productName: l.productName,
        sizeLabel: l.sizeLabel,
        quantity: this.num(l.quantity),
        bagCount: this.num(l.bagCount),
        binNote: l.binNote || '',
      })),
    };
  }

  async listSuratJalan() {
    const rows = await this.prisma.suratJalan.findMany({
      where: { tenantId: this.tid() },
      include: { lines: true },
      orderBy: { date: 'desc' },
    });
    return rows.map((sj) => this.mapSuratJalan(sj));
  }

  async createSuratJalan(input: SuratJalanInput = {}) {
    if (!input.saleRef) throw new BadRequestException('Pilih transaksi penjualan terlebih dahulu.');
    if (!input.vehicle?.trim() || !input.driver?.trim()) {
      throw new BadRequestException('Kendaraan dan nama sopir wajib diisi.');
    }
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new BadRequestException('Minimal satu baris wajib diisi.');
    }
    if (input.lines.length > 30) throw new BadRequestException('Maksimal 30 baris per surat jalan.');

    const sale = await this.prisma.transaction.findFirst({
      where: { tenantId: this.tid(), type: 'SALE', OR: [{ number: input.saleRef }, { id: input.saleRef }] },
      include: { items: true },
    });
    if (!sale) throw new BadRequestException('Transaksi penjualan tidak ditemukan.');

    const date = input.date ? new Date(input.date) : new Date();
    await this.assertPeriodOpen(date);
    const customer = String(input.customer || sale.partner).trim();
    if (!customer) throw new BadRequestException('Pelanggan wajib diisi.');

    const lines = input.lines.map((l, idx) => {
      const productName = String(l.productName || '').trim() || String(l.sizeLabel || '').trim();
      const quantity = Number(l.quantity) || 0;
      const bagCount = Number(l.bagCount) || 0;
      if (!productName || quantity <= 0) throw new BadRequestException(`Baris ${idx + 1}: produk/ukuran dan qty wajib.`);
      if (bagCount < 0) throw new BadRequestException(`Baris ${idx + 1}: jumlah kantong tidak valid.`);
      return {
        productName,
        sizeLabel: l.sizeLabel || null,
        quantity,
        bagCount,
        binNote: l.binNote?.trim() || null,
      };
    });

    const number = await this.nextDocNumber('SJ', 'SJ');
    const sj = await this.prisma.suratJalan.create({
      data: {
        tenantId: this.tid(),
        number,
        date,
        customer,
        saleRef: sale.number,
        destination: input.destination?.trim() || null,
        vehicle: input.vehicle.trim(),
        driver: input.driver.trim(),
        status: input.status ?? 'ISSUED',
        notes: input.notes,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    return this.mapSuratJalan(sj);
  }

  async financeSummary(input: {
    dari?: string; sampai?: string; from?: string; to?: string;
  } = {}) {
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const settings = this.parseSettings(tenant.settingsJson);
    const openingCash = Number(settings.openingCash) || 0;
    const openingBank = Number(settings.openingBank) || 0;

    const dariStr = String(input.dari || input.from || '').trim();
    const sampaiStr = String(input.sampai || input.to || '').trim();
    let from: Date | null = dariStr ? new Date(dariStr) : null;
    let to: Date | null = sampaiStr ? new Date(sampaiStr) : null;
    if (to) to.setHours(23, 59, 59, 999);
    if (from && Number.isNaN(from.getTime())) from = null;
    if (to && Number.isNaN(to.getTime())) to = null;
    const inRange = (d: Date) => {
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    const allTx = await this.prisma.transaction.findMany({ where: { tenantId: this.tid() } });
    const cashEntries = await this.prisma.cashEntry.findMany({ where: { tenantId: this.tid() } });

    const txInPeriod = allTx.filter((t) => inRange(t.date));
    const cashInPeriod = cashEntries.filter((e) => inRange(e.date));

    const sales = txInPeriod.filter((t) => t.type === 'SALE').reduce((s, t) => s + this.num(t.total), 0);
    const purchases = txInPeriod.filter((t) => t.type === 'PURCHASE').reduce((s, t) => s + this.num(t.total), 0);
    const preferPnl = this.hasPnlBook(cashEntries);
    const expenses = cashInPeriod
      .filter((e) => this.isRekapPengeluaran(e, preferPnl))
      .reduce((s, e) => s + this.num(e.amount), 0);
    const labaKotor = sales - purchases;
    const labaOperasional = labaKotor - expenses;

    const rugiInfo = await this.bacaRugiDitahan();
    let rugiDitahan = 0;
    if (from && to) {
      rugiDitahan = await this.nominalRugiDitahanUntukRentang(from, to);
    } else {
      // Tanpa filter: tampilkan rugi ditahan aktif (sama pola Apps Script getLabaRugi tanpa rentang ketat sumber)
      rugiDitahan = Math.max(0, Number(rugiInfo.nominal) || 0);
    }
    const labaBersih = labaOperasional - rugiDitahan;
    const marginPersen = sales > 0 ? (labaBersih / sales) * 100 : 0;

    const cashMut = cashEntries
      .filter((e) => (e.account || 'CASH') !== 'BANK' && e.account !== 'PNL')
      .reduce((s, e) => s + (e.direction === 'IN' ? this.num(e.amount) : -this.num(e.amount)), 0);
    const bankMut = cashEntries
      .filter((e) => e.account === 'BANK')
      .reduce((s, e) => s + (e.direction === 'IN' ? this.num(e.amount) : -this.num(e.amount)), 0);
    const cashOnly = openingCash + cashMut;
    const bankBalance = openingBank + bankMut;
    const cashBalance = cashOnly + bankBalance;

    const receivables = allTx.filter((t) => t.type === 'SALE' && this.remainingDue(t) > 0);
    const payables = allTx.filter((t) => t.type === 'PURCHASE' && this.remainingDue(t) > 0);
    const mapDue = (t: typeof allTx[0]) => {
      const paid = this.num((t as { paidAmount?: Prisma.Decimal }).paidAmount);
      const total = this.num(t.total);
      return {
        id: t.id, number: t.number, partner: t.partner, total, paidAmount: paid,
        remaining: Math.max(0, total - paid), date: t.date.toISOString(), status: t.status,
        notes: String(t.notes || '').trim(),
      };
    };
    const totalPiutang = receivables.reduce((s, t) => s + Math.max(0, this.num(t.total) - this.num(t.paidAmount)), 0);
    const totalHutang = payables.reduce((s, t) => s + Math.max(0, this.num(t.total) - this.num(t.paidAmount)), 0);
    const modalBersih = cashBalance + totalPiutang - totalHutang;

    const labaRugi = {
      periode: {
        dari: from ? from.toISOString().slice(0, 10) : null,
        sampai: to ? to.toISOString().slice(0, 10) : null,
      },
      totalPenjualan: sales,
      totalPembelian: purchases,
      labaKotor,
      totalPengeluaran: expenses,
      labaOperasional,
      rugiDitahan,
      periodeRugiDitahan: rugiInfo.periode || '',
      keteranganRugiDitahan: rugiInfo.keterangan || '',
      labaBersih,
      marginPersen,
    };
    const posisi = {
      openingCash,
      openingBank,
      saldoKas: cashOnly,
      saldoBank: bankBalance,
      saldoTotal: cashBalance,
      totalPiutang,
      totalHutang,
      modalBersih,
    };

    return {
      // flat (kompatibel UI lama)
      sales,
      purchases,
      grossProfit: labaKotor,
      expenses,
      netProfit: labaBersih,
      labaKotor,
      labaOperasional,
      rugiDitahan,
      periodeRugiDitahan: rugiInfo.periode || '',
      keteranganRugiDitahan: rugiInfo.keterangan || '',
      labaBersih,
      marginPersen,
      openingCash,
      openingBank,
      cashBalance,
      cashOnly,
      bankBalance,
      modalBersih,
      receivables: receivables.map(mapDue),
      payables: payables.map(mapDue),
      labaRugi,
      posisi,
    };
  }

  async companySettings() {
    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const s = this.parseSettings(t.settingsJson);
    return {
      name: t.name, phone: t.phone ?? '', address: t.address ?? '', timezone: t.timezone, locale: t.locale, blueprint: t.blueprint,
      logoUrl: s.logoUrl || '', letterheadUrl: s.letterheadUrl || '',
      letterheadMode: s.letterheadMode || 'template',
      bankName: s.bankName || '', bankAccount: s.bankAccount || '',
      openingCash: s.openingCash || 0, openingBank: s.openingBank || 0,
      tagline: s.tagline || '', invoiceUraian: s.invoiceUraian || 'Benih',
    };
  }

  async updateCompanySettings(input: {
    name?: string; phone?: string; address?: string; timezone?: string; locale?: string;
    logoUrl?: string; letterheadUrl?: string; letterheadMode?: 'template' | 'custom';
    bankName?: string; bankAccount?: string;
    openingCash?: number; openingBank?: number;
    tagline?: string; invoiceUraian?: string;
  } = {}) {
    if (input.name !== undefined && !String(input.name).trim()) throw new BadRequestException('Nama perusahaan wajib diisi.');
    const current = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    // Merge into raw settingsJson so non-ERP namespaces (e.g. onboarding) survive.
    let rawPrev: Record<string, unknown> = {};
    try {
      rawPrev = JSON.parse(current.settingsJson || '{}') as Record<string, unknown>;
    } catch {
      rawPrev = {};
    }
    const prev = this.parseSettings(current.settingsJson);
    const nextSettings: Record<string, unknown> = {
      ...rawPrev,
      logoUrl: input.logoUrl !== undefined ? String(input.logoUrl).trim() : (prev.logoUrl || ''),
      letterheadUrl: input.letterheadUrl !== undefined ? String(input.letterheadUrl).trim() : (prev.letterheadUrl || ''),
      letterheadMode: input.letterheadMode === 'custom' || input.letterheadMode === 'template'
        ? input.letterheadMode
        : (prev.letterheadMode || 'template'),
      bankName: input.bankName !== undefined ? String(input.bankName).trim() : (prev.bankName || ''),
      bankAccount: input.bankAccount !== undefined ? String(input.bankAccount).trim() : (prev.bankAccount || ''),
      openingCash: input.openingCash !== undefined ? Number(input.openingCash) || 0 : (prev.openingCash || 0),
      openingBank: input.openingBank !== undefined ? Number(input.openingBank) || 0 : (prev.openingBank || 0),
      rugiDitahan: prev.rugiDitahan || Number(rawPrev.rugiDitahan) || 0,
      periodeRugiDitahan: prev.periodeRugiDitahan || String(rawPrev.periodeRugiDitahan || ''),
      keteranganRugiDitahan: prev.keteranganRugiDitahan || String(rawPrev.keteranganRugiDitahan || ''),
      tagline: input.tagline !== undefined ? String(input.tagline).trim() : (prev.tagline || ''),
      invoiceUraian: input.invoiceUraian !== undefined ? String(input.invoiceUraian).trim() : (prev.invoiceUraian || 'Benih'),
    };
    await this.prisma.workspace.update({
      where: { id: this.tid() },
      data: {
        ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
        ...(input.phone !== undefined ? { phone: String(input.phone).trim() || null } : {}),
        ...(input.address !== undefined ? { address: String(input.address).trim() || null } : {}),
        ...(input.timezone !== undefined ? { timezone: String(input.timezone).trim() || 'Asia/Jakarta' } : {}),
        ...(input.locale !== undefined ? { locale: String(input.locale).trim() || 'id-ID' } : {}),
        settingsJson: JSON.stringify(nextSettings),
      },
    });
    return this.companySettings();
  }

  /** Celah nomor dokumen di workspace (untuk audit P1). */
  async documentNumberGaps() {
    const [purchases, sales] = await Promise.all([
      this.prisma.transaction.findMany({ where: { tenantId: this.tid(), type: 'PURCHASE' }, select: { number: true } }),
      this.prisma.transaction.findMany({ where: { tenantId: this.tid(), type: 'SALE' }, select: { number: true } }),
    ]);
    return {
      purchaseGaps: findDocumentNumberGaps(purchases.map((r) => r.number)),
      saleGaps: findDocumentNumberGaps(sales.map((r) => r.number)),
    };
  }

  async listClosings() {
    const rows = await this.prisma.closingPeriod.findMany({ where: { tenantId: this.tid() }, orderBy: { periodYm: 'desc' } });
    return rows.map((r) => {
      let meta: { labaBersih?: number; saldoTotal?: number; userNote?: string } = {};
      try {
        if (r.notes && r.notes.trim().startsWith('{')) meta = JSON.parse(r.notes) as typeof meta;
      } catch { meta = {}; }
      const userNote = meta.userNote ?? (r.notes && !r.notes.trim().startsWith('{') ? r.notes : '');
      return {
        id: r.id,
        periodYm: r.periodYm,
        notes: userNote || null,
        labaBersih: Number(meta.labaBersih) || 0,
        saldoTotal: Number(meta.saldoTotal) || 0,
        closedAt: r.closedAt.toISOString(),
        closedBy: r.closedBy,
      };
    });
  }

  async closingStatus() {
    const rows = await this.listClosings();
    const now = new Date();
    const periodeBerjalan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return {
      periodeTertutupTerakhir: rows[0]?.periodYm || 'Belum pernah tutup buku',
      periodeBerjalan,
      riwayat: rows,
      rugiDitahan: await this.getRugiDitahan(),
    };
  }

  private async bacaRugiDitahan() {
    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const s = this.parseSettings(t.settingsJson);
    return {
      nominal: Math.max(0, Number(s.rugiDitahan) || 0),
      periode: String(s.periodeRugiDitahan || '').trim(),
      keterangan: String(s.keteranganRugiDitahan || '').trim(),
    };
  }

  async getRugiDitahan() {
    const info = await this.bacaRugiDitahan();
    const riwayat = await this.listClosings();
    let saranNominal = 0;
    let saranPeriode = '';
    if (riwayat.length && Number(riwayat[0].labaBersih) < 0) {
      saranNominal = Math.abs(Number(riwayat[0].labaBersih));
      saranPeriode = riwayat[0].periodYm;
    }
    return { ...info, saranNominal, saranPeriode };
  }

  private async nominalRugiDitahanUntukRentang(dari: Date, sampai: Date) {
    const info = await this.bacaRugiDitahan();
    const nom = Math.max(0, Number(info.nominal) || 0);
    if (!nom) return 0;
    const sumber = String(info.periode || '');
    if (sumber && /^\d{4}-\d{2}$/.test(sumber)) {
      const [y, m] = sumber.split('-').map(Number);
      const batasAkhir = new Date(y, m, 0, 23, 59, 59, 999);
      const dariIso = dari.toISOString().slice(0, 10);
      const sampaiIso = sampai.toISOString().slice(0, 10);
      const batasIso = batasAkhir.toISOString().slice(0, 10);
      // Tidak dibebankan ulang ke periode sumber (atau sebelumnya).
      if (dariIso <= batasIso && sampaiIso <= batasIso) return 0;
    }
    return nom;
  }

  async closingRekap(input: {
    periode?: string; dari?: string; sampai?: string; from?: string; to?: string;
  } = {}) {
    let from: Date;
    let to: Date;
    let labelPeriode: string;
    let periodYm = '';
    if (input.periode && /^\d{4}-\d{2}$/.test(String(input.periode).trim())) {
      periodYm = String(input.periode).trim();
      const [y, m] = periodYm.split('-').map(Number);
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 0, 23, 59, 59, 999);
      labelPeriode = periodYm;
    } else {
      const dari = String(input.dari || input.from || '').trim();
      const sampai = String(input.sampai || input.to || '').trim();
      if (!dari || !sampai) throw new BadRequestException('Pilih bulan atau lengkapi rentang tanggal.');
      from = new Date(dari);
      to = new Date(sampai);
      to.setHours(23, 59, 59, 999);
      if (from > to) throw new BadRequestException('Tanggal awal tidak boleh setelah tanggal akhir.');
      labelPeriode = `${from.toLocaleDateString('id-ID')} s/d ${to.toLocaleDateString('id-ID')}`;
    }
    const report = await this.report({ from: from.toISOString(), to: to.toISOString() });
    const expensesTotal = (report.expenses || []).reduce((s, e) => s + Number(e.amount), 0);
    const labaOperasional = Number(report.salesTotal) - Number(report.purchaseTotal) - expensesTotal;
    const rugiDitahan = await this.nominalRugiDitahanUntukRentang(from, to);
    const labaBersih = labaOperasional - rugiDitahan;
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const totalStok = products.reduce((s, p) => s + this.num(p.stock), 0);
    const finance = await this.financeSummary();
    const cashNetAll = Number(finance.cashOnly || 0);
    const bankNetAll = Number(finance.bankBalance || 0);
    return {
      labelPeriode,
      periode: labelPeriode,
      periodYm: periodYm || undefined,
      dari: from.toISOString(),
      sampai: to.toISOString(),
      sementara: true,
      totalPembelian: Number(report.purchaseTotal),
      totalPenjualan: Number(report.salesTotal),
      totalPengeluaran: expensesTotal,
      labaOperasional,
      rugiDitahan,
      labaBersih,
      cashNet: Number(report.cashNet),
      bankNet: Number(report.bankNet),
      saldoKas: cashNetAll,
      saldoBank: bankNetAll,
      saldoTotal: cashNetAll + bankNetAll,
      totalStok,
      totalPiutang: (finance.receivables || []).reduce((s, r) => s + Number(r.remaining || 0), 0),
      totalHutang: (finance.payables || []).reduce((s, r) => s + Number(r.remaining || 0), 0),
      jumlahPembelian: (report.purchases || []).length,
      jumlahPenjualan: (report.sales || []).length,
      jumlahPengeluaran: (report.expenses || []).length,
      alreadyClosed: periodYm
        ? !!(await this.prisma.closingPeriod.findUnique({
          where: { tenantId_periodYm: { tenantId: this.tid(), periodYm } },
        }))
        : false,
      // alias lama untuk UI existing
      salesTotal: Number(report.salesTotal),
      purchaseTotal: Number(report.purchaseTotal),
      expensesTotal,
    };
  }

  async closingPreview(input: { periodYm?: string } = {}) {
    const periodYm = String(input.periodYm || '').trim();
    if (!/^\d{4}-\d{2}$/.test(periodYm)) throw new BadRequestException('Periode wajib format YYYY-MM.');
    const rekap = await this.closingRekap({ periode: periodYm });
    return { ...rekap, periodYm };
  }

  async setRugiDitahan(input: {
    auto?: boolean; nominal?: number; periode?: string; keterangan?: string;
  } = {}) {
    let nominal = 0;
    let periode = String(input.periode || '').trim();
    let keterangan = String(input.keterangan || '').trim();
    if (input.auto === true || !(Number(input.nominal) > 0)) {
      const riwayat = await this.listClosings();
      if (!riwayat.length) throw new BadRequestException('Belum ada tutup buku. Tutup periode dulu, lalu bawa minusnya.');
      const terakhir = riwayat[0];
      const laba = Number(terakhir.labaBersih) || 0;
      if (!(laba < 0)) {
        throw new BadRequestException(
          `Tutup buku terakhir (${terakhir.periodYm}) tidak minus (laba Rp ${Math.round(laba).toLocaleString('id-ID')}). Tidak ada rugi untuk dibawa.`,
        );
      }
      nominal = Math.round(Math.abs(laba));
      periode = terakhir.periodYm;
      if (!keterangan) keterangan = `Rugi dibawa dari tutup buku ${periode}`;
    } else {
      nominal = Math.round(Number(input.nominal) || 0);
      if (!(nominal > 0)) throw new BadRequestException('Nominal rugi yang dibawa harus lebih dari 0.');
      if (!periode) {
        const status = await this.closingStatus();
        periode = status.periodeTertutupTerakhir !== 'Belum pernah tutup buku'
          ? status.periodeTertutupTerakhir
          : status.periodeBerjalan;
      }
      if (!keterangan) keterangan = `Rugi dibawa manual dari ${periode}`;
    }
    await this.patchTenantSettings({
      rugiDitahan: nominal,
      periodeRugiDitahan: periode,
      keteranganRugiDitahan: keterangan,
    });
    return {
      ok: true,
      pesan: `Rugi Rp ${nominal.toLocaleString('id-ID')} dari ${periode} dibawa ke periode berjalan.`,
      rugiDitahan: await this.getRugiDitahan(),
    };
  }

  async clearRugiDitahan() {
    await this.patchTenantSettings({
      rugiDitahan: 0,
      periodeRugiDitahan: '',
      keteranganRugiDitahan: '',
    });
    return { ok: true, pesan: 'Rugi ditahan dikosongkan.', rugiDitahan: await this.getRugiDitahan() };
  }

  async closePeriod(input: { periodYm?: string; notes?: string } = {}) {
    const periodYm = String(input.periodYm || '').trim();
    if (!/^\d{4}-\d{2}$/.test(periodYm)) throw new BadRequestException('Periode wajib format YYYY-MM.');
    const existing = await this.prisma.closingPeriod.findUnique({
      where: { tenantId_periodYm: { tenantId: this.tid(), periodYm } },
    });
    if (existing) throw new BadRequestException('Periode ini sudah ditutup.');
    const preview = await this.closingPreview({ periodYm });
    const notes = JSON.stringify({
      userNote: String(input.notes || '').trim(),
      labaBersih: preview.labaBersih,
      saldoTotal: preview.saldoTotal,
      totalPembelian: preview.totalPembelian,
      totalPenjualan: preview.totalPenjualan,
      totalPengeluaran: preview.totalPengeluaran,
      rugiDitahan: preview.rugiDitahan,
    });
    const row = await this.prisma.closingPeriod.create({
      data: { tenantId: this.tid(), periodYm, notes, closedBy: 'admin' },
    });
    return {
      id: row.id, periodYm: row.periodYm, notes: input.notes || null,
      closedAt: row.closedAt.toISOString(), closedBy: row.closedBy, preview,
      pesan: `Periode ${periodYm} berhasil ditutup.`,
    };
  }

  async reopenPeriod(input: { periodYm?: string; last?: boolean } = {}) {
    let periodYm = String(input.periodYm || '').trim();
    if (input.last || !periodYm) {
      const latest = await this.prisma.closingPeriod.findFirst({
        where: { tenantId: this.tid() },
        orderBy: { periodYm: 'desc' },
      });
      if (!latest) throw new BadRequestException('Belum ada riwayat tutup buku.');
      periodYm = latest.periodYm;
    }
    if (!/^\d{4}-\d{2}$/.test(periodYm)) throw new BadRequestException('Periode wajib format YYYY-MM.');
    const existing = await this.prisma.closingPeriod.findUnique({
      where: { tenantId_periodYm: { tenantId: this.tid(), periodYm } },
    });
    if (!existing) throw new BadRequestException('Periode ini belum ditutup.');
    await this.prisma.closingPeriod.delete({ where: { id: existing.id } });
    return { ok: true, periodYm, pesan: `Periode ${periodYm} berhasil dibuka kembali.` };
  }


  private buildRekapTujuhHalamanHtml(opts: {
    tenant: { name: string; address: string | null; phone: string | null; settingsJson?: string | null };
    rekap: {
      labelPeriode?: string; periodYm?: string; periode?: string;
      dari: string; sampai: string;
      totalPembelian: number; totalPenjualan: number; totalPengeluaran: number;
      labaOperasional: number; rugiDitahan: number; labaBersih: number;
      saldoKas: number; saldoBank: number; saldoTotal: number;
      totalStok: number; totalPiutang: number; totalHutang: number;
    };
    sementara: boolean;
    keterangan?: string;
    purchases: Array<{
      number: string; date: Date; partner: string; total: unknown; paidAmount?: unknown;
      status: string; notes?: string | null;
      items: Array<{ quantity: unknown }>;
    }>;
    sales: Array<{
      number: string; date: Date; partner: string; total: unknown; paidAmount?: unknown;
      status: string; notes?: string | null;
      items: Array<{ quantity: unknown }>;
    }>;
    cashOut: Array<{
      number?: string | null; date: Date; category: string; description: string;
      amount: unknown; account?: string | null;
    }>;
    payables: Array<{
      number: string; date: string; partner: string; total: number;
      paidAmount: number; remaining: number; status: string; notes?: string;
    }>;
    receivables: Array<{
      number: string; date: string; partner: string; total: number;
      paidAmount: number; remaining: number; status: string; notes?: string;
    }>;
  }) {
    const fmt = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
    const fmtDate = (d: Date | string) => {
      const x = d instanceof Date ? d : new Date(d);
      return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString('id-ID');
    };
    const fmtNum = (n: number) => Math.round(Number(n) || 0).toLocaleString('id-ID');
    const statusLabel = (s: string) => {
      const u = String(s || '').toUpperCase();
      if (u === 'PAID' || u === 'LUNAS') return 'Lunas';
      if (u === 'DP') return 'DP';
      return 'Belum lunas';
    };
    const ekorOf = (items: Array<{ quantity: unknown }>) =>
      items.reduce((s, it) => s + this.num(it.quantity as Prisma.Decimal), 0);
    const settings = this.parseSettings(opts.tenant.settingsJson);
    const r = opts.rekap;
    const dari = new Date(r.dari);
    const sampai = new Date(r.sampai);
    const periodeLabel = r.periodYm || r.labelPeriode || r.periode || '—';
    const rentangLabel = `${fmtDate(dari)} – ${fmtDate(sampai)}`;
    const dicetak = fmtDate(new Date());
    const tipe = opts.sementara ? 'Rekap Sementara' : 'Tutup Buku Resmi';
    const judulCover = opts.sementara ? 'Ringkasan Keuangan' : 'Tutup Buku';
    const subCover = opts.sementara
      ? 'Semua angka penting dalam satu halaman'
      : 'Laporan resmi penutupan periode';
    const labaKotor = Number(r.totalPenjualan) - Number(r.totalPembelian);
    const marginPersen = Number(r.totalPenjualan) > 0
      ? (Number(r.labaBersih) / Number(r.totalPenjualan)) * 100
      : 0;
    const modalBersih = (Number(r.saldoTotal) + Number(r.totalPiutang)) - Number(r.totalHutang);
    const periodeRugi = settings.periodeRugiDitahan || '';

    const pageCss = `
${this.docCss()}
.page{min-height:100vh;padding:0 0 24px;box-sizing:border-box;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.page .bar small{font-weight:600}
.sec-blue{border-bottom-color:#2563EB}
.modul{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:10px}
.modul h3{margin:0 0 8px;font-size:12px;color:#0D1B3D;border-bottom:2px solid #16A34A;padding-bottom:4px}
.modul .kanan h3{border-bottom-color:#2563EB}
.modul table{margin:0}
.modul td{border:1px solid #E5E7EB;padding:7px 8px;font-size:11.5px}
.modul td:last-child{text-align:right;font-weight:600;color:#0D1B3D;white-space:nowrap}
.modul tr.emph td{background:#F5F6F8;font-weight:700}
.ringkas{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #E5E7EB;background:#FAFBFC;margin:10px 0 12px}
.ringkas > div{padding:8px 10px;border-right:1px solid #E5E7EB;font-size:11px}
.ringkas > div:last-child{border-right:0}
.ringkas label{display:block;color:#9CA3AF;font-size:9px;text-transform:uppercase;margin-bottom:2px}
.ringkas b{color:#111827;font-size:12px}
.note-lampiran{text-align:center;color:#6B7280;font-size:10.5px;margin:16px 0 8px;font-style:italic}
.note-ket{background:#EFF6FF;border:1px solid #BFDBFE;padding:8px 10px;border-radius:4px;font-size:11px;color:#1E3A5F;margin-top:8px}
.lr td:first-child{width:62%}
.lr tr.total td{background:#F5F6F8;font-weight:700;color:#0D1B3D}
.page-foot{margin-top:20px;font-size:10px;color:#9CA3AF;text-align:center;border-top:1px solid #E5E7EB;padding-top:8px}
td.num,th.num{text-align:right;white-space:nowrap}
td.center,th.center{text-align:center}
@media print{
  body{padding:10mm}
  .page{min-height:auto;padding:0}
  button,.noprint{display:none!important}
}`;

    const headerBar = (hal: number) =>
      `<div class="bar"><strong>${this.e(opts.tenant.name)}</strong><small>Hal. ${hal} / 7</small></div>`;

    const pageHead = (
      hal: number,
      judul: string,
      sub: string,
      extraRefs: Array<{ label: string; value: string; color?: string }> = [],
      skipTenantBar = false,
    ) => {
      const refs = [
        { label: 'Periode', value: String(periodeLabel) },
        { label: 'Rentang', value: rentangLabel },
        { label: 'Dicetak', value: dicetak },
        ...extraRefs,
      ].map((x) =>
        `<div><span>${this.e(x.label)}</span><b style="color:${x.color || '#0D1B3D'}">${this.e(x.value)}</b></div>`).join('');
      const topBar = skipTenantBar ? '' : `${headerBar(hal)}
${(opts.tenant.phone || opts.tenant.address) ? `<div class="sub">${this.e([opts.tenant.phone, opts.tenant.address].filter(Boolean).join(' · '))}</div>` : ''}`;
      return `${topBar}
<div class="head">
  <div><h1>${this.e(judul)}</h1><div class="subjudul">${this.e(sub)}</div></div>
  <div class="ref">${refs}</div>
</div>`;
    };

    const ringkas3 = (items: Array<{ label: string; value: string }>) =>
      `<div class="ringkas">${items.map((i) =>
        `<div><label>${this.e(i.label)}</label><b>${this.e(i.value)}</b></div>`).join('')}</div>`;

    const tableHtml = (headers: string[], rows: string[][], moneyCols: number[] = [], numCols: number[] = []) => {
      const th = headers.map((h, i) => {
        const cls = moneyCols.includes(i) || numCols.includes(i) ? ' class="num"' : '';
        return `<th${cls}>${this.e(h)}</th>`;
      }).join('');
      const body = rows.length
        ? rows.map((row, ri) => {
          const bg = ri % 2 ? ' style="background:#F8FAFC"' : '';
          const tds = row.map((cell, i) => {
            const cls = moneyCols.includes(i) || numCols.includes(i) ? ' class="num"' : '';
            return `<td${cls}>${cell}</td>`;
          }).join('');
          return `<tr${bg}>${tds}</tr>`;
        }).join('')
        : `<tr><td colspan="${headers.length}" class="muted" style="text-align:center;padding:14px">Tidak ada data pada periode ini.</td></tr>`;
      return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    };

    const subtotalRow = (label: string, value: string, cols: number) =>
      `<table style="margin-top:0"><tbody><tr class="tot"><td colspan="${cols - 1}">${this.e(label)}</td><td class="num">${this.e(value)}</td></tr></tbody></table>`;

    const foot = (hal: number) =>
      `<div class="page-foot">TUMBU · ${this.e(tipe)} · Halaman ${hal} dari 7 · Cetak / Simpan sebagai PDF dari browser</div>`;

    // —— Halaman 1: Cover ——
    const cover = `<div class="page">
${this.printHeaderHtml(opts.tenant)}
${pageHead(1, judulCover, subCover, [
  { label: 'Tipe', value: tipe, color: opts.sementara ? '#B45309' : '#0D1B3D' },
], true)}
<div class="sec">Angka Penting</div>
<div class="modul">
  <div>
    <h3>Perputaran Uang</h3>
    <table><tbody>
      <tr><td>Pembelian</td><td>${fmt(r.totalPembelian)}</td></tr>
      <tr><td>Penjualan</td><td>${fmt(r.totalPenjualan)}</td></tr>
      <tr><td>Pengeluaran</td><td>${fmt(r.totalPengeluaran)}</td></tr>
      <tr class="emph"><td>Laba / Rugi</td><td>${fmt(r.labaBersih)}</td></tr>
    </tbody></table>
  </div>
  <div class="kanan">
    <h3>Posisi Sekarang</h3>
    <table><tbody>
      <tr><td>Saldo Kas</td><td>${fmt(r.saldoKas)}</td></tr>
      <tr><td>Piutang</td><td>${fmt(r.totalPiutang)}</td></tr>
      <tr><td>Hutang</td><td>${fmt(r.totalHutang)}</td></tr>
      <tr class="emph"><td>Stok</td><td>${fmtNum(r.totalStok)} ekor</td></tr>
    </tbody></table>
  </div>
</div>
<p class="note-lampiran">Detail lengkap ada di halaman berikut: Pembelian · Penjualan · Pengeluaran · Hutang · Piutang · Laba Rugi</p>
${opts.keterangan ? `<div class="note-ket">Catatan: ${this.e(opts.keterangan)}</div>` : ''}
${foot(1)}
</div>`;

    // —— Halaman 2: Pembelian ——
    const buyRows = opts.purchases.map((p) => {
      const total = this.num(p.total as Prisma.Decimal);
      const paid = this.num(p.paidAmount as Prisma.Decimal);
      const sisa = Math.max(0, total - paid);
      return [
        this.e(p.number),
        this.e(fmtDate(p.date)),
        this.e(p.partner),
        this.e(fmtNum(ekorOf(p.items))),
        this.e(fmt(total)),
        this.e(statusLabel(p.status)),
        this.e(fmt(sisa)),
        this.e(String(p.notes || '').trim() || '—'),
      ];
    });
    const buyTotal = opts.purchases.reduce((s, p) => s + this.num(p.total as Prisma.Decimal), 0);
    const pembelian = `<div class="page">
${pageHead(2, 'Pembelian', 'Daftar pembelian benih di periode ini')}
${ringkas3([
  { label: 'Jumlah trx', value: `${opts.purchases.length} transaksi` },
  { label: 'Total keluar', value: fmt(buyTotal) },
  { label: 'Periode', value: String(periodeLabel) },
])}
<div class="sec">Daftar Transaksinya</div>
${tableHtml(['No. Trx', 'Tanggal', 'Supplier', 'Ekor', 'Nominal', 'Status', 'Sisa', 'Keterangan'], buyRows, [4, 6], [3])}
${subtotalRow('Total pembelian', fmt(buyTotal), 8)}
${foot(2)}
</div>`;

    // —— Halaman 3: Penjualan ——
    const saleRows = opts.sales.map((p) => {
      const total = this.num(p.total as Prisma.Decimal);
      const paid = this.num(p.paidAmount as Prisma.Decimal);
      const sisa = Math.max(0, total - paid);
      return [
        this.e(p.number),
        this.e(fmtDate(p.date)),
        this.e(p.partner),
        this.e(fmtNum(ekorOf(p.items))),
        this.e(fmt(total)),
        this.e(statusLabel(p.status)),
        this.e(fmt(sisa)),
        this.e(String(p.notes || '').trim() || '—'),
      ];
    });
    const saleTotal = opts.sales.reduce((s, p) => s + this.num(p.total as Prisma.Decimal), 0);
    const penjualan = `<div class="page">
${pageHead(3, 'Penjualan', 'Daftar penjualan benih di periode ini')}
${ringkas3([
  { label: 'Jumlah trx', value: `${opts.sales.length} transaksi` },
  { label: 'Total masuk', value: fmt(saleTotal) },
  { label: 'Periode', value: String(periodeLabel) },
])}
<div class="sec">Daftar Transaksinya</div>
${tableHtml(['No. Trx', 'Tanggal', 'Pelanggan', 'Ekor', 'Tagihan', 'Status', 'Sisa', 'Keterangan'], saleRows, [4, 6], [3])}
${subtotalRow('Total penjualan', fmt(saleTotal), 8)}
${foot(3)}
</div>`;

    // —— Halaman 4: Pengeluaran ——
    const outRows = opts.cashOut.map((p) => [
      this.e(p.number || '—'),
      this.e(fmtDate(p.date)),
      this.e(p.category),
      this.e(fmt(this.num(p.amount as Prisma.Decimal))),
      this.e((p.account || 'CASH') === 'BANK' ? 'Transfer' : 'Tunai'),
      this.e(String(p.description || '').trim() || '—'),
    ]);
    const outTotal = opts.cashOut.reduce((s, p) => s + this.num(p.amount as Prisma.Decimal), 0);
    const pengeluaran = `<div class="page">
${pageHead(4, 'Pengeluaran', 'Biaya operasional yang keluar')}
${ringkas3([
  { label: 'Jumlah trx', value: `${opts.cashOut.length} transaksi` },
  { label: 'Total biaya', value: fmt(outTotal) },
  { label: 'Periode', value: String(periodeLabel) },
])}
<div class="sec">Daftar Transaksinya</div>
${tableHtml(['No. Trx', 'Tanggal', 'Kategori', 'Nominal', 'Bayar', 'Keterangan'], outRows, [3], [])}
${subtotalRow('Total pengeluaran', fmt(outTotal), 6)}
${foot(4)}
</div>`;

    // —— Halaman 5: Hutang ——
    const hutangRows = opts.payables.map((p) => [
      this.e(p.number),
      this.e(fmtDate(p.date)),
      this.e(p.partner),
      this.e(fmt(p.total)),
      this.e(fmt(p.paidAmount)),
      this.e(fmt(p.remaining)),
      this.e(statusLabel(p.status)),
      this.e(String(p.notes || '').trim() || '—'),
    ]);
    const hutangTotal = opts.payables.reduce((s, p) => s + Number(p.remaining || 0), 0);
    const hutang = `<div class="page">
${pageHead(5, 'Hutang Masih Ada', 'Hutang supplier dari Pembelian (PO)')}
${ringkas3([
  { label: 'Jumlah faktur', value: `${opts.payables.length} faktur` },
  { label: 'Sisa hutang', value: fmt(hutangTotal) },
  { label: 'Posisi', value: `Per ${dicetak}` },
])}
<div class="sec">Daftar Hutangnya</div>
${tableHtml(['No. Trx', 'Tanggal', 'Supplier', 'Total', 'Dibayar', 'Sisa', 'Status', 'Keterangan'], hutangRows, [3, 4, 5], [])}
${subtotalRow('Total sisa hutang', fmt(hutangTotal), 8)}
${foot(5)}
</div>`;

    // —— Halaman 6: Piutang ——
    const piutangRows = opts.receivables.map((p) => [
      this.e(p.number),
      this.e(fmtDate(p.date)),
      this.e(p.partner),
      this.e(fmt(p.total)),
      this.e(fmt(p.paidAmount)),
      this.e(fmt(p.remaining)),
      this.e(statusLabel(p.status)),
      this.e(String(p.notes || '').trim() || '—'),
    ]);
    const piutangTotal = opts.receivables.reduce((s, p) => s + Number(p.remaining || 0), 0);
    const piutang = `<div class="page">
${pageHead(6, 'Piutang Belum Cair', 'Tagihan pelanggan yang belum masuk')}
${ringkas3([
  { label: 'Jumlah faktur', value: `${opts.receivables.length} faktur` },
  { label: 'Sisa piutang', value: fmt(piutangTotal) },
  { label: 'Posisi', value: `Per ${dicetak}` },
])}
<div class="sec sec-blue">Daftar Piutangnya</div>
${tableHtml(['No. Trx', 'Tanggal', 'Pelanggan', 'Total', 'Diterima', 'Sisa', 'Status', 'Keterangan'], piutangRows, [3, 4, 5], [])}
${subtotalRow('Total sisa piutang', fmt(piutangTotal), 8)}
${foot(6)}
</div>`;

    // —— Halaman 7: Laba Rugi ——
    const lrRows: Array<[string, string, boolean]> = [
      ['Penjualan', fmt(r.totalPenjualan), false],
      ['Pembelian (HPP)', fmt(r.totalPembelian), false],
      ['Laba kotor', fmt(labaKotor), false],
      ['Pengeluaran', fmt(r.totalPengeluaran), false],
      ['Laba / rugi operasional', fmt(r.labaOperasional), false],
      [`Rugi dibawa bulan sebelumnya${periodeRugi ? ` (${periodeRugi})` : ''}`, fmt(Number(r.rugiDitahan) || 0), false],
      ['Laba / rugi bersih', fmt(r.labaBersih), true],
      ['Margin', `${marginPersen.toFixed(1)}%`, false],
      ['Saldo kas + bank', fmt(r.saldoTotal), false],
      ['Piutang belum cair', fmt(r.totalPiutang), false],
      ['Hutang PO masih ada', fmt(r.totalHutang), false],
      ['Modal bersih', fmt(modalBersih), true],
      ['Stok akhir', `${fmtNum(r.totalStok)} ekor`, false],
    ];
    const lrBody = lrRows.map(([label, val, emph]) =>
      `<tr class="${emph ? 'total' : ''}"><td>${this.e(label)}</td><td class="num">${this.e(val)}</td></tr>`).join('');
    const labarugi = `<div class="page">
${pageHead(7, 'Untung atau Rugi?', 'Performa keuangan periode ini')}
${ringkas3([
  { label: 'Laba / rugi', value: fmt(r.labaBersih) },
  { label: 'Margin', value: `${marginPersen.toFixed(1)}%` },
  { label: 'Periode', value: String(periodeLabel) },
])}
<div class="sec">Hitungan Laba Rugi</div>
<table class="lr"><tbody>${lrBody}</tbody></table>
${foot(7)}
</div>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${this.e(`${judulCover} ${periodeLabel}`)}</title>
<style>${pageCss}</style></head><body>
${cover}${pembelian}${penjualan}${pengeluaran}${hutang}${piutang}${labarugi}
<button class="noprint" onclick="window.print()" style="position:fixed;right:16px;bottom:16px;padding:10px 16px;border-radius:8px;border:0;background:#0D1B3D;color:#fff;font-weight:600;cursor:pointer;z-index:9">Cetak / Simpan PDF (7 halaman)</button>
</body></html>`;
  }

  async documentTutupBuku(input: {
    periodYm?: string; keterangan?: string; sementara?: boolean;
    dari?: string; sampai?: string; from?: string; to?: string;
  } = {}) {
    const rekap = input.periodYm
      ? await this.closingPreview({ periodYm: input.periodYm })
      : await this.closingRekap({
        periode: input.periodYm,
        dari: input.dari || input.from,
        sampai: input.sampai || input.to,
      });
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const from = new Date(rekap.dari);
    const to = new Date(rekap.sampai);
    const [purchases, sales, cashOut, finance] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { tenantId: this.tid(), type: 'PURCHASE', date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        include: { items: true },
      }),
      this.prisma.transaction.findMany({
        where: { tenantId: this.tid(), type: 'SALE', date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
        include: { items: true },
      }),
      this.prisma.cashEntry.findMany({
        where: {
          tenantId: this.tid(), direction: 'OUT', date: { gte: from, lte: to },
          NOT: { category: { in: ['Pembelian', 'Pelunasan Hutang'] } },
        },
        orderBy: { date: 'asc' },
      }),
      this.financeSummary(),
    ]);
    const payables = finance.payables || [];
    const receivables = finance.receivables || [];
    const html = this.buildRekapTujuhHalamanHtml({
      tenant,
      rekap,
      sementara: !!input.sementara,
      keterangan: input.keterangan,
      purchases,
      sales,
      cashOut,
      payables,
      receivables,
    });
    return {
      title: `${input.sementara ? 'Rekap Sementara' : 'Tutup Buku'} ${rekap.labelPeriode || rekap.periodYm}`,
      ...rekap,
      html,
      halaman: 7,
      jenis: input.sementara ? 'rekap' : 'tutup',
      fileName: `${(input.sementara ? 'Rekap_Sementara' : 'Tutup_Buku')}_${String(rekap.periodYm || rekap.labelPeriode || '').replace(/\s+/g, '_')}.pdf`,
    };
  }


  async documentLaporan(input: { from?: string; to?: string; jenis?: string } = {}) {
    const report = await this.report(input);
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const fmt = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
    const fromLabel = new Date(report.from).toLocaleDateString('id-ID');
    const toLabel = new Date(report.to).toLocaleDateString('id-ID');
    const expensesTotal = (report.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const laba = Number(report.salesTotal) - Number(report.purchaseTotal) - expensesTotal;
    const detailRows = (report.detail || []).slice(0, 80).map((r, i) => {
      const bg = i % 2 ? '#F0F2F5' : '#fff';
      const label = String(r.number || r.description || '—');
      const partner = String(r.partner || r.account || r.category || '—');
      const nominal = Number(r.total ?? r.amount ?? 0);
      const status = r.status ? (r.status === 'PAID' ? 'Lunas' : 'Belum lunas') : String(r.direction || r.jenis || '');
      return `<tr style="background:${bg}"><td>${this.e(label)}</td><td>${this.e(partner)}</td><td style="text-align:right">${fmt(nominal)}</td><td>${this.e(status)}</td></tr>`;
    }).join('');
    const body = `<div class="sec">Ikhtisar</div>
<table><tbody>
<tr><td>Penjualan</td><td style="text-align:right">${fmt(Number(report.salesTotal))}</td></tr>
<tr><td>Pembelian</td><td style="text-align:right">${fmt(Number(report.purchaseTotal))}</td></tr>
<tr><td>Pengeluaran</td><td style="text-align:right">${fmt(expensesTotal)}</td></tr>
<tr class="tot"><td>Laba bersih</td><td style="text-align:right">${fmt(laba)}</td></tr>
<tr><td>Net Kas</td><td style="text-align:right">${fmt(Number(report.cashNet))}</td></tr>
<tr><td>Net Bank</td><td style="text-align:right">${fmt(Number(report.bankNet))}</td></tr>
</tbody></table>
<div class="sec">Detail ${this.e(report.jenis === 'SEMUA' ? 'gabungan' : report.jenis)}</div>
<table><thead><tr><th>Dokumen</th><th>Partner / Ket</th><th>Nominal</th><th>Status</th></tr></thead>
<tbody>${detailRows || '<tr><td colspan="4">Tidak ada data</td></tr>'}</tbody></table>`;
    return {
      title: `Laporan ${fromLabel} – ${toLabel}`,
      ...report,
      html: this.buildOfficialDoc({
        tenant,
        title: 'Laporan Periode',
        badge: 'Laporan',
        subjudul: 'Ringkasan operasional distributor benih',
        refItems: [
          { label: 'Dari', value: fromLabel },
          { label: 'Sampai', value: toLabel },
          { label: 'Jenis', value: report.jenis },
        ],
        bodyHtml: body,
      }),
    };
  }

  async exportBackup() {
    const tid = this.tid();
    const [tenant, products, partners, sizes, cashEntries, transactions, beritaAcara, suratJalan, closings] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({ where: { id: tid } }),
      this.prisma.product.findMany({ where: { tenantId: tid } }),
      this.prisma.partner.findMany({ where: { tenantId: tid } }),
      this.prisma.size.findMany({ where: { tenantId: tid } }),
      this.prisma.cashEntry.findMany({ where: { tenantId: tid } }),
      this.prisma.transaction.findMany({ where: { tenantId: tid }, include: { items: true, fees: true } }),
      this.prisma.beritaAcara.findMany({ where: { tenantId: tid }, include: { lines: true } }),
      this.prisma.suratJalan.findMany({ where: { tenantId: tid }, include: { lines: true } }),
      this.prisma.closingPeriod.findMany({ where: { tenantId: tid } }),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tenant: { name: tenant.name, code: tenant.code, blueprint: tenant.blueprint, phone: tenant.phone, address: tenant.address },
      products, partners, sizes, cashEntries, transactions, beritaAcara, suratJalan, closings,
    };
  }

  /**
   * Kosongkan data bisnis workspace (seperti Reset Semua Data di MAT ERP).
   * Tetap: Users, membership, profil workspace, invoice platform.
   * Wajib: confirm=true, teksKonfirmasi=RESET, confirmWorkspaceCode=kode workspace.
   */
  async resetBusinessData(input: {
    confirm?: boolean;
    confirmText?: string;
    teksKonfirmasi?: string;
    confirmWorkspaceCode?: string;
  } = {}) {
    if (input.confirm !== true) {
      throw new BadRequestException('Centang konfirmasi terlebih dahulu.');
    }
    const teks = String(input.confirmText || input.teksKonfirmasi || '').trim().toUpperCase();
    if (teks !== 'RESET') {
      throw new BadRequestException('Ketik RESET (huruf kapital) untuk konfirmasi.');
    }

    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const code = String(input.confirmWorkspaceCode || '').trim();
    if (!code || code !== t.code) {
      throw new BadRequestException(`Kode workspace wajib cocok. Aktif: ${t.code}`);
    }

    const backup = await this.exportBackup();

    const deleted = await this.prisma.$transaction(async (tx) => {
      const tid = t.id;
      const before = {
        workOrders: await tx.workOrder.count({ where: { tenantId: tid } }),
        quotations: await tx.quotation.count({ where: { tenantId: tid } }),
        assetUnits: await tx.assetUnit.count({ where: { tenantId: tid } }),
        services: await tx.serviceItem.count({ where: { tenantId: tid } }),
        closings: await tx.closingPeriod.count({ where: { tenantId: tid } }),
        suratJalan: await tx.suratJalan.count({ where: { tenantId: tid } }),
        beritaAcara: await tx.beritaAcara.count({ where: { tenantId: tid } }),
        transactions: await tx.transaction.count({ where: { tenantId: tid } }),
        cashEntries: await tx.cashEntry.count({ where: { tenantId: tid } }),
        products: await tx.product.count({ where: { tenantId: tid } }),
        partners: await tx.partner.count({ where: { tenantId: tid } }),
        sizes: await tx.size.count({ where: { tenantId: tid } }),
        docCounters: await tx.docCounter.count({ where: { tenantId: tid } }),
      };

      await tx.workOrder.deleteMany({ where: { tenantId: tid } });
      await tx.quotation.deleteMany({ where: { tenantId: tid } });
      await tx.assetUnit.deleteMany({ where: { tenantId: tid } });
      await tx.serviceItem.deleteMany({ where: { tenantId: tid } });
      await tx.closingPeriod.deleteMany({ where: { tenantId: tid } });
      await tx.suratJalan.deleteMany({ where: { tenantId: tid } });
      await tx.beritaAcara.deleteMany({ where: { tenantId: tid } });
      await tx.transaction.deleteMany({ where: { tenantId: tid } });
      await tx.cashEntry.deleteMany({ where: { tenantId: tid } });
      await tx.product.deleteMany({ where: { tenantId: tid } });
      await tx.partner.deleteMany({ where: { tenantId: tid } });
      await tx.size.deleteMany({ where: { tenantId: tid } });
      await tx.docCounter.deleteMany({ where: { tenantId: tid } });

      let prev: Record<string, unknown> = {};
      try { prev = JSON.parse(t.settingsJson || '{}') as Record<string, unknown>; } catch { prev = {}; }
      await tx.tenant.update({
        where: { id: tid },
        data: {
          settingsJson: JSON.stringify({
            ...prev,
            openingCash: 0,
            openingBank: 0,
            rugiDitahan: 0,
            periodeRugiDitahan: '',
            keteranganRugiDitahan: '',
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tid,
          userId: this.tenant.userId || null,
          action: 'workspace.reset_data',
          entity: 'tenant',
          entityId: tid,
          metaJson: JSON.stringify({ code: t.code, deleted: before }),
        },
      });

      return before;
    });

    return {
      ok: true,
      message: 'Semua data bisnis dikosongkan. Akun, membership, dan profil workspace tetap.',
      workspace: { code: t.code, name: t.name },
      deleted,
      backup,
    };
  }

  async importBackup(payload: {
    products?: Array<{ name: string; unit: string; stock?: number; minStock?: number; price?: number; sizeLabel?: string }>;
    partners?: Array<{ name: string; phone?: string; type: string }>;
    sizes?: Array<{ label: string; sortOrder?: number }>;
    confirmWorkspaceCode?: string;
  } = {}) {
    const t = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    if (payload.confirmWorkspaceCode && payload.confirmWorkspaceCode !== t.code) {
      throw new BadRequestException(`Kode workspace tidak cocok. Aktif: ${t.code}`);
    }
    let productsAdded = 0;
    let partnersAdded = 0;
    let sizesAdded = 0;
    if (Array.isArray(payload.sizes)) {
      for (const s of payload.sizes) {
        if (!s?.label) continue;
        const exists = await this.prisma.size.findFirst({ where: { tenantId: t.id, label: s.label } });
        if (!exists) {
          await this.prisma.size.create({ data: { tenantId: t.id, label: s.label, sortOrder: s.sortOrder ?? 0 } });
          sizesAdded++;
        }
      }
    }
    if (Array.isArray(payload.products)) {
      for (const p of payload.products) {
        if (!p?.name || !p?.unit) continue;
        const exists = await this.prisma.product.findFirst({ where: { tenantId: t.id, name: p.name } });
        if (!exists) {
          await this.prisma.product.create({
            data: {
              tenantId: t.id,
              name: p.name,
              unit: p.unit,
              stock: p.stock ?? 0,
              minStock: p.minStock ?? 0,
              price: p.price ?? 0,
              sizeLabel: p.sizeLabel,
            },
          });
          productsAdded++;
        }
      }
    }
    if (Array.isArray(payload.partners)) {
      for (const p of payload.partners) {
        if (!p?.name || !['CUSTOMER', 'SUPPLIER'].includes(p.type)) continue;
        const exists = await this.prisma.partner.findFirst({ where: { tenantId: t.id, name: p.name, type: p.type } });
        if (!exists) {
          await this.prisma.partner.create({ data: { tenantId: t.id, name: p.name, phone: p.phone, type: p.type } });
          partnersAdded++;
        }
      }
    }
    return {
      ok: true,
      message: 'Impor non-destruktif selesai (hanya data baru).',
      added: { products: productsAdded, partners: partnersAdded, sizes: sizesAdded },
      workspace: { code: t.code, name: t.name },
    };
  }

  async documentKwitansi(input: {
    source?: string;
    transactionId?: string;
    cashId?: string;
    baId?: string;
    amount?: number;
    partner?: string;
    note?: string;
  } = {}) {
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const source = String(input.source || (input.transactionId ? 'penjualan' : input.cashId ? 'pelunasan' : input.baId ? 'ba' : 'manual')).toLowerCase();
    const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

    if (source === 'manual') {
      const amount = Number(input.amount) || 0;
      if (amount <= 0) throw new BadRequestException('Nominal kwitansi manual wajib.');
      const number = await this.nextDocNumber('KW', 'KW');
      const body = `<div class="sec">Rincian Pembayaran</div>
<table><tbody>
<tr><td>Diterima dari</td><td style="text-align:right"><b>${this.e(input.partner || '—')}</b></td></tr>
<tr><td>Untuk pembayaran</td><td style="text-align:right">${this.e(input.note || 'Pembayaran')}</td></tr>
<tr class="tot"><td>Jumlah</td><td style="text-align:right">${fmt(amount)}</td></tr>
</tbody></table>
<div class="amount">${fmt(amount)}</div>
<p class="muted">Telah diterima dengan baik.</p>`;
      return {
        title: `Kwitansi ${number}`, number, date: new Date().toISOString(), partner: input.partner || '—', total: amount, source,
        html: this.buildOfficialDoc({
          tenant, title: 'Kwitansi', badge: 'Kwitansi', subjudul: 'Bukti penerimaan pembayaran',
          refItems: [
            { label: 'No Kwitansi', value: number },
            { label: 'Tanggal', value: new Date().toLocaleDateString('id-ID') },
            { label: 'Status', value: 'LUNAS', color: '#16A34A' },
          ],
          bodyHtml: body,
          signatures: [
            { label: 'Yang menerima', name: 'Admin' },
            { label: 'Yang menyerahkan', name: input.partner || '—' },
            { label: 'Mengetahui', name: '—' },
          ],
          footer: `Kwitansi manual · ${number}`,
        }),
      };
    }

    if (source === 'ba' || input.baId) {
      if (!input.baId) throw new BadRequestException('ID Berita Acara wajib.');
      const ba = await this.prisma.beritaAcara.findFirst({ where: { id: input.baId, tenantId: this.tid() }, include: { lines: true } });
      if (!ba) throw new BadRequestException('Berita Acara tidak ditemukan.');
      const amount = this.num(ba.totalUangMasuk) > 0
        ? this.num(ba.totalUangMasuk)
        : ba.lines.reduce((s, l) => s + this.num(l.quantity) * this.num(l.price), 0);
      const rows = ba.lines.map((l) => `<tr><td>${this.e(l.binNote || '—')}</td><td>${this.e(l.sizeLabel)}</td>
<td style="text-align:right">${this.num(l.quantity).toLocaleString('id-ID')}</td>
<td style="text-align:right">${fmt(this.num(l.price))}</td>
<td style="text-align:right">${fmt(this.num(l.quantity) * this.num(l.price))}</td></tr>`).join('');
      const body = `<div class="sec">Rincian dari Berita Acara</div>
<table><thead><tr><th>Bak</th><th>Ukuran</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
<div class="grid2"><div>
<table><tbody>
<tr><td>Nota aktual</td><td style="text-align:right">${fmt(this.num(ba.notaAktual))}</td></tr>
<tr><td>Total uang masuk (catatan)</td><td style="text-align:right">${fmt(this.num(ba.totalUangMasuk))}</td></tr>
<tr class="tot"><td>Jumlah kwitansi</td><td style="text-align:right">${fmt(amount)}</td></tr>
</tbody></table></div><div><div class="sisa-box">
<div class="lbl">Sisa estimasi BA</div><div class="val navy">${fmt(this.num(ba.sisaEstimasi))}</div>
<p class="muted">Angka BA bersifat catatan. Pembayaran resmi lewat Pembelian.</p>
</div></div></div>`;
      return {
        title: `Kwitansi BA ${ba.number}`, number: ba.number, date: ba.date.toISOString(), partner: ba.supplier, total: amount, source,
        html: this.buildOfficialDoc({
          tenant, title: 'Kwitansi', badge: 'Kwitansi BA', subjudul: 'Bukti terkait Berita Acara',
          refItems: [
            { label: 'No BA', value: ba.number },
            { label: 'Tanggal', value: ba.date.toLocaleDateString('id-ID') },
            { label: 'Supplier', value: ba.supplier },
          ],
          bodyHtml: body,
          note: ba.notes || undefined,
          signatures: [
            { label: 'Admin', name: ba.adminName || 'Admin' },
            { label: 'Checker', name: ba.checker || '—' },
            { label: 'Supplier', name: ba.supplier },
          ],
        }),
      };
    }

    if (source === 'pelunasan' || source === 'piutang' || source === 'hutang' || input.cashId) {
      if (!input.cashId) throw new BadRequestException('ID kas/pelunasan wajib.');
      const cash = await this.prisma.cashEntry.findFirst({ where: { id: input.cashId, tenantId: this.tid() } });
      if (!cash) throw new BadRequestException('Entri kas tidak ditemukan.');
      const number = cash.number || `KW-${cash.id.slice(-6).toUpperCase()}`;
      const body = `<div class="sec">Rincian Pelunasan</div>
<table><tbody>
<tr><td>Kategori</td><td style="text-align:right">${this.e(cash.category)}</td></tr>
<tr><td>Keterangan</td><td style="text-align:right">${this.e(cash.description)}</td></tr>
<tr><td>Via</td><td style="text-align:right">${cash.account === 'BANK' ? 'Bank' : 'Kas'}</td></tr>
<tr class="tot"><td>Jumlah</td><td style="text-align:right">${fmt(this.num(cash.amount))}</td></tr>
</tbody></table>
<div class="amount">${fmt(this.num(cash.amount))}</div>`;
      return {
        title: `Kwitansi ${cash.category}`, number, date: cash.date.toISOString(), partner: cash.description, total: this.num(cash.amount), source,
        html: this.buildOfficialDoc({
          tenant, title: 'Kwitansi', badge: 'Pelunasan', subjudul: 'Bukti pelunasan / mutasi',
          refItems: [
            { label: 'No', value: number },
            { label: 'Tanggal', value: cash.date.toLocaleDateString('id-ID') },
            { label: 'Via', value: cash.account === 'BANK' ? 'Bank' : 'Kas' },
          ],
          bodyHtml: body,
        }),
      };
    }

    if (!input.transactionId) throw new BadRequestException('ID transaksi wajib.');
    return this.documentTransaksi({
      transactionId: input.transactionId,
      asKwitansi: true,
      forceType: source === 'pembelian' ? 'PURCHASE' : source === 'penjualan' || source === 'sale' ? 'SALE' : undefined,
    });
  }

  async documentTransaksi(input: { transactionId?: string; asKwitansi?: boolean; forceType?: 'SALE' | 'PURCHASE' } = {}) {
    if (!input.transactionId) throw new BadRequestException('ID transaksi wajib.');
    const tx = await this.prisma.transaction.findFirst({
      where: { id: input.transactionId, tenantId: this.tid() },
      include: { items: true, fees: true },
    });
    if (!tx) throw new BadRequestException('Transaksi tidak ditemukan.');
    if (input.forceType && tx.type !== input.forceType) {
      throw new BadRequestException(input.forceType === 'SALE' ? 'Bukan transaksi penjualan.' : 'Bukan transaksi pembelian.');
    }
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const settings = this.parseSettings(tenant.settingsJson);
    const defaultUraian = (settings.invoiceUraian || '').trim() || 'Benih';
    const products = await this.prisma.product.findMany({ where: { tenantId: this.tid() } });
    const pmap = new Map(products.map((p) => [p.id, p]));
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(tx.metaJson || '{}') as Record<string, unknown>; } catch { meta = {}; }
    const isBeli = tx.type === 'PURCHASE';
    const judul = input.asKwitansi
      ? (isBeli ? 'Kwitansi Pembelian' : 'Kwitansi Penjualan')
      : (isBeli ? 'Nota Pembelian' : 'Invoice');
    const subjudul = isBeli ? 'Pembelian benih — bukti transaksi' : 'Penjualan benih — bukti tagihan';
    const paid = this.num(tx.paidAmount);
    const total = this.num(tx.total);
    const sisa = Math.max(0, total - paid);
    const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
    const itemRows = tx.items.map((it, i) => {
      const prod = pmap.get(it.productId);
      const ukuran = String(it.sizeLabel || prod?.sizeLabel || '').trim() || '—';
      // URAIAN: nama produk tanpa mengulang ukuran; fallback setting invoiceUraian
      let uraian = String(prod?.name || '').trim();
      if (ukuran !== '—' && uraian.toLowerCase().endsWith(ukuran.toLowerCase())) {
        uraian = uraian.slice(0, -ukuran.length).trim();
      }
      uraian = uraian.replace(/^benih\s+/i, 'Benih ').trim();
      if (!uraian || /^benih$/i.test(uraian) || /^umum$/i.test(uraian)) {
        uraian = /umum/i.test(String(prod?.name || it.sizeLabel || '')) ? 'Biaya / Lainnya' : defaultUraian;
      }
      const qty = this.num(it.quantity);
      const price = this.num(it.price);
      const disc = this.num(it.discountAmount);
      const bonus = this.num(it.bonusQty);
      const sub = Math.max(0, qty * price - disc);
      const bg = i % 2 ? '#F0F2F5' : '#fff';
      const commodityCategory = normalizeCommodityCategory(
        it.commodityCategory || prod?.commodityCategory || inferCommodityFromUnit(it.unit || prod?.unit),
      );
      const unitLabel = unitLabelForCommodity(commodityCategory);
      const species = String(it.species || prod?.species || '').trim();
      if (species && !uraian.toLowerCase().includes(species.toLowerCase())) {
        uraian = `${species} · ${uraian}`.trim();
      }
      const qtyText = bonus > 0
        ? `${formatQtyWithUnit(qty, commodityCategory)} + ${bonus.toLocaleString('id-ID')} ${unitLabel} bonus`
        : formatQtyWithUnit(qty, commodityCategory);
      return `<tr style="background:${bg}">
<td style="text-align:center">${i + 1}</td>
<td>${this.e(uraian)}</td>
<td style="text-align:center">${this.e(ukuran)}</td>
<td style="text-align:center">${qtyText}</td>
<td style="text-align:right">${fmt(price)}</td>
<td style="text-align:right">${fmt(sub)}</td>
</tr>`;
    }).join('');
    const itemsSubtotal = tx.items.reduce((s, it) => {
      return s + Math.max(0, this.num(it.quantity) * this.num(it.price) - this.num(it.discountAmount));
    }, 0);
    const grossItems = tx.items.reduce((s, it) => s + this.num(it.quantity) * this.num(it.price), 0);
    const itemDiscountTotal = tx.items.reduce((s, it) => s + this.num(it.discountAmount), 0);
    const txDiscountTotal = this.num(tx.discountAmount);
    const headerDiscount = Math.max(0, txDiscountTotal - itemDiscountTotal);
    const totalDiscount = itemDiscountTotal + headerDiscount;
    const feeRows = (tx.fees || []).map((f, i) => {
      const n = tx.items.length + i + 1;
      const bg = (tx.items.length + i) % 2 ? '#F0F2F5' : '#fff';
      return `<tr style="background:${bg}">
<td style="text-align:center">${n}</td>
<td>${this.e(f.label || f.kind)}</td>
<td style="text-align:center">—</td>
<td style="text-align:center">—</td>
<td style="text-align:right">—</td>
<td style="text-align:right">${fmt(this.num(f.amount))}</td>
</tr>`;
    }).join('');
    const feesTotal = (tx.fees || []).reduce((s, f) => s + this.num(f.amount), 0);
    const barisTotal = itemsSubtotal + feesTotal;
    const discountRows = totalDiscount > 0
      ? `<tr style="background:#FEF2F2;font-weight:600">
<td colspan="5" style="text-align:right">POTONGAN HARGA / DISKON</td>
<td style="text-align:right;color:#B91C1C">− ${fmt(totalDiscount)}</td>
</tr>`
      : '';
    const labelSisa = isBeli ? 'Sisa Hutang' : 'Sisa Piutang';
    const body = `<div class="sec">Rincian Item</div>
<table>
<thead><tr>
<th style="text-align:center">NO</th>
<th>URAIAN</th>
<th style="text-align:center">UKURAN</th>
<th style="text-align:center">QTY</th>
<th style="text-align:right">HARGA/EKOR</th>
<th style="text-align:right">SUBTOTAL</th>
</tr></thead>
<tbody>
${itemRows || '<tr><td colspan="6">Tidak ada item</td></tr>'}
${feeRows}
<tr style="background:#F1F5F9;font-weight:700">
<td colspan="5" style="text-align:right">SUBTOTAL BARANG</td>
<td style="text-align:right">${fmt(grossItems)}</td>
</tr>
${discountRows}
<tr style="background:#F1F5F9;font-weight:700">
<td colspan="5" style="text-align:right">SUBTOTAL SETELAH POTONGAN</td>
<td style="text-align:right">${fmt(barisTotal)}</td>
</tr>
</tbody></table>
<div class="grid2"><div>
<div class="sec">Ringkasan Pembayaran</div>
<table><tbody>
${totalDiscount > 0 ? `<tr><td>Potongan / diskon</td><td style="text-align:right;color:#B91C1C">− ${fmt(totalDiscount)}</td></tr>` : ''}
<tr><td>Total tagihan</td><td style="text-align:right">${fmt(total)}</td></tr>
<tr><td>Sudah dibayar</td><td style="text-align:right">${fmt(paid)}</td></tr>
<tr class="tot"><td>${labelSisa}</td><td style="text-align:right">${fmt(sisa)}</td></tr>
</tbody></table>
<div style="margin-top:10px">${this.statusBadgeHtml(tx.status)}</div>
</div><div>
<div class="sec">Informasi Partner</div>
<table><tbody>
<tr><td>${isBeli ? 'Supplier' : 'Pelanggan'}</td><td style="text-align:right"><b>${this.e(tx.partner)}</b></td></tr>
<tr><td>No. HP</td><td style="text-align:right">${this.e(String(meta.partnerPhone || '—'))}</td></tr>
<tr><td>Alamat</td><td style="text-align:right">${this.e(String(meta.partnerAddress || '—'))}</td></tr>
<tr><td>Via bayar</td><td style="text-align:right">${tx.account === 'BANK' ? 'Bank' : 'Kas'}</td></tr>
</tbody></table>
</div></div>`;
    return {
      title: `${judul} ${tx.number}`,
      number: tx.number, date: tx.date.toISOString(), type: tx.type, partner: tx.partner,
      status: tx.status, total, paidAmount: paid, remaining: sisa,
      html: this.buildOfficialDoc({
        tenant, title: judul, badge: judul, subjudul,
        refItems: [
          { label: isBeli ? 'No. Nota' : 'No. Invoice', value: tx.number },
          { label: 'Tanggal', value: tx.date.toLocaleDateString('id-ID') },
          { label: 'Status Bayar', value: tx.status === 'PAID' ? 'LUNAS' : (paid > 0 ? 'DP' : 'BELUM LUNAS'), color: tx.status === 'PAID' ? '#16A34A' : '#E63946' },
        ],
        infoItems: [
          { label: isBeli ? 'Supplier' : 'Tagihan kepada', value: tx.partner },
          { label: 'Telepon', value: String(meta.partnerPhone || '—') },
          { label: 'Alamat', value: String(meta.partnerAddress || '—') },
          { label: 'Dicetak', value: new Date().toLocaleDateString('id-ID') },
        ],
        bodyHtml: body,
        note: tx.notes || (isBeli
          ? 'Nota ini merupakan bukti transaksi pembelian benih.'
          : 'Terima kasih atas kepercayaan Anda.'),
        signatures: [
          { label: isBeli ? 'Supplier' : 'Pelanggan', name: tx.partner },
          { label: 'Admin', name: 'Admin' },
          { label: 'Mengetahui', name: '—' },
        ],
        footer: `${judul} ${tx.number} · ${tx.partner}`,
      }),
    };
  }

  async documentKopPreview() {
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
    const body = `<div class="sec">Contoh Barang</div>
<table><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
<tbody>
<tr><td>Bibit Lele Size M</td><td style="text-align:right">500</td><td style="text-align:right">${fmt(350)}</td><td style="text-align:right">${fmt(175000)}</td></tr>
<tr><td>Bibit Lele Size L</td><td style="text-align:right">200</td><td style="text-align:right">${fmt(450)}</td><td style="text-align:right">${fmt(90000)}</td></tr>
</tbody></table>
<table style="margin-top:0"><tbody>
<tr class="tot"><td colspan="3">Total</td><td style="text-align:right">${fmt(265000)}</td></tr>
</tbody></table>`;
    return {
      title: 'Contoh Kop Surat',
      html: this.buildOfficialDoc({
        tenant,
        title: 'Nota Penjualan',
        subjudul: 'Pratinjau kop surat — data contoh',
        refItems: [
          { label: 'No. Nota', value: 'PREVIEW-001' },
          { label: 'Tanggal', value: new Date().toLocaleDateString('id-ID') },
          { label: 'Status', value: 'CONTOH', color: '#64748B' },
        ],
        infoItems: [
          { label: 'Pelanggan', value: 'Pelanggan Contoh' },
          { label: 'Telepon', value: '—' },
          { label: 'Alamat', value: '—' },
          { label: 'Dicetak', value: new Date().toLocaleDateString('id-ID') },
        ],
        bodyHtml: body,
        note: 'Dokumen ini hanya pratinjau kop surat. Angka dan nama bersifat contoh.',
        footer: 'Pratinjau kop surat TUMBU · Cetak / Simpan sebagai PDF dari browser',
      }),
    };
  }

  async documentRekapPengeluaran(input: RekapPengeluaranInput = {}) {
    const rekap = await this.rekapPengeluaran(input);
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
    const katRows = rekap.rincianKategori
      .map((it) => `<tr><td>· ${this.e(it.kategori)}</td><td style="text-align:right">${fmt(it.nominal)}</td></tr>`)
      .join('');
    const rows = rekap.entries.map((c, i) => {
      const bg = i % 2 ? '#F0F2F5' : '#fff';
      return `<tr style="background:${bg}">
<td>${this.e(new Date(c.date).toLocaleDateString('id-ID'))}</td>
<td>${this.e(c.number || '-')}</td>
<td>${this.e(c.category)}</td>
<td>${this.e(c.description)}</td>
<td>${this.e(c.account === 'BANK' ? 'Bank' : 'Kas')}</td>
<td style="text-align:right">${fmt(c.amount)}</td>
</tr>`;
    }).join('');
    const body = `<div class="sec">Ringkasan</div>
<table><tbody>
<tr class="tot"><td>Total Pengeluaran</td><td style="text-align:right">${fmt(rekap.total)}</td></tr>
<tr><td>Via Kas (Cash)</td><td style="text-align:right">${fmt(rekap.totalKas)}</td></tr>
<tr><td>Via Bank (Transfer)</td><td style="text-align:right">${fmt(rekap.totalBank)}</td></tr>
${katRows}
</tbody></table>
<div class="sec">Rincian Transaksi</div>
<table><thead><tr><th>Tanggal</th><th>No</th><th>Kategori</th><th>Keterangan</th><th>Via</th><th>Nominal</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">Tidak ada data</td></tr>'}</tbody></table>`;
    return {
      title: 'Rekap Pengeluaran',
      ...rekap,
      html: this.buildOfficialDoc({
        tenant,
        title: 'Rekap Pengeluaran',
        badge: 'Pengeluaran',
        subjudul: 'Ikhtisar biaya operasional per periode',
        refItems: [
          { label: 'Periode', value: rekap.labelPeriode },
          { label: 'Jumlah', value: String(rekap.jumlah) },
          { label: 'Total', value: fmt(rekap.total), color: '#E63946' },
        ],
        bodyHtml: body,
        note: rekap.keterangan || undefined,
      }),
    };
  }

  async documentBeritaAcara(input: { id?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID wajib.');
    const ba = await this.prisma.beritaAcara.findFirst({ where: { id: input.id, tenantId: this.tid() }, include: { lines: true } });
    if (!ba) throw new BadRequestException('Berita Acara tidak ditemukan.');
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    let purchaseNumber = '';
    if (ba.purchaseId) {
      const po = await this.prisma.transaction.findFirst({ where: { id: ba.purchaseId, tenantId: this.tid() } });
      purchaseNumber = po?.number || '';
    }
    const lines = ba.lines.map((l) => ({
      bak: l.binNote || '—',
      ukuran: l.sizeLabel,
      jumlahAwal: this.num(l.qtyInitial),
      jumlahAktual: this.num(l.quantity),
      selisih: this.num(l.quantity) - this.num(l.qtyInitial),
      hargaEkor: this.num(l.price),
      subtotal: this.num(l.quantity) * this.num(l.price),
    }));
    const persenPlase = this.num(ba.plasePercent);
    const perUkuran: Record<string, { qty: number; harga: number }> = {};
    for (const it of lines) {
      if (!perUkuran[it.ukuran]) perUkuran[it.ukuran] = { qty: 0, harga: it.hargaEkor };
      perUkuran[it.ukuran].qty += it.jumlahAktual;
      if (it.hargaEkor > 0) perUkuran[it.ukuran].harga = it.hargaEkor;
    }
    let notaUntukPlase = 0;
    const plaseRows = Object.keys(perUkuran).map((ukuran) => {
      const p = perUkuran[ukuran];
      notaUntukPlase += p.qty * p.harga;
      return { ukuran, qty: p.qty, harga: p.harga, plaseQty: Math.round(p.qty * persenPlase / 100), plaseTotal: 0 };
    });
    const totalPlaseExcel = Math.round(notaUntukPlase * persenPlase / 100);
    if (plaseRows.length === 1) plaseRows[0].plaseTotal = totalPlaseExcel;
    else if (plaseRows.length > 1) {
      let sisa = totalPlaseExcel;
      for (let i = 0; i < plaseRows.length; i += 1) {
        if (i === plaseRows.length - 1) plaseRows[i].plaseTotal = sisa;
        else {
          const bagian = notaUntukPlase > 0 ? Math.round(totalPlaseExcel * (plaseRows[i].qty * plaseRows[i].harga) / notaUntukPlase) : 0;
          plaseRows[i].plaseTotal = bagian;
          sisa -= bagian;
        }
      }
    }
    const fmt = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
    const fmtQty = (n: number) => n.toLocaleString('id-ID');
    const d = (v: Date | null | undefined) => (v || ba.date).toLocaleDateString('id-ID');
    const sisaRaw = this.num(ba.sisaEstimasi);
    const lunas = sisaRaw <= 0;
    const tampilSisa = lunas ? 0 : sisaRaw;
    const sumAwal = lines.reduce((a, l) => a + l.jumlahAwal, 0);
    const sumAktual = lines.reduce((a, l) => a + l.jumlahAktual, 0);
    const sumSelisih = sumAktual - sumAwal;
    const sumSub = lines.reduce((a, l) => a + l.subtotal, 0);
    const kop = this.printHeaderHtml(tenant);
    const itemRows = lines.filter((l) => l.jumlahAwal > 0 || l.jumlahAktual > 0).map((l, i) => {
      const selColor = l.selisih < 0 ? '#E63946' : (l.selisih > 0 ? '#16A34A' : '#1F2937');
      const bg = i % 2 ? '#F0F2F5' : '#FFFFFF';
      return `<tr style="background:${bg}">
<td>${this.e(l.bak)}</td><td style="text-align:center;font-weight:700">${this.e(l.ukuran)}</td>
<td style="text-align:center">${fmtQty(l.jumlahAwal)}</td><td style="text-align:center">${fmtQty(l.jumlahAktual)}</td>
<td style="text-align:center;font-weight:700;color:${selColor}">${l.selisih > 0 ? '+' : ''}${fmtQty(l.selisih)}</td>
<td style="text-align:right">${fmt(l.hargaEkor)}</td><td style="text-align:right">${fmt(l.subtotal)}</td></tr>`;
    }).join('');
    const selTotColor = sumSelisih < 0 ? '#E63946' : (sumSelisih > 0 ? '#16A34A' : '#1F2937');
    const plaseTable = plaseRows.map((p) => `<tr>
<td>${this.e(p.ukuran)}</td><td style="text-align:right">${fmtQty(p.qty)}</td>
<td style="text-align:right">${fmtQty(p.plaseQty)}</td><td style="text-align:right">${fmt(p.plaseTotal)}</td></tr>`).join('');
    const bayarRows: Array<{ label: string; nilai: string; strong?: boolean; color?: string }> = [
      { label: 'Nota Benih Aktual', nilai: fmt(this.num(ba.notaAktual)), strong: true },
    ];
    if (this.num(ba.priorDebtNote) > 0) {
      bayarRows.push({
        label: ba.priorDebtRef ? `Sisa ${ba.priorDebtRef}` : 'Sisa PO Sebelumnya',
        nilai: fmt(this.num(ba.priorDebtNote)), color: '#B45309',
      });
    }
    bayarRows.push(
      { label: 'Down Payment (DP)', nilai: this.num(ba.dpNote) > 0 ? fmt(this.num(ba.dpNote)) : '—' },
      { label: 'Transport', nilai: this.num(ba.transport) > 0 ? fmt(this.num(ba.transport)) : '—' },
      { label: 'Jasa Bongkar', nilai: this.num(ba.jasaBongkar) > 0 ? fmt(this.num(ba.jasaBongkar)) : '—' },
    );
    if (this.num(ba.upahSopir) > 0) bayarRows.push({ label: 'Upah Sopir', nilai: fmt(this.num(ba.upahSopir)) });
    bayarRows.push(
      { label: `Plase ${persenPlase}%`, nilai: fmt(this.num(ba.totalPlase) || totalPlaseExcel) },
      { label: 'TOTAL UANG MASUK', nilai: fmt(this.num(ba.totalUangMasuk)), strong: true, color: '#16A34A' },
    );
    const bayarHtml = bayarRows.map((b) => {
      const bg = b.label === 'TOTAL UANG MASUK' ? 'background:#ECFDF5;' : '';
      return `<tr style="${bg}"><td style="font-weight:${b.strong ? 700 : 400};color:${b.color || '#1F2937'}">${this.e(b.label)}</td>
<td style="text-align:right;font-weight:${b.strong ? 700 : 400};color:${b.color || '#1F2937'}">${b.nilai}</td></tr>`;
    }).join('');
    return {
      title: `Berita Acara ${ba.number}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${this.e(ba.number)}</title>
<style>
@page{margin:12mm}
body{font-family:system-ui,-apple-system,sans-serif;color:#1F2937;padding:18px;margin:0;font-size:12px}
.navy{color:#0D1B3D}.muted{color:#6B7280}.bar{background:#0D1B3D;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;border-radius:4px}
.bar small{color:#E5E7EB;font-size:12px}
.sub{font-size:11px;color:#6B7280;margin:6px 0 10px}
.head{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;margin:12px 0 14px}
.head h1{margin:0;font-size:22px;color:#0D1B3D}.head .subjudul{font-size:12px;color:#6B7280;font-style:italic;margin-top:4px}
.ref{border:1px solid #E5E7EB;border-radius:4px;overflow:hidden}
.ref div{display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #E5E7EB;padding:6px 10px;font-size:12px}
.ref div:last-child{border-bottom:0}.ref span{color:#9CA3AF;font-size:10px;font-weight:700;text-transform:uppercase}
.ref b{text-align:right;color:#0D1B3D}
.info{display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:1px solid #E5E7EB;background:#FAFBFC;margin-bottom:14px}
.info > div{padding:8px 10px;border-right:1px solid #E5E7EB;font-size:11px}
.info > div:nth-child(5n){border-right:0}.info label{display:block;color:#9CA3AF;font-size:9px;text-transform:uppercase;margin-bottom:2px}
.info b{font-size:11.5px;color:#111827}
.sec{background:#F5F6F8;color:#0D1B3D;font-weight:700;padding:8px 10px;border-bottom:2px solid #16A34A;margin:14px 0 0;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:0}th,td{border:1px solid #E5E7EB;padding:6px 8px;font-size:11px}
th{background:#2A3F5F;color:#fff;font-size:10.5px;text-transform:uppercase}
.tot td{background:#F5F6F8;font-weight:700}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px;align-items:start}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
.badge-ok{background:#ECFDF5;color:#16A34A}.badge-due{background:#FEF2F2;color:#E63946}
.sisa-box{margin-top:12px}.sisa-box .lbl{font-size:11px;color:#6B7280}.sisa-box .val{font-size:14px;font-weight:700;margin-bottom:6px}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:28px;text-align:center;font-size:11px}
.sign .line{margin-top:48px;border-top:1px solid #CBD5E1;padding-top:6px}
.foot{margin-top:18px;font-size:10px;color:#9CA3AF;text-align:center;border-top:1px solid #E5E7EB;padding-top:8px}
.toolbar{margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap}
.toolbar button{padding:8px 14px;border-radius:8px;border:1px solid #CBD5E1;background:#0D1B3D;color:#fff;cursor:pointer;font-weight:600}
.toolbar .secbtn{background:#fff;color:#0D1B3D}
@media print{.toolbar{display:none} body{padding:0}}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">Cetak / Simpan PDF</button>
  <button class="secbtn" type="button" onclick="navigator.share?navigator.share({title:document.title,url:location.href}).catch(()=>{}):alert('Gunakan Cetak → Simpan sebagai PDF, lalu bagikan file.')">Share</button>
</div>
<div style="margin-bottom:8px">${kop}</div>
<div class="bar"><strong>${this.e(tenant.name)}</strong><small>Berita Acara</small></div>
${(tenant.address || tenant.phone) ? `<div class="sub">${this.e([tenant.address, tenant.phone].filter(Boolean).join(' · '))}</div>` : ''}
<div class="head">
  <div><h1>Berita Acara</h1><div class="subjudul">Penerimaan benih setelah tiba di kolam</div></div>
  <div class="ref">
    <div><span>No BA</span><b>${this.e(ba.number)}</b></div>
    <div><span>No PO</span><b>${this.e(purchaseNumber || '—')}</b></div>
    <div><span>Tgl Tiba</span><b>${this.e(d(ba.date))}</b></div>
    <div><span>Supplier</span><b>${this.e(ba.supplier)}</b></div>
  </div>
</div>
<div class="info">
  <div><label>Tgl Berangkat</label><b>${this.e(d(ba.dateDepart))}</b></div>
  <div><label>Kendaraan</label><b>${this.e(ba.vehicle || '—')}</b></div>
  <div><label>Checker</label><b>${this.e(ba.checker || '—')}</b></div>
  <div><label>Admin</label><b>${this.e(ba.adminName || '—')}</b></div>
  <div><label>Penerima</label><b>${this.e(ba.receiver || '—')}</b></div>
  <div><label>Lokasi Kolam</label><b>${this.e(ba.pondLocation || '—')}</b></div>
  <div><label>No Referensi</label><b>${this.e(ba.refNumber || '—')}</b></div>
  <div><label>Plase</label><b>${persenPlase}%</b></div>
  <div><label>Dicetak</label><b>${this.e(new Date().toLocaleDateString('id-ID'))}</b></div>
  <div><label>Via (catatan)</label><b>${this.e(ba.payMethodNote || 'Kas')}</b></div>
</div>
<div class="sec">Data Penerimaan Benih per Bak &amp; Ukuran</div>
<table><thead><tr><th>Bak</th><th>Uk</th><th>Jml Awal</th><th>Jml Aktual</th><th>Selisih</th><th>Harga/Ekor</th><th>Subtotal</th></tr></thead>
<tbody>${itemRows || '<tr><td colspan="7">Tidak ada data</td></tr>'}
<tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:center">${fmtQty(sumAwal)}</td><td style="text-align:center">${fmtQty(sumAktual)}</td>
<td style="text-align:center;color:${selTotColor}">${sumSelisih > 0 ? '+' : ''}${fmtQty(sumSelisih)}</td><td></td>
<td style="text-align:right;color:#0D1B3D">${fmt(sumSub)}</td></tr></tbody></table>
<div class="grid2">
  <div>
    <div class="sec">Ringkasan Pembayaran (estimasi)</div>
    <table><tbody>${bayarHtml}</tbody></table>
    <div style="margin-top:10px"><span class="badge ${lunas ? 'badge-ok' : 'badge-due'}">${lunas ? 'LUNAS (estimasi)' : 'BELUM LUNAS (estimasi)'}</span>
    <span class="muted" style="font-size:10px;margin-left:6px">tidak masuk kas/bank</span></div>
    <div class="sisa-box">
      <div class="lbl">Total Tagihan</div><div class="val">${fmt(this.num(ba.totalTagihan))}</div>
      <div class="lbl">Total Dibayar</div><div class="val">${fmt(this.num(ba.totalUangMasuk))}</div>
      <div class="lbl navy">Sisa Pembayaran</div><div class="val navy">${fmt(tampilSisa)}</div>
    </div>
  </div>
  <div>
    <div class="sec">Rincian Plase ${persenPlase}%</div>
    <table><thead><tr><th>Ukuran</th><th>Qty</th><th>Plase Qty</th><th>Nilai</th></tr></thead>
    <tbody>${plaseTable || '<tr><td colspan="4">—</td></tr>'}
    <tr class="tot"><td colspan="3">Total Plase</td><td style="text-align:right">${fmt(this.num(ba.totalPlase) || totalPlaseExcel)}</td></tr></tbody></table>
  </div>
</div>
${ba.notes ? `<p class="muted" style="margin-top:12px;font-style:italic">Keterangan: ${this.e(ba.notes)}</p>` : ''}
<div class="sign">
  <div>Supplier<div class="line">${this.e(ba.supplier)}</div></div>
  <div>Checker<div class="line">${this.e(ba.checker || '—')}</div></div>
  <div>Admin<div class="line">${this.e(ba.adminName || '—')}</div></div>
</div>
<div class="foot">Dokumen serah terima — angka keuangan hanya catatan. Pembayaran resmi di menu Pembelian. · ${this.e(d(ba.date))}</div>
</body></html>`,
    };
  }

  async documentSuratJalan(input: { id?: string } = {}) {
    if (!input.id) throw new BadRequestException('ID wajib.');
    const sj = await this.prisma.suratJalan.findFirst({ where: { id: input.id, tenantId: this.tid() }, include: { lines: true } });
    if (!sj) throw new BadRequestException('Surat Jalan tidak ditemukan.');
    const tenant = await this.prisma.workspace.findUniqueOrThrow({ where: { id: this.tid() } });
    const totalQty = sj.lines.reduce((s, l) => s + this.num(l.quantity), 0);
    const totalKantong = sj.lines.reduce((s, l) => s + this.num(l.bagCount), 0);
    const bakUnik = new Set(sj.lines.map((l) => (l.binNote || '').trim()).filter(Boolean));
    const jumlahBak = bakUnik.size > 0 ? bakUnik.size : sj.lines.length;
    const rows = sj.lines.map((l, i) => {
      const bg = i % 2 ? '#F0F2F5' : '#fff';
      return `<tr style="background:${bg}"><td>${i + 1}</td>
<td>${this.e(l.sizeLabel || l.productName)}</td>
<td style="text-align:right">${this.num(l.quantity).toLocaleString('id-ID')}</td>
<td style="text-align:right">${this.num(l.bagCount).toLocaleString('id-ID')}</td>
<td>${this.e(l.binNote || '—')}</td></tr>`;
    }).join('');
    const body = `<div class="sec">Rincian Pengiriman</div>
<table><thead><tr><th>#</th><th>Varian / ukuran</th><th>Qty</th><th>Kantong</th><th>Lokasi / bak</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr class="tot"><td colspan="2">Total</td><td style="text-align:right">${totalQty.toLocaleString('id-ID')}</td>
<td style="text-align:right">${totalKantong.toLocaleString('id-ID')}</td><td></td></tr></tfoot></table>
<div class="grid2" style="margin-top:14px"><div>
<table><tbody>
<tr><td>Kendaraan</td><td style="text-align:right"><b>${this.e(sj.vehicle || '—')}</b></td></tr>
<tr><td>Sopir</td><td style="text-align:right">${this.e(sj.driver || '—')}</td></tr>
<tr><td>Tujuan</td><td style="text-align:right">${this.e(sj.destination || '—')}</td></tr>
</tbody></table></div><div>
<table><tbody>
<tr><td>Jumlah bak</td><td style="text-align:right"><b>${jumlahBak}</b></td></tr>
<tr><td>Total qty</td><td style="text-align:right">${totalQty.toLocaleString('id-ID')}</td></tr>
<tr><td>Total kantong</td><td style="text-align:right">${totalKantong.toLocaleString('id-ID')}</td></tr>
</tbody></table></div></div>`;
    return {
      title: `Surat Jalan ${sj.number}`,
      html: this.buildOfficialDoc({
        tenant, title: 'Surat Jalan', badge: 'Surat Jalan',
        subjudul: 'Dokumen pengiriman dari transaksi penjualan',
        refItems: [
          { label: 'No SJ', value: sj.number },
          { label: 'Ref. Penjualan', value: sj.saleRef || '—' },
          { label: 'Tgl Berangkat', value: sj.date.toLocaleDateString('id-ID') },
          { label: 'Pelanggan', value: sj.customer },
        ],
        infoItems: [
          { label: 'Kendaraan', value: sj.vehicle || '—' },
          { label: 'Sopir', value: sj.driver || '—' },
          { label: 'Tujuan', value: sj.destination || '—' },
          { label: 'Status', value: sj.status },
        ],
        bodyHtml: body,
        note: sj.notes || undefined,
        signatures: [
          { label: 'Pengirim', name: 'Admin' },
          { label: 'Sopir', name: sj.driver || '—' },
          { label: 'Penerima', name: sj.customer },
        ],
        footer: `Surat Jalan ${sj.number} · ${sj.customer}`,
      }),
    };
  }

}


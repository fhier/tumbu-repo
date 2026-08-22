'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { openPrintDocument } from './print';
import { renderAndPrintReceipt } from './receipt-renderer';
import {
  TxModulePage, TxDrawer, TxSection, TxIconBtn, TxPager, useClientPager, moneyFmt, downloadCsv, printHtmlTable,
} from './tx-shell';
import {
  COMMODITY_CATEGORIES,
  FISH_SPECIES_OPTIONS,
  formatQtyWithUnit,
  normalizeCommodityCategory,
  unitLabelForCommodity,
  type CommodityCategory,
} from '@tumbu/domain';
import { filterSpeciesLabelOptions } from './filter-context';

type Product = {
  id: string; name: string; unit: string; stock: number; minStock: number; price: number; sizeLabel?: string;
  commodityCategory?: string; species?: string; unitLabel?: string;
};
type Partner = { id: string; name: string; phone?: string; type: 'CUSTOMER' | 'SUPPLIER' };
type TxItem = {
  productId: string; productName?: string; sizeLabel?: string; quantity: number; price: number;
  weight?: number; sampling?: number; flaseType?: string; flasePercent?: number; bonusQty?: number; discountAmount?: number;
  unit?: string; species?: string; commodityCategory?: string; quantityText?: string; unitLabel?: string;
};
type Transaction = {
  id: string; number: string; date: string; type: 'SALE' | 'PURCHASE'; partner: string; total: number;
  paidAmount?: number; remaining?: number; status: 'PAID' | 'DUE'; notes?: string; account?: string; baId?: string;
  discountAmount?: number; feeAmount?: number; meta?: Record<string, unknown>;
  fees?: Array<{ kind: string; label: string; amount: number }>;
  items: TxItem[];
};
type BeritaAcara = {
  id: string; number: string; date: string; supplier: string; status: string; notes?: string; purchaseId?: string;
  plasePercent?: number; transport?: number; jasaBongkar?: number; upahSopir?: number; dpNote?: number;
  priorDebtNote?: number; priorDebtRef?: string; payMethodNote?: string;
  lines: Array<{ sizeLabel: string; quantity: number; price: number; qtyInitial?: number; binNote?: string }>;
};

const money = moneyFmt;

const todayISO = () => new Date().toISOString().slice(0, 10);
const MAX_ITEMS = 10;
const MAX_FEES = 10;
const ONGIR_OPTIONS = ['Sewa Mobil', 'Jasa Bongkar', 'Bensin', 'E-toll', 'BOP', 'Lainnya'];

type LineState = {
  productId: string; sizeLabel: string; quantity: number; price: number; weight: number; sampling: number;
  flaseType: 'none' | 'bonus' | 'potongan'; flasePercent: number;
  commodityCategory: CommodityCategory; species: string;
};

const emptyLine = (): LineState => ({
  productId: '', sizeLabel: '', quantity: 0, price: 0, weight: 0, sampling: 0, flaseType: 'none', flasePercent: 0,
  commodityCategory: 'BENIH', species: '',
});

function calcLine(line: LineState) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.price) || 0;
  const subtotal = qty * price;
  const bonusQty = line.flaseType === 'bonus' ? Math.round(qty * (Number(line.flasePercent) || 0) / 100) : 0;
  const discount = line.flaseType === 'potongan' ? Math.round(subtotal * (Number(line.flasePercent) || 0) / 100) : 0;
  return { qty, price, subtotal, bonusQty, discount, nominal: Math.max(0, subtotal - discount), stockQty: qty + bonusQty };
}

function lineHasProduct(line: LineState) {
  return Boolean(String(line.productId || '').trim() || String(line.sizeLabel || '').trim());
}

function mapLinePayload(line: LineState) {
  return {
    productId: line.productId || undefined,
    sizeLabel: line.sizeLabel || undefined,
    quantity: line.quantity,
    price: line.price,
    weight: line.weight,
    sampling: line.sampling,
    flaseType: line.flaseType,
    flasePercent: line.flasePercent,
    commodityCategory: line.commodityCategory,
    species: line.species || undefined,
  };
}

function itemToLine(it: TxItem): LineState {
  return {
    productId: it.productId,
    sizeLabel: it.sizeLabel || it.productName || '',
    quantity: it.quantity,
    price: it.price,
    weight: it.weight || 0,
    sampling: it.sampling || 0,
    flaseType: (it.flaseType as LineState['flaseType']) || 'none',
    flasePercent: it.flasePercent || 0,
    commodityCategory: normalizeCommodityCategory(it.commodityCategory),
    species: it.species || '',
  };
}

function txStatusLabel(r: Transaction) {
  if (r.status === 'PAID') return 'Lunas';
  if ((r.paidAmount || 0) > 0) return 'DP';
  return 'Belum lunas';
}

function txStatusKey(r: Transaction): 'PAID' | 'DUE' | 'DP' {
  if (r.status === 'PAID') return 'PAID';
  if ((r.paidAmount || 0) > 0) return 'DP';
  return 'DUE';
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ItemRows({
  lines, setLines, products, sizes = [], showStock, allowedSpecies = [],
}: {
  lines: LineState[];
  setLines: (lines: LineState[]) => void;
  products: Product[];
  sizes?: Array<{ id: string; label: string }>;
  showStock?: boolean;
  allowedSpecies?: string[];
}) {
  const update = (idx: number, patch: Partial<LineState>) => {
    setLines(lines.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      if (patch.commodityCategory) {
        next.commodityCategory = normalizeCommodityCategory(patch.commodityCategory);
      }
      if (next.commodityCategory === 'BENIH' && (patch.weight != null || patch.sampling != null)) {
        const w = patch.weight != null ? Number(patch.weight) : next.weight;
        const s = patch.sampling != null ? Number(patch.sampling) : next.sampling;
        if (w > 0 && s > 0) next.quantity = Math.round(w * s);
      }
      return next;
    }));
  };

  const sizeLabels = sizes.map((s) => s.label).filter(Boolean);
  const productBySize = new Map(
    products.filter((p) => String(p.sizeLabel || '').trim()).map((p) => [String(p.sizeLabel).trim(), p]),
  );
  const extraProducts = products.filter((p) => {
    const sl = String(p.sizeLabel || '').trim();
    return !sl || !sizeLabels.includes(sl);
  });
  const speciesListId = 'tx-fish-species';
  const speciesOpts = filterSpeciesLabelOptions([...FISH_SPECIES_OPTIONS], allowedSpecies);

  return (
    <>
      <datalist id={speciesListId}>
        {speciesOpts.map((s) => <option key={s} value={s} />)}
      </datalist>
      {lines.map((line, i) => {
        const c = calcLine(line);
        const p = products.find((x) => x.id === line.productId);
        const listId = `tx-produk-ukuran-${i}`;
        const displayValue = line.sizeLabel
          || (p ? (p.sizeLabel || p.name) : '');
        const unitLabel = unitLabelForCommodity(line.commodityCategory);
        const isBenih = line.commodityCategory === 'BENIH';
        return (
          <div key={i} className="tx-item-card">
            <div className="tx-item-head">
              <strong>Item #{i + 1}</strong>
              <button type="button" className="btn-secondary" disabled={lines.length <= 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Hapus</button>
            </div>
            <div className="form form-2" style={{ margin: 0 }}>
              <label className="field">
                <span>Kategori komoditas *</span>
                <select
                  value={line.commodityCategory}
                  onChange={(e) => update(i, { commodityCategory: e.target.value as CommodityCategory })}
                  required={i === 0}
                >
                  {COMMODITY_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Jenis / spesies ikan</span>
                <input
                  list={speciesListId}
                  value={line.species}
                  placeholder="Contoh: Nila Merah, Lele"
                  onChange={(e) => update(i, { species: e.target.value })}
                />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Produk / ukuran{i === 0 ? ' *' : ''}</span>
                <input
                  list={listId}
                  value={displayValue}
                  placeholder={i === 0 ? 'Pilih ukuran master atau ketik manual' : `Produk ${i + 1}`}
                  required={i === 0}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const matchedSize = sizeLabels.find((s) => s === raw);
                    const matchedProduct = products.find((pr) =>
                      pr.id === raw
                      || pr.name === raw
                      || pr.sizeLabel === raw
                      || `${pr.name} · ${pr.sizeLabel || ''}`.trim() === raw
                    );
                    if (matchedProduct) {
                      update(i, {
                        productId: matchedProduct.id,
                        sizeLabel: matchedProduct.sizeLabel || matchedProduct.name,
                        price: matchedProduct.price || line.price,
                        commodityCategory: normalizeCommodityCategory(matchedProduct.commodityCategory),
                        species: matchedProduct.species || line.species,
                      });
                      return;
                    }
                    if (matchedSize) {
                      const bySize = productBySize.get(matchedSize);
                      update(i, {
                        productId: bySize?.id || '',
                        sizeLabel: matchedSize,
                        price: bySize?.price || line.price,
                        commodityCategory: bySize
                          ? normalizeCommodityCategory(bySize.commodityCategory)
                          : line.commodityCategory,
                        species: bySize?.species || line.species,
                      });
                      return;
                    }
                    update(i, { productId: '', sizeLabel: raw });
                  }}
                />
                <datalist id={listId}>
                  {sizeLabels.map((label) => {
                    const bySize = productBySize.get(label);
                    const stockBit = showStock && bySize
                      ? ` · stok ${formatQtyWithUnit(bySize.stock, bySize.unit || bySize.commodityCategory || 'ekor')}`
                      : '';
                    return <option key={`s-${label}`} value={label}>{`Ukuran ${label}${stockBit}`}</option>;
                  })}
                  {extraProducts.map((pr) => {
                    const size = String(pr.sizeLabel || '').trim();
                    const name = String(pr.name || '').trim();
                    const label = size && !name.toLowerCase().includes(size.toLowerCase())
                      ? `${name} · ${size}`
                      : name;
                    const stockBit = showStock
                      ? ` · stok ${formatQtyWithUnit(pr.stock, pr.unit || pr.commodityCategory || 'ekor')}`
                      : '';
                    return (
                      <option key={pr.id} value={pr.sizeLabel || pr.name}>
                        {`${label}${stockBit}`}
                      </option>
                    );
                  })}
                </datalist>
              </label>
              {isBenih ? (
                <>
                  <label className="field"><span>Berat (kg)</span>
                    <input type="number" min="0" step="0.001" value={line.weight || ''} onChange={(e) => update(i, { weight: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="field"><span>Sampling /kg</span>
                    <input type="number" min="0" step="0.001" value={line.sampling || ''} onChange={(e) => update(i, { sampling: Number(e.target.value) || 0 })} />
                  </label>
                </>
              ) : null}
              <label className="field"><span>Qty ({unitLabel}) *</span>
                <input type="number" min="0" step="0.001" value={line.quantity || ''} onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })} required={i === 0} />
              </label>
              <label className="field"><span>Harga / {unitLabel}</span>
                <input type="number" min="0" value={line.price || ''} onChange={(e) => update(i, { price: Number(e.target.value) || 0 })} />
              </label>
              <label className="field"><span>Satuan (otomatis)</span>
                <input value={unitLabel} readOnly />
              </label>
              <label className="field"><span>Jenis potongan</span>
                <select value={line.flaseType} onChange={(e) => update(i, { flaseType: e.target.value as LineState['flaseType'] })}>
                  <option value="none">Tanpa potongan</option>
                  <option value="bonus">Bonus qty (%)</option>
                  <option value="potongan">Potongan harga (%)</option>
                </select>
              </label>
              <label className="field"><span>Nilai potongan (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={line.flasePercent || ''}
                  onChange={(e) => update(i, { flasePercent: Number(e.target.value) || 0 })}
                  disabled={line.flaseType === 'none'}
                />
              </label>
            </div>
            <div className="hint" style={{ margin: '8px 0 0' }}>
              Subtotal {money(c.nominal)}
              {c.bonusQty > 0 ? ` · +${formatQtyWithUnit(c.bonusQty, line.commodityCategory)} bonus` : ''}
              {c.discount > 0 ? ` · potongan ${money(c.discount)}` : ''}
              {' · '}{formatQtyWithUnit(c.qty, line.commodityCategory)}
              {showStock && p && c.stockQty > p.stock ? <span className="danger"> · stok kurang (tetap bisa disimpan)</span> : null}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="btn-add-row"
        style={{ width: '100%', padding: '10px', justifyContent: 'center', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#64748B', marginTop: '12px' }}
        disabled={lines.length >= MAX_ITEMS}
        onClick={() => setLines([...lines, emptyLine()])}
      >
        + Tambah Item / Baris
      </button>
    </>
  );
}

export function PembelianPanel({ products = [], sizes = [], suppliers = [], purchases = [], beritaAcara = [], apiFetch, onNotify, onRefresh, canDelete = false, allowedSpecies = [] }: {
  products: Product[]; sizes?: Array<{ id: string; label: string }>; suppliers: Partner[]; purchases: Transaction[]; beritaAcara: BeritaAcara[];
  onPurchase?: (e: FormEvent<HTMLFormElement>) => void;
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void; onRefresh: () => void;
  canDelete?: boolean;
  allowedSpecies?: string[];
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safeBeritaAcara = Array.isArray(beritaAcara) ? beritaAcara : [];
  const [editId, setEditId] = useState('');
  const [baId, setBaId] = useState('');
  const [sumber, setSumber] = useState<'manual' | 'ba'>('manual');
  const [tanggal, setTanggal] = useState(todayISO());
  const [partner, setPartner] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerAddress, setPartnerAddress] = useState('');
  const [lines, setLines] = useState<LineState[]>([{ ...emptyLine(), quantity: 1 }]);
  const [payStatus, setPayStatus] = useState<'PAID' | 'DUE' | 'DP'>('DUE');
  const [dp, setDp] = useState(0);
  const [account, setAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [transport, setTransport] = useState(0);
  const [jasaBongkar, setJasaBongkar] = useState(0);
  const [upahSopir, setUpahSopir] = useState(0);
  const [plasePercent, setPlasePercent] = useState(0);
  const [plaseType, setPlaseType] = useState<'EXTRA' | 'DISCOUNT'>('EXTRA');
  const [priorDebt, setPriorDebt] = useState(0);
  const [priorDebtRef, setPriorDebtRef] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'DUE' | 'DP'>('all');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payId, setPayId] = useState<string | null>(null);

  const ringkas = useMemo(() => {
    let qty = 0; let kotor = 0; let potongan = 0;
    for (const l of lines) {
      const c = calcLine(l);
      qty += c.stockQty; kotor += c.subtotal; potongan += c.discount;
    }
    const nota = Math.max(0, kotor - potongan);
    const plaseVal = Math.round(nota * plasePercent / 100);
    const plase = plaseType === 'EXTRA' ? plaseVal : -plaseVal;
    const tagihan = nota + plase + priorDebt;
    const uangMasuk = (payStatus === 'PAID' ? Math.max(dp, nota + plase) : dp) + transport + jasaBongkar + upahSopir;
    const sisa = payStatus === 'PAID' ? 0 : Math.max(0, tagihan - uangMasuk);
    const bayarPO = Math.max(0, nota + plase);
    return { qty, nota, plase, dp, tagihan, uangMasuk, sisa, status: payStatus, bayarPO, plaseVal, plasePercent, plaseType, priorDebt };
  }, [lines, dp, transport, jasaBongkar, upahSopir, plasePercent, plaseType, priorDebt, payStatus]);

  const reset = () => {
    setEditId(''); setBaId(''); setSumber('manual'); setTanggal(todayISO());
    setPartner(''); setPartnerPhone(''); setPartnerAddress('');
    setLines([{ ...emptyLine(), quantity: 1 }]); setPayStatus('DUE'); setDp(0); setAccount('CASH');
    setTransport(0); setJasaBongkar(0); setUpahSopir(0); setPlasePercent(0);
    setPriorDebt(0); setPriorDebtRef(''); setNotes('');
  };

  const loadBa = async (id: string) => {
    try {
      const preview = await apiFetch<{
        baId: string; partner: string; baNumber?: string; notes?: string;
        items: Array<{ productId: string; productName?: string; sizeLabel?: string; quantity: number; price: number }>;
        plasePercent?: number; transport?: number; jasaBongkar?: number; upahSopir?: number;
        dpNote?: number; priorDebt?: number; priorDebtRef?: string; account?: 'CASH' | 'BANK';
      }>(`/erp/berita-acara/preview-po?baId=${encodeURIComponent(id)}`);
      setBaId(preview.baId); setEditId(''); setSumber('ba'); setPartner(preview.partner);
      setLines(preview.items.slice(0, MAX_ITEMS).map((it) => ({
        ...emptyLine(),
        productId: it.productId,
        sizeLabel: it.sizeLabel || it.productName || '',
        quantity: it.quantity,
        price: it.price,
      })));
      setPlasePercent(Number(preview.plasePercent) || 0);
      setPlaseType((preview as any).plaseType === 'DISCOUNT' ? 'DISCOUNT' : 'EXTRA');
      setTransport(Number(preview.transport) || 0);
      setJasaBongkar(Number(preview.jasaBongkar) || 0);
      setUpahSopir(Number(preview.upahSopir) || 0);
      setDp(Number(preview.dpNote) || 0);
      setPayStatus(Number(preview.dpNote) > 0 ? 'DP' : 'DUE');
      setPriorDebt(Number(preview.priorDebt) || 0);
      setPriorDebtRef(preview.priorDebtRef || '');
      setAccount(preview.account === 'BANK' ? 'BANK' : 'CASH');
      setNotes(preview.notes || `Dari BA ${preview.baNumber || ''}`);
      onNotify('BA dimuat — periksa harga lalu simpan sebagai PO (arus kas hanya saat PO disimpan).');
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal muat BA'); }
  };

  const loadEdit = (row: Transaction) => {
    setEditId(row.id); setBaId(row.baId || ''); setSumber(row.baId ? 'ba' : 'manual');
    setTanggal(row.date.slice(0, 10)); setPartner(row.partner);
    setPartnerPhone(String(row.meta?.partnerPhone || '')); setPartnerAddress(String(row.meta?.partnerAddress || ''));
    setNotes(row.notes || ''); setAccount(row.account === 'BANK' ? 'BANK' : 'CASH');
    const paid = row.paidAmount || 0;
    if (row.status === 'PAID') { setPayStatus('PAID'); setDp(paid || row.total || 0); }
    else if (paid > 0) { setPayStatus('DP'); setDp(paid); }
    else { setPayStatus('DUE'); setDp(0); }
    setPlasePercent(Number(row.meta?.plasePercent) || 0);
    setPlaseType(row.meta?.plaseType === 'DISCOUNT' ? 'DISCOUNT' : 'EXTRA');
    setPriorDebt(Number(row.meta?.priorDebt) || 0);
    setPriorDebtRef(String(row.meta?.priorDebtRef || ''));
    setTransport(Number(row.meta?.transport) || 0);
    setJasaBongkar(Number(row.meta?.jasaBongkar) || 0);
    setUpahSopir(Number(row.meta?.upahSopir) || 0);
    setLines(row.items.length ? row.items.map(itemToLine) : [{ ...emptyLine(), quantity: 1 }]);
  };

  const openCreate = () => { reset(); setDrawerOpen(true); };
  const openEdit = (row: Transaction) => { loadEdit(row); setDrawerOpen(true); };
  const openDup = (row: Transaction) => { loadEdit(row); setEditId(''); setDrawerOpen(true); };
  const closeDrawer = () => { reset(); setDrawerOpen(false); };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const items = lines
      .filter((l) => lineHasProduct(l))
      .map((l) => ({ ...l, quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1 }))
      .map(mapLinePayload);
    if (!partner) { onNotify('Nama supplier wajib diisi.'); return; }
    if (!items.length) { onNotify('Minimal satu item barang/benih wajib diisi.'); return; }
    setBusy(true);
    try {
      const payload = {
        type: 'PURCHASE' as const,
        partner, partnerPhone, partnerAddress, date: tanggal, notes, account,
        status: payStatus,
        paidAmount: payStatus === 'DP' ? dp : (payStatus === 'PAID' ? ringkas.tagihan : 0),
        nominalDP: payStatus === 'DP' ? dp : undefined,
        plasePercent, plaseType, priorDebt, priorDebtRef, transport, jasaBongkar, upahSopir,
        items, ...(baId ? { baId } : {}), ...(editId ? { id: editId } : {}),
      };
      const data = await apiFetch<Transaction>(editId ? '/erp/transactions' : '/erp/transactions', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onNotify(`${data.number || 'Pembelian'} berhasil ${editId ? 'diperbarui' : 'disimpan'}.`);
      reset();
      setDrawerOpen(false);
      onRefresh();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal simpan PO Pembelian'); }
    finally { setBusy(false); }
  };

  const openBas = beritaAcara.filter((b) => b.status !== 'IMPORTED' && !b.purchaseId);
  const duePurchases = purchases.filter((p) => (p.remaining || 0) > 0 && (!partner.trim() || p.partner.trim().toLowerCase() === partner.trim().toLowerCase()));

  const today = todayISO();
  const ym = monthKey();
  const summary = useMemo(() => {
    const monthTotal = purchases.filter((p) => p.date.slice(0, 7) === ym).reduce((s, p) => s + p.total, 0);
    return [
      { label: 'Jumlah transaksi', value: String(purchases.length), tone: 'navy' as const },
      { label: 'Total bulan ini', value: money(monthTotal), tone: 'teal' as const },
      { label: 'Belum lunas', value: String(purchases.filter((p) => p.status === 'DUE' && (p.remaining || 0) > 0).length), tone: 'red' as const },
      { label: 'Lunas', value: String(purchases.filter((p) => p.status === 'PAID').length), tone: 'green' as const },
      { label: 'DP', value: String(purchases.filter((p) => (p.paidAmount || 0) > 0 && p.status !== 'PAID').length), tone: 'purple' as const },
      { label: 'Hari ini', value: String(purchases.filter((p) => p.date.slice(0, 10) === today).length), tone: 'navy' as const },
    ];
  }, [purchases, ym, today]);

  const filtered = useMemo(() => purchases.filter((r) => {
    if (q.trim()) {
      const hay = `${r.number} ${r.partner} ${r.status}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    if (statusFilter !== 'all' && txStatusKey(r) !== statusFilter) return false;
    if (partnerFilter.trim() && !r.partner.toLowerCase().includes(partnerFilter.trim().toLowerCase())) return false;
    const d = r.date.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }), [purchases, q, statusFilter, partnerFilter, dateFrom, dateTo]);

  const pager = useClientPager(filtered, 10);

  const exportHeaders = ['Dokumen', 'Partner', 'Tanggal', 'Status', 'Total', 'Sisa'];
  const exportRows = () => filtered.map((r) => [
    r.number, r.partner, new Date(r.date).toLocaleDateString('id-ID'), txStatusLabel(r), String(r.total), String(r.remaining || 0),
  ]);

  const ringkasMini = (
    <div className="txm-ringkas-mini">
      <div><span>Subtotal</span><b>{money(ringkas.nota)}</b></div>
      {ringkas.plasePercent > 0 && (
        <div style={{ color: ringkas.plaseType === 'DISCOUNT' ? '#DC2626' : '#059669' }}>
          <span>Adj ({ringkas.plaseType === 'EXTRA' ? '+' : '-'}{ringkas.plasePercent}%)</span>
          <b>{ringkas.plaseType === 'EXTRA' ? '+' : '-'}{money(ringkas.plaseVal)}</b>
        </div>
      )}
      {ringkas.priorDebt > 0 && <div><span>Sisa PO lalu</span><b>+{money(ringkas.priorDebt)}</b></div>}
      <div><span>Tagihan</span><b>{money(ringkas.tagihan)}</b></div>
      <div><span>Masuk</span><b>{money(ringkas.uangMasuk)}</b></div>
      <div><span>Sisa</span><b className={ringkas.sisa > 0 ? 'is-loss' : 'is-ok'}>{money(ringkas.sisa)}</b></div>
    </div>
  );


  return (
    <>
      <TxModulePage
        title="Pembelian"
        breadcrumb="Transaksi"
        hint="Kelola PO, status hutang, dan cetak Nota. Tambah atau edit lewat drawer."
        onRefresh={onRefresh}
        onAdd={openCreate}
        addLabel="+ Tambah Pembelian"
        summary={summary}
        toolbar={(
          <>
            <input type="search" placeholder="Cari PO / supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Semua status</option>
              <option value="PAID">Lunas</option>
              <option value="DUE">Belum lunas</option>
              <option value="DP">DP</option>
            </select>
            <input type="search" placeholder="Filter supplier" value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Dari tanggal" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Sampai tanggal" />
            <button type="button" className="btn-secondary btn-sm" onClick={() => downloadCsv('pembelian.csv', exportHeaders, exportRows())}>Export CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => printHtmlTable('Daftar Pembelian', exportHeaders, exportRows())}>Print list</button>
          </>
        )}
      >
        <div className="txm-table-scroll">
          {!filtered.length ? (
            <p className="txm-empty">Belum ada data.</p>
          ) : (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Partner</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Sisa</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="txm-doc"><b>{r.number}</b></td>
                      <td>{r.partner}</td>
                      <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                      <td>
                        <span className={`badge ${r.status === 'PAID' ? 'badge-lunas' : 'badge-due'}`}>{txStatusLabel(r)}</span>
                      </td>
                      <td>{money(r.total)}</td>
                      <td>{(r.remaining || 0) > 0 ? money(r.remaining || 0) : '—'}</td>
                      <td>
            <div className="txm-actions" style={{ gap: '4px' }}>
              <TxIconBtn icon="print" label="Nota" onClick={async () => {
                try {
                  const data = await apiFetch<any>(`/receipt/data?transactionId=${r.id}`);
                  renderAndPrintReceipt(data);
                  onNotify(`Struk ${r.number} siap.`);
                } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal cetak'); }
              }} />
              <TxIconBtn icon="edit" label="Edit" onClick={() => openEdit(r)} />
              <TxIconBtn icon="copy" label="Dup" onClick={() => openDup(r)} />
              {(r.remaining || 0) > 0 && (
                <TxIconBtn icon="pay" label="Bayar" pay onClick={() => setPayId(payId === r.id ? null : r.id)} />
              )}
            </div>
                      </td>
                    </tr>
                    {payId === r.id ? (
                      <tr className="txm-pay-row">
                        <td colSpan={7}>
                          <form className="form" style={{ margin: 0 }} onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            try {
                              await apiFetch('/erp/transactions/pay', {
                                method: 'POST',
                                body: JSON.stringify({ id: r.id, amount: Number(f.get('amount')), account: f.get('account') === 'BANK' ? 'BANK' : 'CASH' }),
                              });
                              onNotify(`Pembayaran ${r.number} dicatat.`);
                              setPayId(null);
                              onRefresh();
                            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal bayar'); }
                          }}>
                            <input name="amount" type="number" min="1" defaultValue={r.remaining} required />
                            <select name="account"><option value="CASH">Kas</option><option value="BANK">Bank</option></select>
                            <button type="submit">Simpan pembayaran</button>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title={editId ? 'Edit Pembelian' : 'Tambah Pembelian'}
        hint="Isi dokumen, item, dan biaya — lalu Simpan."
        onClose={closeDrawer}
        summary={ringkasMini}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={closeDrawer}>Batal</button>
            <button type="button" className="txm-btn-save" disabled={busy} onClick={() => void submit()}>{busy ? 'Menyimpan…' : (editId ? 'Simpan Perubahan' : 'Simpan Pembelian')}</button>
          </>
        )}
      >
        <form id="pembelian-form" className="form form-2" noValidate onSubmit={(e) => void submit(e)}>
          {editId ? <p className="hint" style={{ color: '#B45309', gridColumn: '1 / -1' }}>Mengedit {editId.slice(-6)} — stok & kas disesuaikan saat simpan.</p> : null}
          <TxSection title="Dokumen">
            {!editId && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', gridColumn: '1 / -1' }}>
                <button type="button" className={sumber === 'manual' ? 'txm-btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setSumber('manual'); setBaId(''); }}>Input Manual</button>
                <button type="button" className={sumber === 'ba' ? 'txm-btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setSumber('ba')}>Ambil data dari Berita Acara / BA</button>
              </div>
            )}
            {sumber === 'ba' && !editId && (
              <div style={{ marginBottom: 12, gridColumn: '1 / -1' }}>
                <select defaultValue="" onChange={(e) => { if (e.target.value) void loadBa(e.target.value); }}>
                  <option value="">— Pilih Berita Acara —</option>
                  {openBas.map((ba) => <option key={ba.id} value={ba.id}>{ba.number} · {ba.supplier} · {ba.lines.length} baris</option>)}
                </select>
                <p className="hint">Review harga setelah BA dimuat, lalu simpan sebagai PO.</p>
              </div>
            )}
            <label className="field"><span>Tanggal</span><input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required /></label>
            <label className="field"><span>Supplier</span><input list="suppliers-po" value={partner} onChange={(e) => setPartner(e.target.value)} required placeholder="Nama supplier" /></label>
            <datalist id="suppliers-po">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            <label className="field"><span>No. HP</span><input value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} placeholder="Opsional" /></label>
            <label className="field"><span>Alamat</span><input value={partnerAddress} onChange={(e) => setPartnerAddress(e.target.value)} placeholder="Opsional" /></label>
          </TxSection>

          <TxSection title="Item">
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              <ItemRows lines={lines} setLines={setLines} products={products} sizes={sizes} allowedSpecies={allowedSpecies} />
            </div>
          </TxSection>

          <TxSection title="Biaya">
            <label className="field"><span>Status pembayaran</span>
              <select
                value={payStatus}
                onChange={(e) => {
                  const next = e.target.value as typeof payStatus;
                  setPayStatus(next);
                  if (next === 'DUE') setDp(0);
                  if (next === 'PAID') setDp(0);
                }}
              >
                <option value="DUE">Hutang</option>
                <option value="DP">DP (bayar sebagian)</option>
                <option value="PAID">Lunas</option>
              </select>
            </label>
            {payStatus === 'DP' && (
              <label className="field"><span>Nominal DP</span>
                <input type="number" min="0" value={dp || ''} onChange={(e) => setDp(Number(e.target.value) || 0)} required />
              </label>
            )}
            <label className="field"><span>Via bayar</span><select value={account} onChange={(e) => setAccount(e.target.value as 'CASH' | 'BANK')}><option value="CASH">Kas</option><option value="BANK">Bank</option></select></label>
            <label className="field"><span>Transport</span><input type="number" min="0" value={transport || ''} onChange={(e) => setTransport(Number(e.target.value) || 0)} /></label>
            <label className="field"><span>Jasa bongkar</span><input type="number" min="0" value={jasaBongkar || ''} onChange={(e) => setJasaBongkar(Number(e.target.value) || 0)} /></label>
            <label className="field"><span>Upah sopir</span><input type="number" min="0" value={upahSopir || ''} onChange={(e) => setUpahSopir(Number(e.target.value) || 0)} /></label>
            <label className="field"><span>Jenis Adjustment</span>
              <select value={plaseType} onChange={(e) => setPlaseType(e.target.value as any)}>
                <option value="EXTRA">Penambahan (Total x %)</option>
                <option value="DISCOUNT">Potongan (Total x %)</option>
              </select>
            </label>
            <label className="field"><span>Adjustment %</span><input type="number" min="0" max="100" value={plasePercent || ''} onChange={(e) => setPlasePercent(Number(e.target.value) || 0)} /></label>
            <label className="field"><span>Sisa PO sebelumnya</span>
              <select value={priorDebtRef} onChange={(e) => {
                const row = duePurchases.find((p) => p.id === e.target.value);
                setPriorDebtRef(e.target.value);
                setPriorDebt(row?.remaining || 0);
              }}>
                <option value="">— tidak ada / isi manual —</option>
                {duePurchases.filter((p) => p.id !== editId).map((p) => <option key={p.id} value={p.id}>{p.number} · sisa {money(p.remaining || 0)}</option>)}
              </select>
            </label>
            <label className="field"><span>Nominal sisa PO</span><input type="number" min="0" value={priorDebt || ''} onChange={(e) => setPriorDebt(Number(e.target.value) || 0)} /></label>
            <label className="field full"><span>Keterangan</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" /></label>
          </TxSection>
        </form>
      </TxDrawer>
    </>
  );
}

export function PenjualanPanel({ products = [], sizes = [], customers = [], sales = [], apiFetch, onNotify, onRefresh, canDelete = false, allowedSpecies = [] }: {
  products: Product[]; sizes?: Array<{ id: string; label: string }>; customers: Partner[]; sales: Transaction[];
  onSale?: (e: FormEvent<HTMLFormElement>) => void;
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void; onRefresh: () => void;
  canDelete?: boolean;
  allowedSpecies?: string[];
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const [editId, setEditId] = useState('');
  const [tanggal, setTanggal] = useState(todayISO());
  const [partner, setPartner] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [partnerAddress, setPartnerAddress] = useState('');
  const [lines, setLines] = useState<LineState[]>([{ ...emptyLine(), quantity: 1 }]);
  const [fees, setFees] = useState<Array<{ label: string; amount: number }>>([]);
  const [status, setStatus] = useState<'PAID' | 'DUE' | 'DP'>('PAID');
  const [dp, setDp] = useState(0);
  const [plasePercent, setPlasePercent] = useState(0);
  const [plaseType, setPlaseType] = useState<'EXTRA' | 'DISCOUNT'>('DISCOUNT');
  const [account, setAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'DUE' | 'DP'>('all');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payId, setPayId] = useState<string | null>(null);
  const [saleGaps, setSaleGaps] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ saleGaps: string[] }>('/erp/document-gaps')
      .then((r) => setSaleGaps(r.saleGaps || []))
      .catch(() => setSaleGaps([]));
  }, [apiFetch, sales.length]);

  const ringkas = useMemo(() => {
    let qty = 0; let kotor = 0; let potongan = 0;
    for (const l of lines) {
      if (!l.productId || !(l.quantity > 0)) continue;
      const c = calcLine(l);
      qty += c.stockQty; kotor += c.subtotal; potongan += c.discount;
    }
    const feeTotal = fees.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const plaseVal = Math.round(kotor * plasePercent / 100);
    const plase = plaseType === 'EXTRA' ? plaseVal : -plaseVal;
    const tagihan = Math.max(0, kotor - potongan + plase) + feeTotal;
    let diterima = 0; let sisa = 0;
    if (status === 'PAID') { diterima = tagihan; sisa = 0; }
    else if (status === 'DP') { diterima = Math.min(dp, tagihan); sisa = Math.max(0, tagihan - diterima); }
    else { diterima = 0; sisa = tagihan; }
    return { qty, potongan, feeTotal, tagihan, diterima, sisa, plase, plaseVal, plasePercent, plaseType, items: lines.filter((l) => lineHasProduct(l) && l.quantity > 0).length };
  }, [lines, fees, status, dp, plasePercent, plaseType]);

  const reset = () => {
    setEditId(''); setTanggal(todayISO()); setPartner(''); setPartnerPhone(''); setPartnerAddress('');
    setLines([{ ...emptyLine(), quantity: 1 }]); setFees([]); setStatus('PAID'); setDp(0); setAccount('CASH'); setNotes('');
  };

  const loadEdit = (row: Transaction) => {
    setEditId(row.id); setTanggal(row.date.slice(0, 10)); setPartner(row.partner);
    setPartnerPhone(String(row.meta?.partnerPhone || '')); setPartnerAddress(String(row.meta?.partnerAddress || ''));
    setNotes(row.notes || ''); setAccount(row.account === 'BANK' ? 'BANK' : 'CASH');
    setPlasePercent(Number(row.meta?.plasePercent) || 0);
    setPlaseType(row.meta?.plaseType === 'EXTRA' ? 'EXTRA' : 'DISCOUNT');
    const paid = row.paidAmount || 0;
    if (row.status === 'PAID') setStatus('PAID');
    else if (paid > 0) { setStatus('DP'); setDp(paid); }
    else setStatus('DUE');
    setFees((row.fees || []).map((f) => ({ label: f.label, amount: f.amount })));
    setLines(row.items.length ? row.items.map(itemToLine) : [{ ...emptyLine(), quantity: 1 }]);
  };

  const openCreate = () => { reset(); setDrawerOpen(true); };
  const openEdit = (row: Transaction) => { loadEdit(row); setDrawerOpen(true); };
  const openDup = (row: Transaction) => { loadEdit(row); setEditId(''); setDrawerOpen(true); };
  const closeDrawer = () => { reset(); setDrawerOpen(false); };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const items = lines.filter((l) => lineHasProduct(l) && l.quantity > 0).map(mapLinePayload);
    if (!partner || !items.length) { onNotify('Pelanggan dan minimal satu item wajib.'); return; }
    setBusy(true);
    try {
      const payload = {
        type: 'SALE' as const,
        partner, partnerPhone, partnerAddress, date: tanggal, notes, account,
        status, paidAmount: status === 'DP' ? dp : undefined, nominalDP: status === 'DP' ? dp : undefined,
        plasePercent, plaseType,
        fees: fees.filter((f) => f.label && f.amount > 0).map((f) => ({ kind: 'ONGKIR', label: f.label, amount: f.amount })),
        items, ...(editId ? { id: editId } : {}),
      };
      const data = await apiFetch<Transaction>(editId ? '/erp/transactions' : '/erp/transactions', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onNotify(`${data.number} berhasil ${editId ? 'diperbarui' : 'disimpan'}. Cetak lewat ikon PDF di daftar bila perlu.`);
      reset();
      setDrawerOpen(false);
      onRefresh();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal simpan penjualan'); }
    finally { setBusy(false); }
  };

  const today = todayISO();
  const ym = monthKey();
  const summary = useMemo(() => {
    const monthTotal = sales.filter((p) => p.date.slice(0, 7) === ym).reduce((s, p) => s + p.total, 0);
    return [
      { label: 'Jumlah transaksi', value: String(sales.length), tone: 'navy' as const },
      { label: 'Total bulan ini', value: money(monthTotal), tone: 'teal' as const },
      { label: 'Belum lunas', value: String(sales.filter((p) => p.status === 'DUE' && (p.remaining || 0) > 0).length), tone: 'red' as const },
      { label: 'Lunas', value: String(sales.filter((p) => p.status === 'PAID').length), tone: 'green' as const },
      { label: 'DP', value: String(sales.filter((p) => (p.paidAmount || 0) > 0 && p.status !== 'PAID').length), tone: 'purple' as const },
      { label: 'Hari ini', value: String(sales.filter((p) => p.date.slice(0, 10) === today).length), tone: 'navy' as const },
    ];
  }, [sales, ym, today]);

  const filtered = useMemo(() => sales.filter((r) => {
    if (q.trim()) {
      const hay = `${r.number} ${r.partner} ${r.status}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    if (statusFilter !== 'all' && txStatusKey(r) !== statusFilter) return false;
    if (partnerFilter.trim() && !r.partner.toLowerCase().includes(partnerFilter.trim().toLowerCase())) return false;
    const d = r.date.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }), [sales, q, statusFilter, partnerFilter, dateFrom, dateTo]);

  const pager = useClientPager(filtered, 10);

  const exportHeaders = ['Dokumen', 'Partner', 'Tanggal', 'Status', 'Total', 'Sisa'];
  const exportRows = () => filtered.map((r) => [
    r.number, r.partner, new Date(r.date).toLocaleDateString('id-ID'), txStatusLabel(r), String(r.total), String(r.remaining || 0),
  ]);

  const ringkasMini = (
    <div className="txm-ringkas-mini">
      <div><span>Subtotal</span><b>{money(ringkas.tagihan - ringkas.plase - ringkas.feeTotal + ringkas.potongan)}</b></div>
      {ringkas.plasePercent > 0 && (
        <div style={{ color: ringkas.plaseType === 'DISCOUNT' ? '#DC2626' : '#059669' }}>
          <span>Adj ({ringkas.plaseType === 'EXTRA' ? '+' : '-'}{ringkas.plasePercent}%)</span>
          <b>{ringkas.plaseType === 'EXTRA' ? '+' : '-'}{money(ringkas.plaseVal)}</b>
        </div>
      )}
      {ringkas.feeTotal > 0 && <div><span>Biaya kirim</span><b>+{money(ringkas.feeTotal)}</b></div>}
      <div><span>Tagihan</span><b>{money(ringkas.tagihan)}</b></div>
      <div><span>Diterima</span><b>{money(ringkas.diterima)}</b></div>
      <div><span>Sisa</span><b className={ringkas.sisa > 0 ? 'is-loss' : 'is-ok'}>{money(ringkas.sisa)}</b></div>
    </div>
  );


  return (
    <>
      <TxModulePage
        title="Penjualan"
        breadcrumb="Transaksi"
        hint={saleGaps.length
          ? `Celah nomor: ${saleGaps.slice(0, 8).join(', ')}${saleGaps.length > 8 ? '…' : ''} — cek apakah transaksi dibatalkan atau belum tercatat.`
          : 'Kelola invoice, status piutang, dan cetak Invoice. Tambah atau edit lewat drawer.'}
        onRefresh={onRefresh}
        onAdd={openCreate}
        addLabel="+ Tambah Penjualan"
        summary={summary}
        toolbar={(
          <>
            <input type="search" placeholder="Cari no / pelanggan…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Semua status</option>
              <option value="PAID">Lunas</option>
              <option value="DUE">Belum lunas</option>
              <option value="DP">DP</option>
            </select>
            <input type="search" placeholder="Filter pelanggan" value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Dari tanggal" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Sampai tanggal" />
            <button type="button" className="btn-secondary btn-sm" onClick={() => downloadCsv('penjualan.csv', exportHeaders, exportRows())}>Export CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => printHtmlTable('Daftar Penjualan', exportHeaders, exportRows())}>Print list</button>
          </>
        )}
      >
        <div className="txm-table-scroll">
          {!filtered.length ? (
            <p className="txm-empty">Belum ada data.</p>
          ) : (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Partner</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Sisa</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="txm-doc"><b>{r.number}</b></td>
                      <td>{r.partner}</td>
                      <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                      <td>
                        <span className={`badge ${r.status === 'PAID' ? 'badge-lunas' : 'badge-due'}`}>{txStatusLabel(r)}</span>
                      </td>
                      <td>{money(r.total)}</td>
                      <td>{(r.remaining || 0) > 0 ? money(r.remaining || 0) : '—'}</td>
                      <td>
                        <div className="txm-actions">
                          <TxIconBtn icon="print" label="PDF / Share" onClick={async () => {
                            try {
                              const doc = await apiFetch<{ html: string; title: string }>(`/erp/documents/invoice?transactionId=${r.id}`);
                              openPrintDocument(doc.title, doc.html);
                              onNotify(`PDF ${r.number} siap.`);
                            } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal cetak'); }
                          }} />
                          <TxIconBtn icon="edit" label="Edit" onClick={() => openEdit(r)} />
                          <TxIconBtn icon="copy" label="Duplikat" onClick={() => openDup(r)} />
                          {(r.remaining || 0) > 0 ? (
                            <TxIconBtn icon="pay" label="Terima" pay onClick={() => setPayId(payId === r.id ? null : r.id)} />
                          ) : null}
                          {canDelete ? (
                            <TxIconBtn icon="trash" label="Hapus" danger onClick={async () => {
                              if (!window.confirm(`Hapus ${r.number}? Stok & kas terkait dibatalkan. Hanya Owner/Admin.`)) return;
                              try {
                                await apiFetch('/erp/transactions/delete', { method: 'POST', body: JSON.stringify({ id: r.id }) });
                                onNotify(`${r.number} dihapus.`);
                                onRefresh();
                              } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal hapus'); }
                            }} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {payId === r.id ? (
                      <tr className="txm-pay-row">
                        <td colSpan={7}>
                          <form className="form" style={{ margin: 0 }} onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            try {
                              await apiFetch('/erp/transactions/pay', {
                                method: 'POST',
                                body: JSON.stringify({ id: r.id, amount: Number(f.get('amount')), account: f.get('account') === 'BANK' ? 'BANK' : 'CASH' }),
                              });
                              onNotify(`Pembayaran ${r.number} dicatat.`);
                              setPayId(null);
                              onRefresh();
                            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal bayar'); }
                          }}>
                            <input name="amount" type="number" min="1" defaultValue={r.remaining} required />
                            <select name="account"><option value="CASH">Kas</option><option value="BANK">Bank</option></select>
                            <button type="submit">Simpan pembayaran</button>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title={editId ? 'Edit Penjualan' : 'Tambah Penjualan'}
        hint="Isi dokumen, item, dan pengiriman — lalu Simpan."
        onClose={closeDrawer}
        summary={ringkasMini}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={closeDrawer}>Batal</button>
            <button type="button" className="txm-btn-save" disabled={busy} onClick={() => void submit()}>{busy ? 'Menyimpan…' : (editId ? 'Simpan Perubahan' : 'Simpan')}</button>
          </>
        )}
      >
        <form id="penjualan-form" className="form form-2" noValidate onSubmit={(e) => void submit(e)}>
          {editId ? <p className="hint" style={{ color: '#B45309', gridColumn: '1 / -1' }}>Mode edit — stok & kas disesuaikan saat simpan.</p> : null}
          <TxSection title="Dokumen">
            <label className="field"><span>Tanggal</span><input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required /></label>
            <label className="field"><span>Pelanggan</span><input list="customers-pj" value={partner} onChange={(e) => setPartner(e.target.value)} required placeholder="Nama pelanggan" /></label>
            <datalist id="customers-pj">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <label className="field"><span>No. HP</span><input value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} placeholder="Opsional" /></label>
            <label className="field"><span>Alamat</span><input value={partnerAddress} onChange={(e) => setPartnerAddress(e.target.value)} placeholder="Opsional" /></label>
          </TxSection>

          <TxSection title="Item">
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              <ItemRows lines={lines} setLines={setLines} products={products} sizes={sizes} allowedSpecies={allowedSpecies} />
              <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
                Stok belum dikaitkan ke penjualan — pilih ukuran manual. Koreksi stok lewat menu Stok / opname.
              </p>
            </div>
          </TxSection>

          <TxSection title="Pengiriman & bayar">
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Biaya pengiriman</h3>
              {fees.map((f, i) => (
                <div key={i} className="form" style={{ marginBottom: 8 }}>
                  <select value={f.label} onChange={(e) => setFees(fees.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}>
                    <option value="">Jenis biaya</option>
                    {ONGIR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input type="number" min="0" placeholder="Nominal" value={f.amount || ''} onChange={(e) => setFees(fees.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} />
                  <button type="button" className="btn-secondary" onClick={() => setFees(fees.filter((_, j) => j !== i))}>Hapus</button>
                </div>
              ))}
              <button type="button" className="btn-secondary" disabled={fees.length >= MAX_FEES} onClick={() => setFees([...fees, { label: 'Sewa Mobil', amount: 0 }])}>+ Tambah biaya pengiriman</button>
            </div>
            <label className="field"><span>Status pembayaran</span>
              <select value={status} onChange={(e) => {
                const next = e.target.value as typeof status;
                setStatus(next);
                if (next !== 'DP') setDp(0);
              }}>
                <option value="PAID">Lunas</option>
                <option value="DP">DP (bayar sebagian)</option>
                <option value="DUE">Piutang</option>
              </select>
            </label>
            {status === 'DP' && (
              <label className="field"><span>Nominal DP</span><input type="number" min="0" value={dp || ''} onChange={(e) => setDp(Number(e.target.value) || 0)} required /></label>
            )}
            <label className="field"><span>Jenis Adjustment</span>
              <select value={plaseType} onChange={(e) => setPlaseType(e.target.value as any)}>
                <option value="DISCOUNT">Potongan (Total x %)</option>
                <option value="EXTRA">Penambahan (Total x %)</option>
              </select>
            </label>
            <label className="field"><span>Adjustment %</span><input type="number" min="0" max="100" value={plasePercent || ''} onChange={(e) => setPlasePercent(Number(e.target.value) || 0)} /></label>
            <label className="field"><span>Via terima</span><select value={account} onChange={(e) => setAccount(e.target.value as 'CASH' | 'BANK')}><option value="CASH">Kas</option><option value="BANK">Bank</option></select></label>
            <label className="field full"><span>Keterangan</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" /></label>
          </TxSection>
        </form>
      </TxDrawer>
    </>
  );
}

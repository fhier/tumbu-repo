'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Ti } from './icons';
import { openPrintDocument } from './print';
import { RingkasCard } from './ui-ringkas';
export { PembelianPanel, PenjualanPanel } from './tx-forms';
export { PengeluaranPanel, SuratJalanPanel, KATEGORI_PENGELUARAN_BUDIDAYA } from './out-sj-forms';
export { BeritaAcaraPanel } from './ba-forms';

type Transaction = {
  id: string; number: string; date: string; type: 'SALE' | 'PURCHASE'; partner: string; total: number;
  paidAmount?: number; remaining?: number; status: 'PAID' | 'DUE';
  items: Array<{ productId: string; productName?: string; sizeLabel?: string; quantity: number; price: number }>;
};
type CashEntry = { id: string; number?: string; date: string; category: string; description: string; amount: number; direction: 'IN' | 'OUT'; account?: string };
type BeritaAcara = { id: string; number: string; date: string; supplier: string; status: string; notes?: string; lines: Array<{ sizeLabel: string; quantity: number; price: number }> };

const money = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

/** Form cepat rugi dibawa — parity MAT Keuangan / Tutup Buku. */
function RugiSebelumnyaForm({
  apiFetch, onNotify, onSaved, current, periode,
}: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onSaved: () => void;
  current: number;
  periode: string;
}) {
  const [nominal, setNominal] = useState(current > 0 ? current : 0);
  const [ket, setKet] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (current > 0) setNominal(current);
  }, [current]);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border, #E2E8F0)' }}>
      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Rugi dibawa bulan sebelumnya</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Mengurangi laba bersih periode berjalan. Saat ini: {money(current)}
        {periode ? ` · dari ${periode}` : ''}.
      </p>
      <div className="form form-2">
        <label className="field"><span>Nominal rugi</span>
          <input type="number" min={0} value={nominal || ''} onChange={(e) => setNominal(Number(e.target.value) || 0)} placeholder="Contoh: 35028545" />
        </label>
        <label className="field"><span>Keterangan</span>
          <input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Opsional" />
        </label>
      </div>
      <div className="tb-actions" style={{ marginTop: 10 }}>
        <button type="button" disabled={busy} onClick={async () => {
          if (!(nominal > 0)) { onNotify('Isi nominal rugi terlebih dahulu.'); return; }
          setBusy(true);
          try {
            const res = await apiFetch<{ pesan?: string }>('/erp/closings/rugi', {
              method: 'POST',
              body: JSON.stringify({ auto: false, nominal, keterangan: ket || undefined }),
            });
            onNotify(res.pesan || 'Rugi dibawa disimpan.');
            onSaved();
          } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal menyimpan'); }
          finally { setBusy(false); }
        }}>{busy ? 'Menyimpan…' : 'Simpan rugi dibawa'}</button>
        <button type="button" className="btn-secondary" disabled={busy || !(current > 0)} onClick={async () => {
          if (!window.confirm('Hapus rugi dibawa?')) return;
          setBusy(true);
          try {
            await apiFetch('/erp/closings/rugi/clear', { method: 'POST', body: '{}' });
            setNominal(0);
            onNotify('Rugi dibawa dikosongkan.');
            onSaved();
          } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
          finally { setBusy(false); }
        }}>Hapus</button>
      </div>
    </div>
  );
}

export function TransactionTable({ rows, label, apiFetch, onNotify, onRefresh, onEdit }: {
  rows: Transaction[];
  label?: string;
  apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify?: (m: string) => void;
  onRefresh?: () => void;
  onEdit?: (row: Transaction) => void;
}) {
  if (!rows.length) return <p>Belum ada {label ? label.toLowerCase() : 'transaksi'} tercatat.</p>;
  return (
    <div className="table wide">
      <div className="tr head"><span>Dokumen</span><span>Tipe</span><span>Total</span><span>Aksi</span></div>
      {rows.map((r) => (
        <div className="tr" key={r.id}>
          <span><b>{r.number}</b><small>{r.partner}</small></span>
          <span>
            {r.type === 'SALE' ? 'Penjualan' : 'Pembelian'}
            <small><span className={`badge ${r.status === 'PAID' ? 'badge-lunas' : 'badge-due'}`}>{r.status === 'PAID' ? 'Lunas' : 'Belum lunas'}</span></small>
          </span>
          <span>{money(r.total)}{typeof r.remaining === 'number' && r.remaining > 0 ? <small>sisa {money(r.remaining)}</small> : null}</span>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {apiFetch && (
              <>
                <button type="button" onClick={async () => {
                  try {
                    const path = r.type === 'SALE' ? '/erp/documents/invoice' : '/erp/documents/nota-pembelian';
                    const doc = await apiFetch<{ html: string; title: string }>(`${path}?transactionId=${r.id}`);
                    openPrintDocument(doc.title, doc.html);
                    onNotify?.(`PDF ${r.number} siap — Preview / Download / Share.`);
                  } catch (err) { onNotify?.(err instanceof Error ? err.message : 'Gagal cetak'); }
                }}>📄 PDF</button>
                <button type="button" style={{ background: '#00D084', color: '#0A1F3D', fontWeight: 'bold' }} onClick={async () => {
                  try {
                    const path = r.type === 'SALE' ? '/erp/documents/invoice' : '/erp/documents/nota-pembelian';
                    const doc = await apiFetch<{ html: string; title: string }>(`${path}?transactionId=${r.id}`);
                    openPrintDocument(`Struk Thermal ${r.number}`, doc.html);
                    onNotify?.(`Struk Thermal ${r.number} siap dicetak.`);
                  } catch (err) { onNotify?.(err instanceof Error ? err.message : 'Gagal cetak thermal'); }
                }}>📟 Thermal</button>
              </>
            )}
            {onEdit && <button type="button" className="btn-secondary" onClick={() => onEdit(r)}>Edit</button>}
            {apiFetch && onRefresh && (
              <button type="button" className="btn-secondary" onClick={async () => {
                if (!window.confirm(`Hapus ${r.number}? Stok & kas terkait akan dibatalkan.`)) return;
                try {
                  await apiFetch('/erp/transactions/delete', { method: 'POST', body: JSON.stringify({ id: r.id }) });
                  onNotify?.(`${r.number} dihapus.`);
                  onRefresh();
                } catch (err) { onNotify?.(err instanceof Error ? err.message : 'Gagal hapus'); }
              }}>Hapus</button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LaporanPanel({ apiFetch, onNotify }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void }) {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [jenis, setJenis] = useState('SEMUA');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ from, to, jenis });
      setData(await apiFetch(`/erp/reports?${q}`));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal memuat laporan');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const expensesTotal = useMemo(() => {
    if (!data) return 0;
    return (Array.isArray(data.expenses) ? data.expenses as Array<{ amount: number }> : []).reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [data]);
  const laba = data ? Number(data.salesTotal || 0) - Number(data.purchaseTotal || 0) - expensesTotal : 0;
  const detail = Array.isArray(data?.detail) ? data!.detail as Array<Record<string, unknown>> : [];

  const cetak = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ from, to, jenis });
      const doc = await apiFetch<{ html: string; title: string }>(`/erp/documents/laporan?${q}`);
      openPrintDocument(doc.title, doc.html);
      onNotify('PDF Laporan siap — Preview / Download / Share.');
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal cetak laporan'); }
    finally { setBusy(false); }
  };

  return (
    <div className="tx-layout">
      <section className="panel">
        <h2>Laporan Periode <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>(PDF / Share)</span></h2>
        <p className="hint">Filter periode &amp; jenis, lihat ringkasan live, lalu cetak PDF resmi seperti Berita Acara.</p>
        <form className="form" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Dari tanggal</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sampai tanggal</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Jenis</span>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)}>
              <option value="SEMUA">Semua</option>
              <option value="PJ">Penjualan</option>
              <option value="PO">Pembelian</option>
              <option value="OUT">Pengeluaran</option>
              <option value="KAS">Kas</option>
              <option value="BANK">Bank</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button disabled={busy}>{busy ? 'Memuat…' : 'Tampilkan'}</button>
            <button type="button" className="btn-secondary" disabled={busy || !data} onClick={() => void cetak()}>PDF / Share</button>
          </div>
        </form>
        {!!detail.length && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Detail {jenis === 'SEMUA' ? 'gabungan' : jenis}</h3>
            <div className="table">
              {detail.map((r, idx) => (
                <div className="tr" key={String(r.number || r.description || idx)}>
                  <span>{String(r.number || r.description || '—')}<small>{String(r.jenis || r.category || '')}</small></span>
                  <span>{String(r.partner || r.account || '—')}</span>
                  <span>{money(Number(r.total ?? r.amount ?? 0))}</span>
                  <span>{r.status ? (r.status === 'PAID' ? 'Lunas' : 'Belum lunas') : String(r.direction || '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <RingkasCard
        title="Ringkasan laporan"
        badge={<span className={`badge ${laba >= 0 ? 'badge-lunas' : 'badge-due'}`}>{laba >= 0 ? 'Laba' : 'Rugi'}</span>}
        hint="Angka mengikuti filter tanggal & jenis di form kiri."
        rows={[
          { label: 'Penjualan', value: money(Number(data?.salesTotal || 0)) },
          { label: 'Pembelian', value: money(Number(data?.purchaseTotal || 0)) },
          { label: 'Pengeluaran', value: money(expensesTotal), tone: 'loss' },
          { label: 'Laba bersih', value: money(laba), tone: laba >= 0 ? 'profit' : 'loss' },
          { label: 'Net Kas', value: money(Number(data?.cashNet || 0)) },
          { label: 'Net Bank', value: money(Number(data?.bankNet || 0)) },
        ]}
      />
    </div>
  );
}

/** Laba Rugi + Posisi — parity Apps Script KeuanganUI (filter tanggal + rugi ditahan). */
export function KeuanganPanel({ apiFetch, onNotify }: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
}) {
  const now = new Date();
  const [dari, setDari] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [sampai, setSampai] = useState(() => now.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{
    sales: number; purchases: number; grossProfit: number; expenses?: number;
    labaOperasional?: number; rugiDitahan?: number; periodeRugiDitahan?: string;
    labaBersih?: number; netProfit?: number; marginPersen?: number;
    openingCash?: number; openingBank?: number;
    cashOnly?: number; bankBalance?: number; cashBalance?: number; modalBersih?: number;
    posisi?: { saldoKas?: number; saldoBank?: number; saldoTotal?: number; totalPiutang?: number; totalHutang?: number; modalBersih?: number };
    labaRugi?: { keteranganRugiDitahan?: string };
  } | null>(null);

  const load = async (d = dari, s = sampai) => {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      if (d) q.set('dari', d);
      if (s) q.set('sampai', s);
      setData(await apiFetch(`/erp/finance?${q}`));
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal memuat keuangan');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const lrSales = Number(data?.sales || 0);
  const lrBuy = Number(data?.purchases || 0);
  const lrKotor = Number(data?.grossProfit ?? (lrSales - lrBuy));
  const lrOut = Number(data?.expenses || 0);
  const lrOps = Number(data?.labaOperasional ?? (lrKotor - lrOut));
  const lrRugi = Number(data?.rugiDitahan || 0);
  const lrBersih = Number(data?.labaBersih ?? data?.netProfit ?? (lrOps - lrRugi));
  const margin = Number(data?.marginPersen ?? (lrSales > 0 ? (lrBersih / lrSales) * 100 : 0));
  const pos = data?.posisi;
  const saldoTotal = Number(pos?.saldoTotal ?? data?.cashBalance ?? 0);
  const piutang = Number(pos?.totalPiutang ?? 0);
  const hutang = Number(pos?.totalHutang ?? 0);
  const modal = Number(pos?.modalBersih ?? data?.modalBersih ?? 0);

  return (
    <div className="tx-layout">
      <section className="panel">
        <h2>Filter Periode</h2>
        <p className="hint">Laba rugi mengikuti rentang tanggal. Posisi kas/bank/hutang/piutang selalu posisi saat ini (termasuk saldo awal).</p>
        <form className="form" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <label className="field"><span>Dari tanggal</span>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </label>
          <label className="field"><span>Sampai tanggal</span>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? 'Memuat…' : 'Tampilkan'}</button>
        </form>

        <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>Laporan Laba Rugi</h3>
        <div className="finance-grid">
          <div><span>Total Penjualan</span><strong>{money(lrSales)}</strong></div>
          <div><span>Total Pembelian (HPP)</span><strong>{money(lrBuy)}</strong></div>
          <div><span>Laba kotor</span><strong className={lrKotor >= 0 ? 'profit' : 'loss'}>{money(lrKotor)}</strong></div>
          <div><span>Total Pengeluaran</span><strong className="loss">{money(lrOut)}</strong></div>
          <div><span>Laba / rugi operasional</span><strong className={lrOps >= 0 ? 'profit' : 'loss'}>{money(lrOps)}</strong></div>
          {lrRugi > 0 ? (
            <div>
              <span>Rugi dibawa bulan sebelumnya{data?.periodeRugiDitahan ? ` (${data.periodeRugiDitahan})` : ''}</span>
              <strong className="loss">{money(lrRugi)}</strong>
            </div>
          ) : (
            <div>
              <span>Rugi dibawa bulan sebelumnya</span>
              <strong className="hint" style={{ fontWeight: 500 }}>Rp 0 — atur di bawah</strong>
            </div>
          )}
          <div><span>Laba bersih</span><strong className={lrBersih >= 0 ? 'profit' : 'loss'}>{money(lrBersih)}</strong></div>
          <div><span>Margin</span><strong>{margin.toFixed(1)}%</strong></div>
        </div>
        {data?.labaRugi?.keteranganRugiDitahan || data?.periodeRugiDitahan ? (
          <p className="hint" style={{ marginTop: 10 }}>
            {lrRugi > 0
              ? `Rugi ditahan${data?.periodeRugiDitahan ? ` dari ${data.periodeRugiDitahan}` : ''} mengurangi laba bersih periode ini.`
              : 'Tidak ada rugi ditahan yang dibebankan pada rentang ini.'}
          </p>
        ) : null}

        <RugiSebelumnyaForm apiFetch={apiFetch} onNotify={onNotify} onSaved={() => void load()} current={lrRugi} periode={data?.periodeRugiDitahan || ''} />
      </section>

      <RingkasCard
        title="Posisi keuangan (saat ini)"
        badge={<span className={`badge ${modal >= 0 ? 'badge-lunas' : 'badge-due'}`}>{modal >= 0 ? 'Modal +' : 'Modal −'}</span>}
        hint={`Saldo awal kas ${money(Number(data?.openingCash || 0))} · bank ${money(Number(data?.openingBank || 0))}`}
        rows={[
          { label: 'Saldo Kas + Bank', value: money(saldoTotal), tone: saldoTotal >= 0 ? 'profit' : 'loss' },
          { label: 'Saldo Kas', value: money(Number(pos?.saldoKas ?? data?.cashOnly ?? 0)) },
          { label: 'Saldo Bank', value: money(Number(pos?.saldoBank ?? data?.bankBalance ?? 0)) },
          { label: 'Total Piutang', value: money(piutang) },
          { label: 'Total Hutang', value: money(hutang), tone: 'loss' },
          { label: 'Modal bersih', value: money(modal), tone: modal >= 0 ? 'profit' : 'loss' },
        ]}
      />
    </div>
  );
}

export function KwitansiPanel({ transactions, cash, beritaAcara, apiFetch, onNotify }: {
  transactions: Transaction[];
  cash: CashEntry[];
  beritaAcara: BeritaAcara[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
}) {
  const [source, setSource] = useState<'penjualan' | 'pembelian' | 'pelunasan' | 'ba' | 'manual'>('penjualan');
  const [manualPartner, setManualPartner] = useState('');
  const [manualAmount, setManualAmount] = useState(0);
  const [manualNote, setManualNote] = useState('');
  const printTx = async (id: string, src: string) => {
    try {
      const doc = await apiFetch<{ title?: string; html?: string }>(`/erp/documents/kwitansi?source=${src}&transactionId=${encodeURIComponent(id)}`);
      if (doc.html) {
        openPrintDocument(doc.title || 'Kwitansi', doc.html);
        onNotify('PDF Kwitansi siap — Preview / Download / Share.');
      } else onNotify('Dokumen tidak tersedia.');
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal membuat kwitansi.'); }
  };
  const sales = transactions.filter((t) => t.type === 'SALE');
  const purchases = transactions.filter((t) => t.type === 'PURCHASE');
  const pelunasan = cash.filter((c) => ['Pelunasan Piutang', 'Pelunasan Hutang', 'Penjualan', 'Pembelian'].includes(c.category));
  return (
    <div className="tx-layout">
      <section className="panel">
        <h2>Kwitansi <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>(PDF / Share)</span></h2>
        <p className="hint">Pilih sumber dokumen, lalu generate kwitansi resmi — preview / download / share seperti Berita Acara.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {([
            ['penjualan', 'Penjualan'],
            ['pembelian', 'Pembelian'],
            ['pelunasan', 'Pelunasan'],
            ['ba', 'Berita Acara'],
            ['manual', 'Manual'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" className={source === key ? '' : 'btn-secondary'} onClick={() => setSource(key)}>{label}</button>
          ))}
        </div>
        {source === 'penjualan' && (
          <div className="table"><div className="tr head"><span>Dokumen</span><span>Partner</span><span>Aksi</span></div>
            {sales.map((t) => (
              <div className="tr" key={t.id}>
                <span><b>{t.number}</b><small>{t.status}</small></span>
                <span>{t.partner}</span>
                <span><button type="button" onClick={() => void printTx(t.id, 'penjualan')}>PDF / Share</button></span>
              </div>
            ))}
            {!sales.length ? <p className="empty-state">Belum ada penjualan.</p> : null}
          </div>
        )}
        {source === 'pembelian' && (
          <div className="table"><div className="tr head"><span>Dokumen</span><span>Partner</span><span>Aksi</span></div>
            {purchases.map((t) => (
              <div className="tr" key={t.id}>
                <span><b>{t.number}</b><small>{t.status}</small></span>
                <span>{t.partner}</span>
                <span><button type="button" onClick={() => void printTx(t.id, 'pembelian')}>PDF / Share</button></span>
              </div>
            ))}
            {!purchases.length ? <p className="empty-state">Belum ada pembelian.</p> : null}
          </div>
        )}
        {source === 'pelunasan' && (
          <div className="table"><div className="tr head"><span>Keterangan</span><span>Nominal</span><span>Aksi</span></div>
            {pelunasan.map((c) => (
              <div className="tr" key={c.id}>
                <span><b>{c.description}</b><small>{c.category}</small></span>
                <span>{money(c.amount)}</span>
                <span><button type="button" onClick={async () => {
                  try {
                    const doc = await apiFetch<{ title?: string; html?: string }>(`/erp/documents/kwitansi?source=pelunasan&cashId=${encodeURIComponent(c.id)}`);
                    if (doc.html) openPrintDocument(doc.title || 'Kwitansi', doc.html);
                  } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
                }}>PDF / Share</button></span>
              </div>
            ))}
            {!pelunasan.length ? <p className="empty-state">Belum ada pelunasan.</p> : null}
          </div>
        )}
        {source === 'ba' && (
          <div className="table"><div className="tr head"><span>Dokumen</span><span>Partner</span><span>Aksi</span></div>
            {beritaAcara.map((ba) => (
              <div className="tr" key={ba.id}>
                <span><b>{ba.number}</b></span>
                <span>{ba.supplier}</span>
                <span><button type="button" onClick={async () => {
                  try {
                    const doc = await apiFetch<{ title?: string; html?: string }>(`/erp/documents/kwitansi?source=ba&baId=${encodeURIComponent(ba.id)}`);
                    if (doc.html) openPrintDocument(doc.title || 'Kwitansi', doc.html);
                  } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
                }}>PDF / Share</button></span>
              </div>
            ))}
            {!beritaAcara.length ? <p className="empty-state">Belum ada BA.</p> : null}
          </div>
        )}
        {source === 'manual' && (
          <form className="form" onSubmit={async (e) => {
            e.preventDefault();
            try {
              const q = new URLSearchParams({
                source: 'manual',
                amount: String(manualAmount || ''),
                partner: manualPartner,
                note: manualNote,
              });
              const doc = await apiFetch<{ title?: string; html?: string }>(`/erp/documents/kwitansi?${q}`);
              if (doc.html) {
                openPrintDocument(doc.title || 'Kwitansi', doc.html);
                onNotify('PDF Kwitansi manual siap — Preview / Download / Share.');
              }
            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
          }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Diterima dari / dibayar kepada *</span>
              <input value={manualPartner} onChange={(e) => setManualPartner(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nominal *</span>
              <input type="number" min="1" value={manualAmount || ''} onChange={(e) => setManualAmount(Number(e.target.value) || 0)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Keterangan</span>
              <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Opsional" />
            </label>
            <button>Buat Kwitansi · PDF / Share</button>
          </form>
        )}
      </section>
      <RingkasCard
        title="Ringkasan sumber"
        badge={<span className="badge badge-lunas">{source}</span>}
        hint="Pilih sumber di kiri, lalu tekan PDF / Share pada baris yang diinginkan."
        rows={
          source === 'manual'
            ? [
              { label: 'Partner', value: manualPartner || '—' },
              { label: 'Nominal', value: money(manualAmount) },
              { label: 'Keterangan', value: manualNote || '—' },
            ]
            : [
              { label: 'Sumber', value: source },
              { label: 'Jumlah dokumen', value: String(
                source === 'penjualan' ? sales.length
                  : source === 'pembelian' ? purchases.length
                    : source === 'pelunasan' ? pelunasan.length
                      : beritaAcara.length,
              ) },
            ]
        }
      />
    </div>
  );
}

export function CompanySettings({
  apiFetch, onNotify, onRefresh, onNavigate, enabledModules = [],
}: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
  onNavigate?: (page: string) => void;
  /** Modul efektif workspace ∩ paket — sembunyikan tab yang tidak tersedia. */
  enabledModules?: string[];
}) {
  type SettingsData = {
    name: string; phone: string; address: string; timezone: string; locale: string;
    blueprint?: string;
    logoUrl?: string; letterheadUrl?: string; letterheadMode?: 'template' | 'custom';
    bankName?: string; bankAccount?: string;
    openingCash?: number; openingBank?: number;
    tagline?: string; invoiceUraian?: string;
  };
  type LetterheadMode = 'template' | 'custom';
  type TabKey = 'profil' | 'dokumen' | 'preferensi' | 'akses' | 'backup';

  const canUsers = enabledModules.includes('users');
  const canBackup = enabledModules.includes('backup');

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [blueprint, setBlueprint] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [letterheadMode, setLetterheadMode] = useState<LetterheadMode>('template');
  const [baseline, setBaseline] = useState<SettingsData | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [invoiceUraian, setInvoiceUraian] = useState('Benih');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [openingBank, setOpeningBank] = useState(0);
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [locale, setLocale] = useState('id-ID');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>('profil');

  const applySettings = (d: SettingsData) => {
    setBlueprint(d.blueprint || '');
    setLogoUrl(d.logoUrl || '');
    setLetterheadUrl(d.letterheadUrl || '');
    setLetterheadMode(d.letterheadMode === 'custom' ? 'custom' : 'template');
    setName(d.name || '');
    setTagline(d.tagline || '');
    setPhone(d.phone || '');
    setAddress(d.address || '');
    setInvoiceUraian(d.invoiceUraian || 'Benih');
    setBankName(d.bankName || '');
    setBankAccount(d.bankAccount || '');
    setOpeningCash(d.openingCash || 0);
    setOpeningBank(d.openingBank || 0);
    setTimezone(d.timezone || 'Asia/Jakarta');
    setLocale(d.locale || 'id-ID');
  };

  const loadSettings = useCallback(() => {
    setLoadError('');
    setLoaded(false);
    apiFetch<SettingsData>('/erp/settings').then((d) => {
      applySettings(d);
      setBaseline({
        ...d,
        letterheadMode: d.letterheadMode === 'custom' ? 'custom' : 'template',
      });
      setLoaded(true);
    }).catch((e) => {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat pengaturan.');
      setLoaded(true);
    });
  }, [apiFetch]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    if (tab === 'akses' && !canUsers) setTab('profil');
    if (tab === 'backup' && !canBackup) setTab('profil');
  }, [tab, canUsers, canBackup]);

  const readFileAsDataUrl = (file: File, maxBytes: number) => new Promise<string>((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`File terlalu besar (maks ${Math.round(maxBytes / 1024)} KB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onNotify('Nama perusahaan wajib diisi.');
      setTab('profil');
      return;
    }
    setBusy(true);
    try {
      const saved = await apiFetch<SettingsData>('/erp/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name, phone, address, timezone, locale,
          logoUrl, letterheadUrl, letterheadMode,
          bankName, bankAccount,
          openingCash, openingBank,
          tagline, invoiceUraian,
        }),
      });
      applySettings(saved);
      setBaseline({
        ...saved,
        letterheadMode: saved.letterheadMode === 'custom' ? 'custom' : 'template',
      });
      onNotify('Pengaturan berhasil disimpan.');
      onRefresh();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };

  const dirty = useMemo(() => {
    if (!baseline) return false;
    const bMode = baseline.letterheadMode === 'custom' ? 'custom' : 'template';
    return (
      name !== (baseline.name || '')
      || tagline !== (baseline.tagline || '')
      || phone !== (baseline.phone || '')
      || address !== (baseline.address || '')
      || invoiceUraian !== (baseline.invoiceUraian || 'Benih')
      || bankName !== (baseline.bankName || '')
      || bankAccount !== (baseline.bankAccount || '')
      || openingCash !== (baseline.openingCash || 0)
      || openingBank !== (baseline.openingBank || 0)
      || timezone !== (baseline.timezone || 'Asia/Jakarta')
      || locale !== (baseline.locale || 'id-ID')
      || logoUrl !== (baseline.logoUrl || '')
      || letterheadUrl !== (baseline.letterheadUrl || '')
      || letterheadMode !== bMode
    );
  }, [
    baseline, name, tagline, phone, address, invoiceUraian, bankName, bankAccount,
    openingCash, openingBank, timezone, locale, logoUrl, letterheadUrl, letterheadMode,
  ]);

  if (!loaded) return <p className="empty-state">Memuat pengaturan…</p>;
  if (loadError) {
    return (
      <section className="panel">
        <h2>Pengaturan</h2>
        <p className="empty-state danger">{loadError}</p>
        <button type="button" className="btn-secondary" onClick={loadSettings}>Coba lagi</button>
      </section>
    );
  }

  const displayName = name.trim() || 'Usaha Anda';
  const displayTag = tagline.trim() || 'Lengkapi tagline usaha Anda';
  const blueprintLabel = blueprint || 'Distributor Benih';

  const tabs: Array<{ key: TabKey; label: string; icon: string; show: boolean }> = [
    { key: 'profil', label: 'Profil Lapak / Kelompok / Usaha', icon: 'workspace', show: true },
    { key: 'dokumen', label: 'Dokumen & Kop', icon: 'invoice', show: true },
    { key: 'preferensi', label: 'Preferensi', icon: 'pengaturan', show: true },
    { key: 'akses', label: 'Akses & Pengguna', icon: 'pengguna', show: canUsers },
    { key: 'backup', label: 'Backup & Restore', icon: 'sinkron', show: canBackup },
  ];

  return (
    <div className="ws-set">
      <header className="ws-set-intro">
        <div className="ws-set-identity">
          {logoUrl ? (
            <img className="ws-set-identity-logo" src={logoUrl} alt="" />
          ) : (
            <span className="ws-set-identity-fallback" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="ws-set-identity-copy">
            <h2>{displayName}</h2>
            <p>{displayTag}</p>
            <span className="ws-set-bp">{blueprintLabel}</span>
          </div>
        </div>
        <p className="ws-set-lead">
          Pusat identitas usaha Anda — logo, nama, tagline, dan dokumen resmi. Perubahan di sini dipakai di seluruh Workspace dan cetakan.
        </p>
      </header>

      <nav className="ws-set-tabs" aria-label="Bag pengaturan">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'is-active' : ''}
            onClick={() => setTab(t.key)}
          >
            <Ti name={t.icon} size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'akses' && canUsers ? (
        <section className="ws-set-card ws-set-card-link">
          <h3>Akses & Pengguna</h3>
          <p>Undang anggota, atur peran, dan kelola siapa yang dapat masuk ke usaha ini.</p>
          <button type="button" className="txm-btn-primary" onClick={() => onNavigate?.('members')}>
            Buka Anggota & Akses
          </button>
        </section>
      ) : null}

      {tab === 'backup' && canBackup ? (
        <section className="ws-set-card ws-set-card-link">
          <h3>Backup & Restore</h3>
          <p>Unduh arsip data usaha atau pulihkan dari file cadangan.</p>
          <button type="button" className="txm-btn-primary" onClick={() => onNavigate?.('backup')}>
            Buka Backup & Restore
          </button>
        </section>
      ) : null}

      {tab === 'profil' || tab === 'dokumen' || tab === 'preferensi' ? (
        <form className={`ws-set-form${dirty ? ' ws-set-form--dirty' : ''}`} onSubmit={(e) => void save(e)}>
          <div className="ws-set-grid">
            {tab === 'profil' ? (
              <>
                <section className="ws-set-card">
                  <header className="ws-set-card-head">
                    <h3>Identitas Perusahaan</h3>
                    <span>Tampil di Workspace & dokumen</span>
                  </header>
                  <div className="ws-set-card-body">
                    <div className="ws-set-logo-block">
                      <div className="ws-set-logo-preview">
                        {logoUrl ? <img src={logoUrl} alt="Logo usaha" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="ws-set-logo-actions">
                        <label className={`txm-btn-primary btn-sm${busy ? ' is-disabled' : ''}`}>
                          {logoUrl ? 'Ubah Logo' : 'Unggah Logo'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            hidden
                            disabled={busy}
                            onChange={async (ev) => {
                              const file = ev.target.files?.[0];
                              if (!file) return;
                              try {
                                setLogoUrl(await readFileAsDataUrl(file, 400_000));
                                onNotify('Logo siap — tekan Simpan Perubahan.');
                              } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal unggah'); }
                              ev.target.value = '';
                            }}
                          />
                        </label>
                        {logoUrl ? (
                          <button type="button" className="btn-danger-text" disabled={busy} onClick={() => setLogoUrl('')}>
                            Hapus
                          </button>
                        ) : null}
                        <small>PNG, JPG, WebP — maks ~400 KB</small>
                      </div>
                    </div>
                    <label className="field full">
                      <span>Nama Perusahaan</span>
                      <input value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} />
                    </label>
                    <label className="field full">
                      <span>Tagline</span>
                      <input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="Distributor Benih Lele Berkualitas"
                        disabled={busy}
                      />
                    </label>
                    <label className="field full">
                      <span>Alamat</span>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={busy} />
                    </label>
                    <label className="field">
                      <span>Telepon / WhatsApp</span>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
                    </label>
                    <label className="field">
                      <span>Jenis Usaha</span>
                      <input value={blueprintLabel} disabled readOnly />
                    </label>
                  </div>
                </section>

                <section className="ws-set-card">
                  <header className="ws-set-card-head">
                    <h3>Informasi Usaha</h3>
                    <span>Dokumen & bahasa bisnis</span>
                  </header>
                  <div className="ws-set-card-body">
                    <label className="field full">
                      <span>Uraian Invoice</span>
                      <input
                        value={invoiceUraian}
                        onChange={(e) => setInvoiceUraian(e.target.value)}
                        placeholder="Benih Lele"
                        disabled={busy}
                      />
                    </label>
                    <label className="field">
                      <span>Zona Waktu</span>
                      <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={busy}>
                        <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                        <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                        <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Lokal</span>
                      <select value={locale} onChange={(e) => setLocale(e.target.value)} disabled={busy}>
                        <option value="id-ID">Indonesia (IDR)</option>
                        <option value="en-US">English</option>
                      </select>
                    </label>
                    <p className="ws-set-note">Jenis usaha mengikuti Blueprint yang aktif. Ubah melalui Platform bila diperlukan.</p>
                  </div>
                </section>

                <section className="ws-set-card">
                  <header className="ws-set-card-head">
                    <h3>Informasi Rekening</h3>
                    <span>Cetak invoice & laporan</span>
                  </header>
                  <div className="ws-set-card-body">
                    <label className="field">
                      <span>Nama Bank</span>
                      <input value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={busy} />
                    </label>
                    <label className="field">
                      <span>No. Rekening</span>
                      <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} disabled={busy} />
                    </label>
                    <label className="field">
                      <span>Saldo Awal Kas</span>
                      <input
                        type="number"
                        value={openingCash}
                        onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                        disabled={busy}
                      />
                    </label>
                    <label className="field">
                      <span>Saldo Awal Bank</span>
                      <input
                        type="number"
                        value={openingBank}
                        onChange={(e) => setOpeningBank(Number(e.target.value) || 0)}
                        disabled={busy}
                      />
                    </label>
                    <p className="ws-set-note is-ok">Saldo awal digunakan sebagai nilai pembuka pada laporan keuangan.</p>
                  </div>
                </section>
              </>
            ) : null}

            {tab === 'dokumen' ? (
              <section className="ws-set-card ws-set-card-wide">
                <header className="ws-set-card-head">
                  <h3>Kop Dokumen & Surat</h3>
                  <span>Template logo+teks atau banner kop utuh</span>
                </header>
                <div className="ws-set-card-body">
                  <p className="ws-set-kop-lead">
                    Nota, kwitansi, dan laporan memakai kop yang sama. Isi <b>Nama Usaha</b> di tab profil
                    dengan nama resmi yang tampil di kop.
                  </p>

                  <div className="ws-set-kop-mode" role="group" aria-label="Jenis kop surat">
                    <button
                      type="button"
                      className={letterheadMode === 'template' ? 'on' : ''}
                      disabled={busy}
                      onClick={() => setLetterheadMode('template')}
                    >
                      Logo + Teks Template
                    </button>
                    <button
                      type="button"
                      className={letterheadMode === 'custom' ? 'on' : ''}
                      disabled={busy}
                      onClick={() => setLetterheadMode('custom')}
                    >
                      Gambar Kop Utuh (Banner)
                    </button>
                  </div>

                  <div className="ws-set-letter-preview tumbu-kop-preview">
                    {letterheadMode === 'custom' && letterheadUrl ? (
                      <div className="print-header-custom ws-set-kop-banner-wrap">
                        <img
                          className="print-banner-img ws-set-kop-banner"
                          src={letterheadUrl}
                          alt="Pratinjau banner kop"
                        />
                      </div>
                    ) : (
                      <>
                        <table className="tumbu-kop-table" role="presentation">
                          <tbody>
                            <tr>
                              <td className="tumbu-kop-logo-cell">
                                {logoUrl ? (
                                  <img src={logoUrl} alt="" />
                                ) : (
                                  <span className="initial">{displayName.slice(0, 1).toUpperCase()}</span>
                                )}
                              </td>
                              <td className="tumbu-kop-identity-cell">
                                <h1 className="tumbu-kop-name">{displayName}</h1>
                                {tagline.trim() ? <p className="tumbu-kop-tagline">{tagline}</p> : null}
                                <p className="tumbu-kop-contact">
                                  {address.trim() ? <><b>Alamat:</b> {address}</> : <span className="muted">Alamat belum diisi</span>}
                                  {phone.trim() ? <> &nbsp;|&nbsp; <b>Telp:</b> {phone}</> : null}
                                  {(bankName.trim() || bankAccount.trim())
                                    ? <> &nbsp;|&nbsp; <b>Rek:</b> {[bankName, bankAccount].filter(Boolean).join(' · ')}</>
                                    : null}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="tumbu-kop-rules" aria-hidden="true">
                          <div className="tumbu-kop-rule-main" />
                          <div className="tumbu-kop-rule-sub" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="ws-set-toolbar" role="toolbar" aria-label="Aksi kop surat">
                    {letterheadMode === 'template' ? (
                      <label className={`ws-set-tool ws-set-tool-primary${busy ? ' is-disabled' : ''}`}>
                        Unggah Logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          hidden
                          disabled={busy}
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            try {
                              setLogoUrl(await readFileAsDataUrl(file, 400_000));
                              onNotify('Logo siap — tekan Simpan Perubahan.');
                            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal unggah'); }
                            ev.target.value = '';
                          }}
                        />
                      </label>
                    ) : (
                      <label className={`ws-set-tool ws-set-tool-primary${busy ? ' is-disabled' : ''}`}>
                        Unggah Banner Kop
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          disabled={busy}
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            try {
                              setLetterheadUrl(await readFileAsDataUrl(file, 900_000));
                              onNotify('Banner kop siap — tekan Simpan Perubahan.');
                            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal unggah'); }
                            ev.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    {letterheadMode === 'template' ? (
                      <label className={`ws-set-tool ws-set-tool-secondary${busy ? ' is-disabled' : ''}`}>
                        Banner / Cap Usaha
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          disabled={busy}
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            try {
                              setLetterheadUrl(await readFileAsDataUrl(file, 700_000));
                              setLetterheadMode('custom');
                              onNotify('Banner kop siap — mode Gambar Kop Utuh aktif.');
                            } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal unggah'); }
                            ev.target.value = '';
                          }}
                        />
                      </label>
                    ) : null}
                    {(logoUrl || letterheadUrl) ? (
                      <button
                        type="button"
                        className="ws-set-tool ws-set-tool-danger"
                        disabled={busy}
                        onClick={() => {
                          if (letterheadMode === 'custom') setLetterheadUrl('');
                          else setLogoUrl('');
                        }}
                      >
                        Hapus Gambar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ws-set-tool ws-set-tool-secondary"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const doc = await apiFetch<{ html: string; title: string }>(
                            '/erp/documents/kop-preview',
                          );
                          openPrintDocument('Contoh Kop Surat', doc.html);
                        } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal preview kop'); }
                      }}
                    >
                      Cetak / Lihat Contoh Nota
                    </button>
                  </div>
                  <p className="ws-set-kop-hint">
                    {letterheadMode === 'template'
                      ? 'Logo persegi maks. ~400 KB. Banner / cap usaha bisa diunggah lalu dialihkan ke mode Gambar Kop Utuh.'
                      : 'Banner kop full-width sejajar tabel nota (kiri logo = kiri judul, kanan ornamen = kanan kolom SUBTOTAL).'}
                  </p>
                </div>
              </section>
            ) : null}

            {tab === 'preferensi' ? (
              <section className="ws-set-card ws-set-card-wide">
                <header className="ws-set-card-head">
                  <h3>Preferensi Workspace</h3>
                  <span>Zona waktu & bahasa</span>
                </header>
                <div className="ws-set-card-body">
                  <label className="field">
                    <span>Zona Waktu</span>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={busy}>
                      <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                      <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                      <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Lokal</span>
                    <select value={locale} onChange={(e) => setLocale(e.target.value)} disabled={busy}>
                      <option value="id-ID">Indonesia (IDR)</option>
                      <option value="en-US">English</option>
                    </select>
                  </label>
                  <p className="ws-set-note">Preferensi memengaruhi format tanggal, angka, dan dokumen cetak.</p>
                </div>
              </section>
            ) : null}
          </div>

          {dirty ? (
            <footer className="ws-set-foot is-sticky" aria-live="polite">
              <p>Ada perubahan belum disimpan.</p>
              <button type="submit" className="txm-btn-primary" disabled={busy}>
                {busy ? 'Menyimpan…' : 'Simpan Perubahan'}
              </button>
            </footer>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function ClosingPanel({ apiFetch, onNotify }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void }) {
  type ClosingRow = { id: string; periodYm: string; notes?: string | null; closedAt: string; labaBersih?: number; saldoTotal?: number };
  type RugiInfo = { nominal: number; periode?: string; keterangan?: string; saranNominal?: number; saranPeriode?: string };
  type Rekap = {
    labelPeriode?: string; periodYm?: string; totalPembelian?: number; totalPenjualan?: number; totalPengeluaran?: number;
    labaBersih?: number; rugiDitahan?: number; saldoTotal?: number; totalStok?: number;
    jumlahPembelian?: number; jumlahPenjualan?: number; jumlahPengeluaran?: number; alreadyClosed?: boolean;
  };

  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [tab, setTab] = useState<'rekap' | 'tutup' | 'rugi' | 'riwayat'>('rekap');
  const [status, setStatus] = useState<{ periodeTertutupTerakhir: string; periodeBerjalan: string; riwayat: ClosingRow[]; rugiDitahan: RugiInfo } | null>(null);
  const [busy, setBusy] = useState(false);

  // Rekap
  const [rekapMode, setRekapMode] = useState<'bulan' | 'rentang'>('bulan');
  const [rekapPeriode, setRekapPeriode] = useState(defaultYm);
  const [rekapDari, setRekapDari] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [rekapSampai, setRekapSampai] = useState(() => now.toISOString().slice(0, 10));
  const [rekapKet, setRekapKet] = useState('');
  const [rekap, setRekap] = useState<Rekap | null>(null);

  // Tutup
  const [periodYm, setPeriodYm] = useState(defaultYm);
  const [notes, setNotes] = useState('');
  const [pdfKet, setPdfKet] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [ringkasTutup, setRingkasTutup] = useState<Rekap | null>(null);

  // Rugi
  const [rugiManual, setRugiManual] = useState(0);
  const [rugiKet, setRugiKet] = useState('');

  const loadStatus = async () => {
    try {
      const s = await apiFetch<NonNullable<typeof status>>('/erp/closings/status');
      setStatus(s);
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal muat status'); }
  };
  useEffect(() => { void loadStatus(); }, []);

  const rekapQuery = () => {
    const p = new URLSearchParams();
    if (rekapMode === 'bulan') p.set('periode', rekapPeriode);
    else { p.set('dari', rekapDari); p.set('sampai', rekapSampai); }
    return p.toString();
  };

  const previewRekap = async () => {
    setBusy(true);
    try {
      setRekap(await apiFetch<Rekap>(`/erp/closings/rekap?${rekapQuery()}`));
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal ikhtisar'); }
    finally { setBusy(false); }
  };

  const pdfRekap = async () => {
    setBusy(true);
    try {
      const p = new URLSearchParams({ sementara: '1', keterangan: rekapKet });
      if (rekapMode === 'bulan') p.set('periodYm', rekapPeriode);
      else { p.set('dari', rekapDari); p.set('sampai', rekapSampai); }
      const doc = await apiFetch<{ html: string; title: string; fileName?: string; halaman?: number }>(`/erp/documents/tutup-buku?${p}`);
      openPrintDocument(doc.title, doc.html, doc.fileName);
      onNotify(`PDF rekap sementara siap (${doc.halaman || 7} halaman).`);
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal PDF'); }
    finally { setBusy(false); }
  };

  const previewTutup = async () => {
    setBusy(true);
    try {
      setRingkasTutup(await apiFetch<Rekap>(`/erp/closings/preview?periodYm=${periodYm}`));
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal ringkasan'); }
    finally { setBusy(false); }
  };

  const pdfTutup = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ periodYm, keterangan: pdfKet || notes });
      const doc = await apiFetch<{ html: string; title: string; fileName?: string; halaman?: number }>(`/erp/documents/tutup-buku?${q}`);
      openPrintDocument(doc.title, doc.html, doc.fileName);
      onNotify(`PDF tutup buku siap (${doc.halaman || 7} halaman).`);
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal PDF'); }
    finally { setBusy(false); }
  };

  const tutupPeriode = async () => {
    if (!confirmClose) { onNotify('Centang konfirmasi terlebih dahulu.'); return; }
    setBusy(true);
    try {
      const res = await apiFetch<{ pesan?: string }>(`/erp/closings`, {
        method: 'POST',
        body: JSON.stringify({ periodYm, notes: notes || undefined }),
      });
      onNotify(res.pesan || 'Periode ditutup.');
      setConfirmClose(false);
      setRingkasTutup(null);
      await loadStatus();
      setTab('riwayat');
      if (window.confirm('Periode ditutup. Buka PDF Tutup Buku?')) await pdfTutup();
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal tutup buku'); }
    finally { setBusy(false); }
  };

  const bukaKembali = async (ym?: string) => {
    if (!window.confirm(ym ? `Buka kembali periode ${ym}?` : 'Buka kembali periode tutup buku terakhir?')) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ pesan?: string }>('/erp/closings/reopen', {
        method: 'POST',
        body: JSON.stringify(ym ? { periodYm: ym } : { last: true }),
      });
      onNotify(res.pesan || 'Periode dibuka kembali.');
      await loadStatus();
      if (ringkasTutup?.periodYm === (ym || status?.periodeTertutupTerakhir)) setRingkasTutup(null);
    } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal buka kembali'); }
    finally { setBusy(false); }
  };

  const Stats = ({ r }: { r: Rekap }) => (
    <div className="tb-stats">
      <div className="tb-stat"><div className="lbl">Pembelian</div><div className="val">{money(Number(r.totalPembelian || 0))}</div></div>
      <div className="tb-stat"><div className="lbl">Penjualan</div><div className="val">{money(Number(r.totalPenjualan || 0))}</div></div>
      <div className="tb-stat"><div className="lbl">Pengeluaran</div><div className="val">{money(Number(r.totalPengeluaran || 0))}</div></div>
      <div className="tb-stat"><div className="lbl">Saldo</div><div className="val">{money(Number(r.saldoTotal || 0))}</div></div>
      {Number(r.rugiDitahan || 0) > 0 ? (
        <div className="tb-stat warn"><div className="lbl">Rugi dibawa</div><div className="val">{money(Number(r.rugiDitahan || 0))}</div></div>
      ) : null}
      <div className="tb-stat total"><div className="lbl">Laba / rugi bersih</div><div className="val">{money(Number(r.labaBersih || 0))}</div></div>
    </div>
  );

  const rugi = status?.rugiDitahan;

  return (
    <div className="tb-page">
      <div className="tb-status">
        <div className="tb-status-meta">
          Tertutup: <b>{status?.periodeTertutupTerakhir || '—'}</b><br />
          Berjalan: <b className="live">{status?.periodeBerjalan || defaultYm}</b>
        </div>
        <button type="button" className="btn-secondary btn-sm" disabled={busy || !(status?.riwayat?.length)} onClick={() => void bukaKembali()}>
          Buka kembali
        </button>
      </div>

      <div className="tb-tabs" role="tablist">
        {([
          ['rekap', 'Rekap'],
          ['tutup', 'Tutup Buku'],
          ['rugi', 'Rugi Ditahan'],
          ['riwayat', 'Riwayat'],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" className={`tb-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'rekap' && (
        <section className="panel">
          <h2>Rekap sementara</h2>
          <p className="hint">Preview tanpa menutup periode — sama pola Apps Script.</p>
          <div className="form">
            <label className="field"><span>Mode</span>
              <select value={rekapMode} onChange={(e) => setRekapMode(e.target.value as 'bulan' | 'rentang')}>
                <option value="bulan">Per bulan</option>
                <option value="rentang">Rentang tanggal</option>
              </select>
            </label>
            {rekapMode === 'bulan' ? (
              <label className="field"><span>Bulan</span>
                <input type="month" value={rekapPeriode} onChange={(e) => setRekapPeriode(e.target.value)} />
              </label>
            ) : (
              <>
                <label className="field"><span>Dari</span>
                  <input type="date" value={rekapDari} onChange={(e) => setRekapDari(e.target.value)} />
                </label>
                <label className="field"><span>Sampai</span>
                  <input type="date" value={rekapSampai} onChange={(e) => setRekapSampai(e.target.value)} />
                </label>
              </>
            )}
            <label className="field full"><span>Catatan PDF (opsional)</span>
              <input value={rekapKet} onChange={(e) => setRekapKet(e.target.value)} placeholder="Opsional" />
            </label>
          </div>
          <div className="tb-actions">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void previewRekap()}>Ikhtisar</button>
            <button type="button" disabled={busy} onClick={() => void pdfRekap()}>PDF / Share</button>
          </div>
          {rekap ? (
            <div style={{ marginTop: 12 }}>
              <Stats r={rekap} />
              <p className="tb-hint">
                Stok <b>{Number(rekap.totalStok || 0).toLocaleString('id-ID')}</b> ekor ·
                Trx PB <b>{rekap.jumlahPembelian || 0}</b> · PJ <b>{rekap.jumlahPenjualan || 0}</b> · Out <b>{rekap.jumlahPengeluaran || 0}</b>
              </p>
            </div>
          ) : null}
        </section>
      )}

      {tab === 'tutup' && (
        <section className="panel">
          <h2>Tutup buku resmi</h2>
          <p className="hint">Setelah tutup, transaksi pada/sebelum periode ini dikunci.</p>
          <div className="form">
            <label className="field"><span>Periode penutupan *</span>
              <input type="month" value={periodYm} onChange={(e) => { setPeriodYm(e.target.value); setRingkasTutup(null); setConfirmClose(false); }} />
            </label>
            <label className="field"><span>Catatan (opsional)</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
            </label>
            <label className="field full"><span>Keterangan PDF (opsional)</span>
              <input value={pdfKet} onChange={(e) => setPdfKet(e.target.value)} placeholder="Opsional" />
            </label>
          </div>
          <div className="tb-actions">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void previewTutup()}>Ringkasan</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void pdfTutup()}>PDF / Share</button>
          </div>
          {ringkasTutup ? (
            <div style={{ marginTop: 12 }}>
              <Stats r={ringkasTutup} />
              <p className="tb-hint">Stok akhir: <b>{Number(ringkasTutup.totalStok || 0).toLocaleString('id-ID')} ekor</b>. Setelah tutup, transaksi dikunci.</p>
              <label className="tb-check">
                <input type="checkbox" checked={confirmClose} onChange={(e) => setConfirmClose(e.target.checked)} />
                <span>Saya paham periode {periodYm} akan dikunci.</span>
              </label>
              <button type="button" className="btn-block" disabled={busy || !!ringkasTutup.alreadyClosed || !confirmClose} onClick={() => void tutupPeriode()}>
                {ringkasTutup.alreadyClosed ? 'Sudah ditutup' : (busy ? 'Memproses…' : 'Tutup periode ini')}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {tab === 'rugi' && (
        <section className="panel">
          <h2>Rugi dibawa ke bulan berjalan</h2>
          <div className="tb-stats">
            <div className="tb-stat warn"><div className="lbl">Rugi ditahan</div><div className="val">{money(Number(rugi?.nominal || 0))}</div></div>
            <div className="tb-stat"><div className="lbl">Dari periode</div><div className="val">{rugi?.periode || '—'}</div></div>
          </div>
          {rugi?.keterangan ? <p className="tb-hint">{rugi.keterangan}</p> : null}
          {Number(rugi?.saranNominal || 0) > 0 ? (
            <p className="tb-hint" style={{ color: '#B45309' }}>
              Saran tutup buku {rugi?.saranPeriode}: minus {money(Number(rugi?.saranNominal || 0))}
            </p>
          ) : null}
          <div className="form" style={{ marginTop: 12 }}>
            <label className="field"><span>Nominal manual</span>
              <input type="number" min={0} value={rugiManual || ''} onChange={(e) => setRugiManual(Number(e.target.value) || 0)} placeholder="Opsional" />
            </label>
            <label className="field"><span>Keterangan</span>
              <input value={rugiKet} onChange={(e) => setRugiKet(e.target.value)} placeholder="Opsional" />
            </label>
          </div>
          <div className="tb-actions">
            <button type="button" disabled={busy} onClick={async () => {
              if (!window.confirm('Ambil minus dari tutup buku terakhir?')) return;
              setBusy(true);
              try {
                const res = await apiFetch<{ pesan?: string; rugiDitahan: RugiInfo }>('/erp/closings/rugi', {
                  method: 'POST', body: JSON.stringify({ auto: true, keterangan: rugiKet || undefined }),
                });
                onNotify(res.pesan || 'Rugi dibawa.');
                await loadStatus();
              } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
              finally { setBusy(false); }
            }}>Ambil otomatis</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {
              if (!(rugiManual > 0)) { onNotify('Isi nominal manual, atau pakai ambil otomatis.'); return; }
              setBusy(true);
              try {
                const res = await apiFetch<{ pesan?: string }>('/erp/closings/rugi', {
                  method: 'POST', body: JSON.stringify({ auto: false, nominal: rugiManual, keterangan: rugiKet || undefined }),
                });
                onNotify(res.pesan || 'Rugi disimpan.');
                setRugiManual(0);
                await loadStatus();
              } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
              finally { setBusy(false); }
            }}>Simpan</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {
              if (!window.confirm('Hapus rugi ditahan?')) return;
              setBusy(true);
              try {
                const res = await apiFetch<{ pesan?: string }>('/erp/closings/rugi/clear', { method: 'POST', body: '{}' });
                onNotify(res.pesan || 'Dikosongkan.');
                await loadStatus();
              } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
              finally { setBusy(false); }
            }}>Hapus</button>
          </div>
          <p className="tb-hint">Untuk minus laba/rugi saja. Hutang PO tetap di menu Hutang.</p>
        </section>
      )}

      {tab === 'riwayat' && (
        <section className="panel">
          <h2>Riwayat penutupan</h2>
          {!(status?.riwayat?.length) ? <p className="empty-state">Belum ada riwayat</p> : (
            <div className="table wide">
              <div className="tr head"><span>Periode</span><span>Laba/Rugi</span><span>Saldo</span><span>Tutup</span><span>Aksi</span></div>
              {status!.riwayat.map((r) => (
                <div className="tr" key={r.id}>
                  <span><b>{r.periodYm}</b>{r.notes ? <small>{r.notes}</small> : null}</span>
                  <span className={Number(r.labaBersih || 0) >= 0 ? 'profit' : 'loss'}>{money(Number(r.labaBersih || 0))}</span>
                  <span>{money(Number(r.saldoTotal || 0))}</span>
                  <span>{new Date(r.closedAt).toLocaleDateString('id-ID')}</span>
                  <span className="tb-actions" style={{ margin: 0 }}>
                    <button type="button" className="btn-sm" disabled={busy} onClick={async () => {
                      setBusy(true);
                      try {
                        const doc = await apiFetch<{ html: string; title: string; fileName?: string }>(`/erp/documents/tutup-buku?periodYm=${r.periodYm}`);
                        openPrintDocument(doc.title, doc.html, doc.fileName);
                      } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal'); }
                      finally { setBusy(false); }
                    }}>PDF</button>
                    <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void bukaKembali(r.periodYm)}>Buka</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

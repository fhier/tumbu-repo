'use client';

import { useEffect, useMemo, useState } from 'react';
import { clearAquaDraft, loadAquaDraft, saveAquaDraft } from './aqua-form-draft';
import { openPrintDocument, printSuratJalanPdf } from './print';
import {
  TxModulePage, TxDrawer, TxSection, TxIconBtn, TxPager, useClientPager, moneyFmt, downloadCsv, printHtmlTable,
} from './tx-shell';

type Partner = { id: string; name: string; phone?: string; type: 'CUSTOMER' | 'SUPPLIER' };
type TxItem = { productId: string; productName?: string; sizeLabel?: string; quantity: number; price: number };
type Transaction = {
  id: string; number: string; date: string; type: 'SALE' | 'PURCHASE'; partner: string; total: number;
  items: TxItem[];
};
type CashEntry = {
  id: string; number?: string; date: string; category: string; description: string;
  amount: number; direction: 'IN' | 'OUT'; account?: string;
};
type SuratJalan = {
  id: string; number: string; date: string; customer: string; saleRef?: string;
  destination?: string; vehicle?: string; driver?: string; status: string; notes?: string;
  lines: Array<{ productName: string; sizeLabel?: string; quantity: number; bagCount?: number; binNote?: string }>;
};
type Size = { id: string; label: string; sortOrder: number };

const money = moneyFmt;

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7);
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const KATEGORI_PENGELUARAN = [
  'Operasional', 'Transportasi', 'Gaji / Upah', 'Listrik & Air',
  'Perawatan Kolam', 'Pakan Tambahan', 'Obat & Vitamin',
  'Perlengkapan', 'Lain-lain',
];

/** Kategori pengeluaran khusus workspace Pembudidaya */
export const KATEGORI_PENGELUARAN_BUDIDAYA = [
  'Beli Pakan',
  'Beli Benih',
  'Obat & Vitamin',
  'Listrik/BBM',
  'Operasional/Gaji',
  'Lain-lain',
];

type OutRow = { category: string; amount: number; account: 'CASH' | 'BANK'; description: string };
const emptyOutRow = (categories: string[]): OutRow => ({
  category: categories[0] || 'Operasional',
  amount: 0,
  account: 'CASH',
  description: '',
});

type RekapPreview = {
  labelPeriode: string; jumlah: number; total: number; totalKas: number; totalBank: number;
  rincianKategori: Array<{ kategori: string; nominal: number }>;
};



export function PengeluaranPanel({ cash, apiFetch, onNotify, onRefresh, categories }: {
  cash: CashEntry[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
  categories?: string[];
}) {
  const kategoriList = categories?.length ? categories : KATEGORI_PENGELUARAN;
  const [date, setDate] = useState(todayISO);
  const [rows, setRows] = useState<OutRow[]>([emptyOutRow(kategoriList)]);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rekapMode, setRekapMode] = useState<'bulan' | 'rentang'>('bulan');
  const [rekapPeriode, setRekapPeriode] = useState(monthISO);
  const [rekapDari, setRekapDari] = useState(todayISO);
  const [rekapSampai, setRekapSampai] = useState(todayISO);
  const [rekapKet, setRekapKet] = useState('');
  const [preview, setPreview] = useState<RekapPreview | null>(null);
  const [showRekap, setShowRekap] = useState(false);

  const ringkas = useMemo(() => {
    const aktif = rows.filter((r) => (Number(r.amount) || 0) > 0);
    const total = aktif.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const viaKas = aktif.filter((r) => r.account === 'CASH').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const viaBank = aktif.filter((r) => r.account === 'BANK').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { baris: aktif.length || rows.length, total, viaKas, viaBank };
  }, [rows]);

  const history = useMemo(() => {
    const list = cash.filter((c) => c.direction === 'OUT' && !['Pembelian', 'Pelunasan Hutang'].includes(c.category));
    if (!q.trim()) return list;
    const hay = q.trim().toLowerCase();
    return list.filter((c) => `${c.number || ''} ${c.category} ${c.description}`.toLowerCase().includes(hay));
  }, [cash, q]);

  const today = todayISO();
  const ym = monthKey();
  const outList = useMemo(
    () => cash.filter((c) => c.direction === 'OUT' && !['Pembelian', 'Pelunasan Hutang'].includes(c.category)),
    [cash],
  );
  const summary = useMemo(() => {
    const monthRows = outList.filter((r) => r.date.slice(0, 7) === ym);
    const monthTotal = monthRows.reduce((s, r) => s + r.amount, 0);
    const viaKas = outList.filter((r) => r.account !== 'BANK').reduce((s, r) => s + r.amount, 0);
    const viaBank = outList.filter((r) => r.account === 'BANK').reduce((s, r) => s + r.amount, 0);
    return [
      { label: 'Jumlah', value: String(outList.length), tone: 'navy' as const },
      { label: 'Total bulan ini', value: money(monthTotal), tone: 'teal' as const },
      { label: 'Via kas', value: money(viaKas), tone: 'purple' as const },
      { label: 'Via bank', value: money(viaBank), tone: 'green' as const },
      { label: 'Hari ini', value: String(outList.filter((r) => r.date.slice(0, 10) === today).length), tone: 'navy' as const },
    ];
  }, [outList, ym, today]);

  const pager = useClientPager(history, 10);
  useEffect(() => {
    if (drawerOpen) {
      const draft = loadAquaDraft<{ rows: OutRow[]; date: string }>('PENGELUARAN', 'distributor');
      if (draft && draft.rows?.length) {
        setRows(draft.rows);
        if (draft.date) setDate(draft.date);
        onNotify('Draft pengeluaran dipulihkan dari sesi sebelumnya.');
      }
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen && rows.some(r => (r.amount || 0) > 0 || r.description.trim())) {
      saveAquaDraft('PENGELUARAN', 'distributor', { rows, date });
    }
  }, [drawerOpen, rows, date]);


  const resetForm = () => {
    setEditId(null);
    setDate(todayISO());
    setRows([emptyOutRow(kategoriList)]);
  };

  const loadEdit = (row: CashEntry) => {
    setEditId(row.id);
    setDate(row.date.slice(0, 10));
    setRows([{
      category: kategoriList.includes(row.category) ? row.category : (kategoriList[kategoriList.length - 1] || 'Lain-lain'),
      amount: row.amount,
      account: row.account === 'BANK' ? 'BANK' : 'CASH',
      description: row.description === row.category ? '' : row.description,
    }]);
  };

  const openCreate = () => { resetForm(); setDrawerOpen(true); };
  const openEdit = (row: CashEntry) => { loadEdit(row); setDrawerOpen(true); };
  const closeDrawer = () => { resetForm(); setDrawerOpen(false); };

  const save = async () => {
    const items = rows
      .map((r) => ({
        category: r.category || 'Lain-lain',
        amount: Math.round(Number(r.amount) || 0),
        account: r.account,
        description: (r.description || r.category || 'Lain-lain').trim(),
        direction: 'OUT' as const,
        date,
      }))
      .filter((r) => r.amount > 0);
    if (!items.length) { onNotify('Minimal satu baris dengan nominal.'); return; }
    setBusy(true);
    try {
      if (editId) {
        await apiFetch('/erp/cash', {
          method: 'PATCH',
          body: JSON.stringify({ id: editId, ...items[0] }),
        });
        onNotify('Pengeluaran diperbarui.');
      } else {
        await apiFetch('/erp/cash/batch', {
          method: 'POST',
          body: JSON.stringify({ date, entries: items }),
        });
        onNotify(`${items.length} pengeluaran dicatat.`);
      }
      closeDrawer();
      onRefresh();
      if (!editId) onNotify('Cetak rekap lewat tombol Rekap PDF di toolbar bila perlu.');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal simpan pengeluaran.');
    } finally {
      setBusy(false);
    }
  };

  const rekapQuery = () => {
    const p = new URLSearchParams({ mode: rekapMode, keterangan: rekapKet });
    if (rekapMode === 'rentang') {
      p.set('dari', rekapDari);
      p.set('sampai', rekapSampai);
    } else {
      p.set('periode', rekapPeriode);
    }
    return p.toString();
  };

  const showPreview = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<RekapPreview>(`/erp/cash/rekap?${rekapQuery()}`);
      setPreview(res);
      setShowRekap(true);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal muat ikhtisar.');
    } finally {
      setBusy(false);
    }
  };

  const printRekap = async () => {
    setBusy(true);
    try {
      const doc = await apiFetch<{ html: string; title: string }>(`/erp/documents/rekap-pengeluaran?${rekapQuery()}`);
      openPrintDocument(doc.title, doc.html);
      onNotify('PDF Rekap siap — Preview / Download / Share.');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal cetak rekap.');
    } finally {
      setBusy(false);
    }
  };

  const exportHeaders = ['No', 'Tanggal', 'Kategori', 'Keterangan', 'Via', 'Nominal'];
  const exportRows = () => history.map((r) => [
    r.number || '', new Date(r.date).toLocaleDateString('id-ID'), r.category, r.description,
    r.account === 'BANK' ? 'Bank' : 'Kas', String(r.amount),
  ]);

  const ringkasMini = (
    <div className="txm-ringkas-mini">
      <div><span>Baris</span><b>{ringkas.baris}</b></div>
      <div><span>Kas</span><b>{money(ringkas.viaKas)}</b></div>
      <div><span>Total</span><b className={ringkas.total > 0 ? 'is-loss' : 'is-ok'}>{money(ringkas.total)}</b></div>
    </div>
  );


  return (
    <>
      <TxModulePage
        title="Pengeluaran"
        breadcrumb="Transaksi"
        hint="Catat biaya operasional. Edit/hapus dari daftar; cetak rekap periode lewat toolbar."
        onRefresh={onRefresh}
        onAdd={openCreate}
        addLabel="+ Tambah Pengeluaran"
        summary={summary}
        toolbar={(
          <>
            <input type="search" placeholder="Cari no / kategori…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowRekap((v) => !v)}>
              {showRekap ? 'Tutup Rekap' : 'Rekap PDF'}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => downloadCsv('pengeluaran.csv', exportHeaders, exportRows())}>Export CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => printHtmlTable('Daftar Pengeluaran', exportHeaders, exportRows())}>Print list</button>
          </>
        )}
      >
        {showRekap ? (
          <div className="txm-rekap-panel" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <p className="hint" style={{ marginTop: 0 }}>Pratinjau ringkasan per periode, lalu unduh PDF rekap resmi.</p>
            <div className="form" style={{ marginBottom: 0 }}>
              <label className="field"><span>Jenis Periode</span>
                <select value={rekapMode} onChange={(e) => setRekapMode(e.target.value as 'bulan' | 'rentang')}>
                  <option value="bulan">Per Bulan</option>
                  <option value="rentang">Rentang Tanggal</option>
                </select>
              </label>
              {rekapMode === 'bulan' ? (
                <label className="field"><span>Bulan Laporan</span>
                  <input type="month" value={rekapPeriode} onChange={(e) => setRekapPeriode(e.target.value)} />
                </label>
              ) : (
                <>
                  <label className="field"><span>Tanggal Awal</span>
                    <input type="date" value={rekapDari} onChange={(e) => setRekapDari(e.target.value)} />
                  </label>
                  <label className="field"><span>Tanggal Akhir</span>
                    <input type="date" value={rekapSampai} onChange={(e) => setRekapSampai(e.target.value)} />
                  </label>
                </>
              )}
              <label className="field full"><span>Informasi Tambahan pada PDF (opsional)</span>
                <input value={rekapKet} onChange={(e) => setRekapKet(e.target.value)} placeholder="Contoh: Rekap operasional Juli 2026" />
              </label>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => void showPreview()}>Tampilkan Ikhtisar</button>
            </div>
            {preview ? (
              <div style={{ marginTop: 14 }}>
                <table className="txm-table">
                  <thead>
                    <tr><th>Rincian</th><th>Nominal</th></tr>
                  </thead>
                  <tbody>
                    <tr><td><b>Total Pengeluaran</b></td><td><b>{money(preview.total)}</b></td></tr>
                    <tr><td>Via Kas (Cash)</td><td>{money(preview.totalKas)}</td></tr>
                    <tr><td>Via Bank (Transfer)</td><td>{money(preview.totalBank)}</td></tr>
                    {preview.rincianKategori.map((it) => (
                      <tr key={it.kategori}><td>· {it.kategori}</td><td>{money(it.nominal)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint" style={{ marginTop: 10 }}>
                  Periode: <b>{preview.labelPeriode}</b> · Jumlah transaksi: <b>{preview.jumlah}</b>
                </p>
                <button type="button" disabled={busy} onClick={() => void printRekap()}>PDF / Share Rekap</button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="txm-table-scroll">
          {!history.length ? (
            <p className="txm-empty">Belum ada pengeluaran.</p>
          ) : (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Nominal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
                  <tr key={r.id}>
                    <td className="txm-doc">
                      <b>{r.number || '—'}</b>
                      <small>{r.account === 'BANK' ? 'Bank' : 'Kas'}</small>
                    </td>
                    <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                    <td>
                      {r.category}
                      {r.description && r.description !== r.category ? <small>{r.description}</small> : null}
                    </td>
                    <td className="loss">{money(r.amount)}</td>
                    <td>
                      <div className="txm-actions">
                        <TxIconBtn icon="edit" label="Edit" onClick={() => openEdit(r)} />
                        <TxIconBtn icon="trash" label="Hapus" danger onClick={async () => {
                          if (!window.confirm(`Hapus pengeluaran ${r.number || r.category}?`)) return;
                          try {
                            await apiFetch('/erp/cash/delete', { method: 'POST', body: JSON.stringify({ id: r.id }) });
                            onNotify('Pengeluaran dihapus.');
                            if (editId === r.id) closeDrawer();
                            onRefresh();
                          } catch (e) { onNotify(e instanceof Error ? e.message : 'Gagal hapus'); }
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title={editId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
        hint="Isi tanggal dan item — lalu Simpan."
        onClose={closeDrawer}
        summary={ringkasMini}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={closeDrawer}>Batal</button>
            <button type="button" className="txm-btn-save" disabled={busy} onClick={() => void save()}>
              {busy ? 'Menyimpan…' : (editId ? 'Simpan Perubahan' : 'Simpan')}
            </button>
          </>
        )}
      >
        <div className="form form-2">
          {editId ? (
            <p className="hint" style={{ color: '#B45309', gridColumn: '1 / -1' }}>Mengedit satu catatan — Kas/Bank disesuaikan otomatis.</p>
          ) : (
            <p className="hint" style={{ gridColumn: '1 / -1' }}>Catat biaya operasional per baris. Ringkasan mengikuti form.</p>
          )}

          <TxSection title="Dokumen">
            <label className="field"><span>Tanggal *</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </TxSection>

          <TxSection title="Item">
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              {rows.map((row, i) => (
                <div key={i} className="tx-item-card">
                  <div className="tx-item-head">
                    <strong>Baris #{i + 1}</strong>
                    {!editId && rows.length > 1 ? (
                      <button type="button" className="btn-secondary" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>Hapus</button>
                    ) : null}
                  </div>
                  <div className="form expense-item-grid" style={{ margin: 0 }}>
                    <label className="field"><span>Kategori *</span>
                      <select value={row.category} onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, category: e.target.value } : r))}>
                        {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>Nominal *</span>
                      <input type="number" min={1} value={row.amount || ''} placeholder="0"
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, amount: Number(e.target.value) || 0 } : r))} />
                    </label>
                    <label className="field"><span>Via bayar</span>
                      <select value={row.account} onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, account: e.target.value as 'CASH' | 'BANK' } : r))}>
                        <option value="CASH">Kas</option>
                        <option value="BANK">Bank</option>
                      </select>
                    </label>
                    <label className="field"><span>Keterangan</span>
                      <input value={row.description} placeholder="opsional"
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))} />
                    </label>
                  </div>
                </div>
              ))}
              {!editId ? (
                <button
                  type="button"
                  className="btn-add-row"
                  onClick={() => setRows((prev) => [...prev, emptyOutRow(kategoriList)])}
                >
                  <span className="btn-add-row-icon" aria-hidden="true">+</span>
                  Tambah Baris Pengeluaran
                </button>
              ) : null}
            </div>
          </TxSection>

        </div>
      </TxDrawer>
    </>
  );
}

type SjLine = { sizeLabel: string; productName: string; quantity: number; bagCount: number; binNote: string };
const emptySjLine = (): SjLine => ({ sizeLabel: '', productName: '', quantity: 0, bagCount: 0, binNote: '' });
const MAX_SJ = 30;

export function SuratJalanPanel({ sales, sizes, suratJalan, apiFetch, onNotify, onRefresh }: {
  sales: Transaction[];
  customers?: Partner[];
  sizes: Size[];
  suratJalan: SuratJalan[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
}) {
  const [saleId, setSaleId] = useState('');
  const [date, setDate] = useState(todayISO);
  const [destination, setDestination] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<SjLine[]>([emptySjLine()]);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');

  const sale = sales.find((s) => s.id === saleId);
  const sizeOptions = useMemo(() => {
    if (!sale) return sizes.map((s) => s.label);
    const fromSale = sale.items.map((it) => it.sizeLabel || it.productName || '').filter(Boolean);
    return Array.from(new Set([...fromSale, ...sizes.map((s) => s.label)]));
  }, [sale, sizes]);

  const ringkas = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const totalKantong = lines.reduce((s, l) => s + (Number(l.bagCount) || 0), 0);
    const bak = new Set(lines.map((l) => l.binNote.trim()).filter(Boolean));
    const jumlahBak = bak.size > 0 ? bak.size : lines.filter((l) => (l.quantity || 0) > 0 || l.sizeLabel).length || lines.length;
    return { baris: lines.length, totalQty, totalKantong, jumlahBak, pelanggan: sale?.partner || '—' };
  }, [lines, sale]);

  const history = useMemo(() => {
    if (!q.trim()) return suratJalan;
    const hay = q.trim().toLowerCase();
    return suratJalan.filter((r) => `${r.number} ${r.customer} ${r.saleRef || ''} ${r.vehicle || ''}`.toLowerCase().includes(hay));
  }, [suratJalan, q]);

  const today = todayISO();
  const ym = monthKey();
  const summary = useMemo(() => {
    const totalQty = suratJalan.reduce(
      (s, r) => s + r.lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0),
      0,
    );
    return [
      { label: 'Jumlah SJ', value: String(suratJalan.length), tone: 'navy' as const },
      { label: 'Bulan ini', value: String(suratJalan.filter((r) => r.date.slice(0, 7) === ym).length), tone: 'teal' as const },
      { label: 'Hari ini', value: String(suratJalan.filter((r) => r.date.slice(0, 10) === today).length), tone: 'purple' as const },
      { label: 'Total qty', value: totalQty.toLocaleString('id-ID'), tone: 'green' as const },
    ];
  }, [suratJalan, ym, today]);

  const pager = useClientPager(history, 10);
  useEffect(() => {
    if (drawerOpen) {
      const draft = loadAquaDraft<{
        saleId: string; date: string; destination: string; vehicle: string;
        driver: string; notes: string; lines: SjLine[];
      }>('SURAT_JALAN', 'distributor');
      if (draft) {
        if (draft.saleId) setSaleId(draft.saleId);
        if (draft.date) setDate(draft.date);
        if (draft.destination) setDestination(draft.destination);
        if (draft.vehicle) setVehicle(draft.vehicle);
        if (draft.driver) setDriver(draft.driver);
        if (draft.notes) setNotes(draft.notes);
        if (draft.lines?.length) setLines(draft.lines);
        onNotify('Draft Surat Jalan dipulihkan dari sesi sebelumnya.');
      }
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen && (saleId || destination || vehicle || driver || notes || lines.some(l => (l.quantity || 0) > 0))) {
      saveAquaDraft('SURAT_JALAN', 'distributor', {
        saleId, date, destination, vehicle, driver, notes, lines
      });
    }
  }, [drawerOpen, saleId, date, destination, vehicle, driver, notes, lines]);


  const resetForm = () => {
    setSaleId('');
    setDestination('');
    setVehicle('');
    setDriver('');
    setNotes('');
    setDate(todayISO());
    setLines([emptySjLine()]);
  };

  const openCreate = () => { resetForm(); setDrawerOpen(true); };
  const closeDrawer = () => { resetForm(); setDrawerOpen(false); };

  const onPickSale = (id: string) => {
    setSaleId(id);
    const s = sales.find((x) => x.id === id);
    if (!s) return;
    const mapped = s.items.map((it) => ({
      sizeLabel: it.sizeLabel || '',
      productName: it.productName || it.sizeLabel || '',
      quantity: it.quantity,
      bagCount: 0,
      binNote: '',
    })).filter((l) => l.productName || l.sizeLabel);
    setLines(mapped.length ? mapped : [emptySjLine()]);
  };

  const save = async () => {
    if (!sale) { onNotify('Pilih transaksi penjualan terlebih dahulu.'); return; }
    if (!vehicle.trim() || !driver.trim()) { onNotify('Kendaraan dan nama sopir wajib.'); return; }
    const payloadLines = lines
      .map((l) => ({
        productName: l.productName || l.sizeLabel,
        sizeLabel: l.sizeLabel || undefined,
        quantity: Number(l.quantity) || 0,
        bagCount: Number(l.bagCount) || 0,
        binNote: l.binNote.trim() || undefined,
      }))
      .filter((l) => l.productName && l.quantity > 0);
    if (!payloadLines.length) { onNotify('Minimal satu baris dengan qty.'); return; }
    setBusy(true);
    try {
      const data = await apiFetch<SuratJalan>('/erp/surat-jalan', {
        method: 'POST',
        body: JSON.stringify({
          saleRef: sale.number,
          customer: sale.partner,
          date,
          destination: destination.trim() || undefined,
          vehicle: vehicle.trim(),
          driver: driver.trim(),
          notes: notes.trim() || undefined,
          lines: payloadLines,
        }),
      });
      onNotify(`${data.number} berhasil dicatat (${payloadLines.length} baris).`);
      const savedId = data.id;
      closeDrawer();
      onRefresh();
      onNotify(`${data.number} tersimpan. Cetak lewat ikon PDF di daftar bila perlu.`);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Surat Jalan gagal.');
    } finally {
      setBusy(false);
    }
  };

  const exportHeaders = ['No SJ', 'Tanggal', 'Pelanggan', 'Sale', 'Qty', 'Kendaraan'];
  const exportRows = () => history.map((r) => [
    r.number,
    new Date(r.date).toLocaleDateString('id-ID'),
    r.customer,
    r.saleRef || '',
    String(r.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)),
    r.vehicle || '',
  ]);

  const ringkasMini = (
    <div className="txm-ringkas-mini">
      <div><span>Pelanggan</span><b>{ringkas.pelanggan || '—'}</b></div>
      <div><span>Baris</span><b>{ringkas.baris}</b></div>
      <div><span>Qty</span><b>{ringkas.totalQty.toLocaleString('id-ID')}</b></div>
    </div>
  );


  return (
    <>
      <TxModulePage
        title="Surat Jalan"
        breadcrumb="Transaksi"
        hint="Dokumen pengiriman dari penjualan. Setelah tersimpan, cetak PDF / Share sama seperti Berita Acara."
        onRefresh={onRefresh}
        onAdd={openCreate}
        addLabel="+ Buat Surat Jalan"
        summary={summary}
        toolbar={(
          <>
            <input type="search" placeholder="Cari no SJ / pelanggan / kendaraan…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="btn-secondary btn-sm" onClick={() => downloadCsv('surat-jalan.csv', exportHeaders, exportRows())}>Export CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => printHtmlTable('Daftar Surat Jalan', exportHeaders, exportRows())}>Print list</button>
          </>
        )}
      >
        <div className="txm-table-scroll">
          {!history.length ? (
            <p className="txm-empty">{q ? 'Tidak ada SJ yang cocok' : 'Belum ada Surat Jalan.'}</p>
          ) : (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>No SJ</th>
                  <th>Tanggal</th>
                  <th>Pelanggan</th>
                  <th>Total qty</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => {
                  const qty = r.lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
                  return (
                    <tr key={r.id}>
                      <td className="txm-doc">
                        <b>{r.number}</b>
                        <small>{r.saleRef || '—'}{r.vehicle ? ` · ${r.vehicle}` : ''}</small>
                      </td>
                      <td>{new Date(r.date).toLocaleDateString('id-ID')}</td>
                      <td>
                        {r.customer}
                        {r.driver ? <small>{r.driver}</small> : null}
                      </td>
                      <td>{qty.toLocaleString('id-ID')}</td>
                      <td>
                        <div className="txm-actions">
                          <TxIconBtn icon="print" label="PDF / Share" onClick={async () => {
                            try {
                              const doc = await apiFetch<{ html: string; title: string }>(`/erp/documents/surat-jalan?id=${r.id}`);
                              openPrintDocument(doc.title, doc.html);
                              onNotify(`PDF ${r.number} siap — Preview / Download / Share.`);
                            } catch (e) {
                              printSuratJalanPdf({
                                sjNumber: r.number,
                                date: r.date,
                                workspaceName: 'TUMBU OS DISTRIBUTION',
                                customerName: r.customer,
                                destination: r.destination,
                                vehicle: r.vehicle,
                                driver: r.driver,
                                items: (r.lines || []).length > 0
                                  ? r.lines.map(l => ({
                                      itemName: `${l.productName} ${l.sizeLabel ? `(${l.sizeLabel})` : ''}`,
                                      quantity: l.quantity,
                                      unit: 'ekor',
                                      notes: l.binNote || (l.bagCount ? `${l.bagCount} kantong` : undefined)
                                    }))
                                  : [{ itemName: 'Pengiriman Benih / Operasional', quantity: 1, unit: 'paket' }],
                                notes: r.notes
                              });
                              onNotify(`PDF ${r.number} siap — Preview / Download.`);
                            }
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title="Buat Surat Jalan"
        hint="Pilih penjualan, isi pengiriman — lalu Simpan."
        onClose={closeDrawer}
        summary={ringkasMini}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={closeDrawer}>Batal</button>
            <button type="button" className="txm-btn-save" disabled={busy} onClick={() => void save()}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        )}
      >
        <div className="form form-2">
          <p className="hint" style={{ gridColumn: '1 / -1' }}>Dokumen pengiriman dari transaksi penjualan. Ringkasan mengikuti form.</p>

          <TxSection title="Dokumen">
            <label className="field full"><span>Transaksi penjualan *</span>
              <select value={saleId} onChange={(e) => onPickSale(e.target.value)} required>
                <option value="">— pilih transaksi —</option>
                {sales.slice(0, 60).map((t) => (
                  <option key={t.id} value={t.id}>{t.number} — {t.partner} ({new Date(t.date).toLocaleDateString('id-ID')})</option>
                ))}
              </select>
              {sale ? <small style={{ color: 'var(--muted)' }}>Tanggal: {new Date(sale.date).toLocaleDateString('id-ID')} · Pelanggan: {sale.partner}</small> : null}
            </label>
            <label className="field"><span>Tanggal berangkat *</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field"><span>Tujuan</span>
              <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Alamat pelanggan / lokasi tujuan" />
            </label>
            <label className="field"><span>Kendaraan *</span>
              <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="mis. Pick Up" required />
            </label>
            <label className="field"><span>Nama sopir *</span>
              <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Nama sopir" required />
            </label>
          </TxSection>

          <TxSection title="Item">
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              {lines.map((line, i) => (
                <div key={i} className="tx-item-card">
                  <div className="tx-item-head">
                    <strong>Baris #{i + 1}</strong>
                    {lines.length > 1 ? (
                      <button type="button" className="btn-secondary" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>Hapus</button>
                    ) : null}
                  </div>
                  <div className="form" style={{ margin: 0 }}>
                    <label className="field"><span>Varian / SKU *</span>
                      <select
                        value={line.sizeLabel || line.productName}
                        onChange={(e) => {
                          const v = e.target.value;
                          const fromSale = sale?.items.find((it) => (it.sizeLabel || it.productName) === v);
                          setLines((prev) => prev.map((r, idx) => idx === i ? {
                            ...r,
                            sizeLabel: v,
                            productName: fromSale?.productName || v,
                            quantity: r.quantity || fromSale?.quantity || 0,
                          } : r));
                        }}
                        required
                      >
                        <option value="">{sale ? '— pilih —' : '— pilih penjualan dulu —'}</option>
                        {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>Lokasi / keterangan</span>
                      <input value={line.binNote} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, binNote: e.target.value } : r))} placeholder="mis. Bak depan" list="list-bak-sj" />
                    </label>
                    <label className="field"><span>Qty *</span>
                      <input type="number" min={1} value={line.quantity || ''} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) || 0 } : r))} required />
                    </label>
                    <label className="field"><span>Jumlah kantong *</span>
                      <input type="number" min={0} value={line.bagCount || ''} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, bagCount: Number(e.target.value) || 0 } : r))} required />
                    </label>
                  </div>
                </div>
              ))}
              <datalist id="list-bak-sj">
                <option value="Bak depan" />
                <option value="Bak tengah" />
                <option value="Bak belakang" />
              </datalist>
              <button type="button" className="btn-add-row" disabled={lines.length >= MAX_SJ}
                onClick={() => {
                  if (lines.length >= MAX_SJ) { onNotify(`Maksimal ${MAX_SJ} baris.`); return; }
                  setLines((prev) => [...prev, emptySjLine()]);
                }}>
                <span className="btn-add-row-icon" aria-hidden="true">+</span>
                Tambah Baris
              </button>
            </div>
          </TxSection>

          <TxSection title="Catatan">
            <label className="field full"><span>Keterangan</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Opsional" />
            </label>
          </TxSection>

        </div>
      </TxDrawer>
    </>
  );
}

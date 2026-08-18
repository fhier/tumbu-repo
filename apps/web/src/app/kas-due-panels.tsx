'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RingkasCard } from './ui-ringkas';
import { openPrintDocument } from './print';

type CashEntry = {
  id: string; number?: string; date: string; category: string; description: string;
  amount: number; direction: 'IN' | 'OUT'; account?: string;
};

type DueRow = {
  id?: string; number: string; partner: string; total: number;
  paidAmount?: number; remaining?: number; date: string; status?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const LOCKED = new Set(['Pembelian', 'Pelunasan Hutang', 'Penjualan', 'Pelunasan Piutang']);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function CashAccountBody({
  mode, cash, opening = 0, saldoApi, apiFetch, onNotify, onRefresh, canDelete = false,
}: {
  mode: 'kas' | 'bank';
  cash: CashEntry[];
  opening?: number;
  saldoApi?: number;
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
  canDelete?: boolean;
}) {
  const isBank = mode === 'bank';
  const account = isBank ? 'BANK' : 'CASH';
  const label = isBank ? 'Bank' : 'Kas';

  const rows = useMemo(() => {
    if (isBank) return cash.filter((c) => c.account === 'BANK');
    return cash.filter((c) => (c.account || 'CASH') !== 'BANK');
  }, [cash, isBank]);

  const masuk = rows.filter((c) => c.direction === 'IN').reduce((s, c) => s + c.amount, 0);
  const keluar = rows.filter((c) => c.direction === 'OUT').reduce((s, c) => s + c.amount, 0);
  const saldo = typeof saldoApi === 'number' ? saldoApi : opening + masuk - keluar;

  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [category, setCategory] = useState(isBank ? 'Bank' : 'Operasional');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    setEditId(null);
    setDate(todayISO());
    setDirection('IN');
    setCategory(isBank ? 'Bank' : 'Operasional');
    setAmount('');
    setDescription('');
    setQ('');
  }, [isBank]);

  const resetForm = () => {
    setEditId(null);
    setDate(todayISO());
    setDirection('IN');
    setCategory(isBank ? 'Bank' : 'Operasional');
    setAmount('');
    setDescription('');
  };

  const loadEdit = (r: CashEntry) => {
    if (LOCKED.has(r.category)) {
      onNotify(`Entri otomatis (${r.category}) tidak bisa diedit di sini.`);
      return;
    }
    setEditId(r.id);
    setDate(r.date.slice(0, 10));
    setDirection(r.direction);
    setCategory(r.category);
    setAmount(String(r.amount));
    setDescription(r.description);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nominal = Number(amount);
    if (!(nominal > 0)) { onNotify('Nominal harus positif.'); return; }
    setBusy(true);
    try {
      const body = {
        date, direction, category: category.trim() || (isBank ? 'Bank' : 'Operasional'),
        description: description.trim() || category, amount: nominal, account,
      };
      if (editId) {
        await apiFetch('/erp/cash', { method: 'PATCH', body: JSON.stringify({ id: editId, ...body }) });
        onNotify(`Entri ${label.toLowerCase()} diperbarui.`);
      } else {
        await apiFetch('/erp/cash', { method: 'POST', body: JSON.stringify(body) });
        onNotify(`Entri ${label.toLowerCase()} dicatat.`);
      }
      resetForm();
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal simpan');
    } finally {
      setBusy(false);
    }
  };

  const withBal = useMemo(() => {
    const chrono = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = opening;
    return chrono.map((r) => {
      running += r.direction === 'IN' ? r.amount : -r.amount;
      return { ...r, saldo: running };
    }).reverse();
  }, [rows, opening]);

  const historyView = useMemo(() => {
    if (!q.trim()) return withBal;
    const hay = q.trim().toLowerCase();
    return withBal.filter((r) => `${r.number || ''} ${r.category} ${r.description}`.toLowerCase().includes(hay));
  }, [withBal, q]);

  return (
    <div className="mod-layout">
      <div className="mod-main">
<section className="panel mod-list-panel">
        <h2>Riwayat {label}</h2>
        <p className="hint">Entri otomatis dari pembelian/penjualan tidak bisa diubah di sini.</p>
        <input
          type="search"
          placeholder={`Cari ${label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 12, width: '100%', maxWidth: 360, height: 38, borderRadius: 8, border: '1px solid var(--border)', padding: '0 12px' }}
        />
        {!historyView.length ? <p className="empty-state">Belum ada data.</p> : (
          <div className="table cash-hist">
            <div className="tr head">
              <span>Deskripsi</span><span>Arah</span><span>Nominal</span><span>Saldo</span><span>Aksi</span>
            </div>
            {historyView.map((r) => {
              const locked = LOCKED.has(r.category);
              return (
                <div className="tr" key={r.id}>
                  <span className="cell-stack">
                    <b>{r.description}</b>
                    <small>{new Date(r.date).toLocaleDateString('id-ID')} · {r.category}{r.number ? ` · ${r.number}` : ''}</small>
                  </span>
                  <span><span className={`badge ${r.direction === 'IN' ? 'badge-lunas' : 'badge-due'}`}>{r.direction === 'IN' ? 'Masuk' : 'Keluar'}</span></span>
                  <span className={r.direction === 'IN' ? 'profit' : 'loss'}>{money(r.amount)}</span>
                  <span><b>{money(r.saldo)}</b></span>
                  <span className="aksi-links aksi-cols-2">
                    <button type="button" disabled={locked} onClick={() => loadEdit(r)}>Edit</button>
                    {canDelete && !locked ? (
                      <button
                        type="button"
                        className="aksi-del"
                        disabled={busy}
                        onClick={async () => {
                          if (!window.confirm(`Hapus entri ${r.description}? Hanya Owner/Admin.`)) return;
                          setBusy(true);
                          try {
                            await apiFetch('/erp/cash/delete', { method: 'POST', body: JSON.stringify({ id: r.id }) });
                            onNotify('Entri dihapus.');
                            if (editId === r.id) resetForm();
                            onRefresh();
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : 'Gagal hapus');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >Hapus</button>
                    ) : <span className="aksi-slot" aria-hidden />}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
      <aside className="mod-aside">
        <section className="panel mod-form-panel">
          <h2>{editId ? `Edit ${label}` : `Tambah ${label}`}</h2>
          {editId ? (
            <p className="hint" style={{ color: '#B45309' }}>Mengedit entri — saldo menyesuaikan otomatis.</p>
          ) : (
            <p className="hint">Saldo = saldo awal + mutasi. Ringkasan di kanan mengikuti data live.</p>
          )}
          <form className="form" onSubmit={(e) => void submit(e)}>
            <label className="field"><span>Tanggal *</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="field"><span>Arah *</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}>
                <option value="IN">Masuk</option>
                <option value="OUT">Keluar</option>
              </select>
            </label>
            <label className="field"><span>Kategori</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kategori" />
            </label>
            <label className="field"><span>Nominal *</span>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Nominal" required />
            </label>
            <label className="field full"><span>Deskripsi *</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi" required />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button disabled={busy}>{busy ? 'Menyimpan…' : (editId ? 'Simpan perubahan' : `Catat ${label}`)}</button>
              {editId ? <button type="button" className="btn-secondary" onClick={resetForm}>Batal edit</button> : null}
            </div>
          </form>
        </section>
        <RingkasCard
          title={`Ringkasan ${label.toLowerCase()}`}
          badge={<span className={`badge ${saldo >= 0 ? 'badge-lunas' : 'badge-due'}`}>{saldo >= 0 ? 'Saldo positif' : 'Saldo negatif'}</span>}
          rows={[
            { label: 'Saldo awal', value: money(opening) },
            { label: `Saldo ${label}`, value: money(saldo), tone: saldo >= 0 ? 'profit' : 'loss' },
            { label: 'Total Masuk', value: money(masuk), tone: 'profit' },
            { label: 'Total Keluar', value: money(keluar), tone: 'loss' },
            { label: 'Jumlah entri', value: String(rows.length) },
          ]}
        />
      </aside>
    </div>
  );
}

/** Satu menu Kas & Bank — tab seperti Tutup Buku. */
export function KasBankPanel({
  cash, openingCash = 0, openingBank = 0, cashOnly, bankBalance, apiFetch, onNotify, onRefresh, initialTab = 'kas', canDelete = false,
}: {
  cash: CashEntry[];
  openingCash?: number;
  openingBank?: number;
  cashOnly?: number;
  bankBalance?: number;
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
  initialTab?: 'kas' | 'bank';
  canDelete?: boolean;
}) {
  const [tab, setTab] = useState<'kas' | 'bank'>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  return (
    <div className="tb-page">
      <div className="tb-tabs" role="tablist" aria-label="Kas dan Bank">
        {([
          ['kas', 'Kas'],
          ['bank', 'Bank'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`tb-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>
      {tab === 'kas' ? (
        <CashAccountBody
          mode="kas"
          cash={cash}
          opening={openingCash}
          saldoApi={cashOnly}
          apiFetch={apiFetch}
          onNotify={onNotify}
          onRefresh={onRefresh}
          canDelete={canDelete}
        />
      ) : (
        <CashAccountBody
          mode="bank"
          cash={cash}
          opening={openingBank}
          saldoApi={bankBalance}
          apiFetch={apiFetch}
          onNotify={onNotify}
          onRefresh={onRefresh}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

function DueListBody({
  kind, rows, apiFetch, onNotify, onRefresh,
}: {
  kind: 'hutang' | 'piutang';
  rows: DueRow[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
}) {
  const isHutang = kind === 'hutang';
  const title = isHutang ? 'Hutang' : 'Piutang';
  const totalSisa = rows.reduce((s, r) => s + Number(r.remaining ?? r.total ?? 0), 0);
  const [payId, setPayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { setPayId(null); setQ(''); }, [kind]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const hay = q.trim().toLowerCase();
    return rows.filter((r) => `${r.number} ${r.partner}`.toLowerCase().includes(hay));
  }, [rows, q]);

  return (
    <div className="mod-layout">
      <div className="mod-main">
        <section className="panel mod-list-panel">
          <h2>Daftar {title}</h2>
        <p className="hint">
          {isHutang
            ? 'Bayar sebagian atau lunas. Cetak nota dari dokumen terkait.'
            : 'Terima sebagian atau lunas. Cetak invoice dari dokumen terkait.'}
        </p>
        <input
          type="search"
          placeholder={`Cari ${title.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 12, width: '100%', maxWidth: 360, height: 38, borderRadius: 8, border: '1px solid var(--border)', padding: '0 12px' }}
        />
        {!filtered.length ? (
          <p className="empty-state">Tidak ada {title.toLowerCase()} outstanding.</p>
        ) : (
          <div className="table due-hist">
            <div className="tr head"><span>Dokumen</span><span>Partner</span><span>Sisa</span><span>Aksi</span></div>
            {filtered.map((r) => {
              const sisa = Number(r.remaining ?? r.total ?? 0);
              const openPay = payId === r.id;
              return (
                <div className="tr" key={r.id || r.number} style={openPay ? { alignItems: 'start' } : undefined}>
                  <span>
                    <b>{r.number}</b>
                    <small>{new Date(r.date).toLocaleDateString('id-ID')} · total {money(r.total)}</small>
                  </span>
                  <span>{r.partner}</span>
                  <span><b className="loss">{money(sisa)}</b></span>
                  <span>
                    <span className="aksi-links aksi-cols-2">
                      <button
                        type="button"
                        disabled={!r.id || busy}
                        onClick={async () => {
                          if (!r.id) return;
                          try {
                            const path = isHutang ? '/erp/documents/nota-pembelian' : '/erp/documents/invoice';
                            const doc = await apiFetch<{ html: string; title: string }>(`${path}?transactionId=${r.id}`);
                            openPrintDocument(doc.title, doc.html);
                          } catch (e) {
                            onNotify(e instanceof Error ? e.message : 'Gagal PDF');
                          }
                        }}
                      >PDF</button>
                      <button
                        type="button"
                        className="aksi-pay"
                        disabled={!r.id || busy}
                        onClick={() => setPayId(openPay ? null : (r.id || null))}
                      >{isHutang ? 'Bayar' : 'Terima'}</button>
                    </span>
                    {openPay && r.id ? (
                      <form
                        className="due-pay-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          const amount = Number(f.get('amount'));
                          const acc = f.get('account') === 'BANK' ? 'BANK' : 'CASH';
                          setBusy(true);
                          try {
                            await apiFetch('/erp/transactions/pay', {
                              method: 'POST',
                              body: JSON.stringify({ id: r.id, account: acc, amount }),
                            });
                            onNotify(`${r.number}: ${isHutang ? 'pembayaran' : 'penerimaan'} ${money(amount)} dicatat.`);
                            setPayId(null);
                            onRefresh();
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : 'Gagal');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <input name="amount" type="number" min="1" defaultValue={sisa} required aria-label="Nominal" />
                        <select name="account" aria-label="Akun">
                          <option value="CASH">Kas</option>
                          <option value="BANK">Bank</option>
                        </select>
                        <button type="submit" className="btn-sm" disabled={busy}>{isHutang ? 'Bayar' : 'Terima'}</button>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => setPayId(null)}>Batal</button>
                      </form>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>
      <aside className="mod-aside">
      <RingkasCard
        title={`Ringkasan ${title.toLowerCase()}`}
        badge={<span className={`badge ${rows.length ? 'badge-due' : 'badge-lunas'}`}>{rows.length ? 'Outstanding' : 'Lunas'}</span>}
        hint="Posisi outstanding saat ini."
        rows={[
          { label: 'Jumlah faktur', value: String(rows.length) },
          { label: `Total sisa ${title.toLowerCase()}`, value: money(totalSisa), tone: 'loss' },
          { label: 'Rata-rata / faktur', value: money(rows.length ? totalSisa / rows.length : 0) },
        ]}
      />
      </aside>
    </div>
  );
}

/** Satu menu Hutang & Piutang — tab seperti Tutup Buku. */
export function DuePanel({
  payables, receivables, apiFetch, onNotify, onRefresh, initialTab = 'hutang',
}: {
  payables: DueRow[];
  receivables: DueRow[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
  initialTab?: 'hutang' | 'piutang';
}) {
  const [tab, setTab] = useState<'hutang' | 'piutang'>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  return (
    <div className="tb-page">
      <div className="tb-tabs" role="tablist" aria-label="Hutang dan Piutang">
        {([
          ['hutang', 'Hutang'],
          ['piutang', 'Piutang'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`tb-tab${tab === key ? ' active' : ''}`}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </div>
      {tab === 'hutang' ? (
        <DueListBody kind="hutang" rows={payables} apiFetch={apiFetch} onNotify={onNotify} onRefresh={onRefresh} />
      ) : (
        <DueListBody kind="piutang" rows={receivables} apiFetch={apiFetch} onNotify={onNotify} onRefresh={onRefresh} />
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { openPrintDocument, printBeritaAcaraPdf } from './print';
import {
  TxModulePage, TxDrawer, TxSection, TxIconBtn, TxPager, useClientPager, moneyFmt, downloadCsv, printHtmlTable,
} from './tx-shell';

type Partner = { id: string; name: string; phone?: string; type: 'CUSTOMER' | 'SUPPLIER' };
type Size = { id: string; label: string; sortOrder: number };
type BaLine = {
  binNote?: string; sizeLabel: string; qtyInitial?: number; quantity: number; price: number; selisih?: number;
};
type BeritaAcara = {
  id: string; number: string; date: string; dateDepart?: string; supplier: string;
  refNumber?: string; vehicle?: string; pondLocation?: string; checker?: string; adminName?: string; receiver?: string;
  plasePercent?: number; dpNote?: number; transport?: number; jasaBongkar?: number; upahSopir?: number;
  priorDebtNote?: number; priorDebtRef?: string; payMethodNote?: string;
  notaAktual?: number; totalPlase?: number; totalTagihan?: number; totalUangMasuk?: number; sisaEstimasi?: number;
  totalAwal?: number; totalAktual?: number; status: string; statusLabel?: string; notes?: string;
  purchaseId?: string; purchaseNumber?: string; lines: BaLine[];
};

const money = moneyFmt;

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const BAK_SARAN = ['Bak Depan', 'Bak Tengah', 'Bak Belakang'];
const MAX_BA = 30;
const emptyLine = (bak = ''): BaLine => ({ binNote: bak, sizeLabel: '', qtyInitial: 0, quantity: 0, price: 0 });


export function BeritaAcaraPanel({ suppliers, sizes, beritaAcara, apiFetch, onNotify, onRefresh }: {
  suppliers: Partner[];
  sizes: Size[];
  beritaAcara: BeritaAcara[];
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh: () => void;
}) {
  const [editId, setEditId] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [pondLocation, setPondLocation] = useState('');
  const [dateDepart, setDateDepart] = useState(todayISO);
  const [dateArrive, setDateArrive] = useState(todayISO);
  const [checker, setChecker] = useState('');
  const [adminName, setAdminName] = useState('');
  const [receiver, setReceiver] = useState('');
  const [lines, setLines] = useState<BaLine[]>(() => [emptyLine(BAK_SARAN[0])]);
  const [dpNote, setDpNote] = useState(0);
  const [payMethodNote, setPayMethodNote] = useState<'Kas' | 'Bank'>('Kas');
  const [transport, setTransport] = useState(0);
  const [jasaBongkar, setJasaBongkar] = useState(0);
  const [upahSopir, setUpahSopir] = useState(0);
  const [plasePercent, setPlasePercent] = useState(3);
  const [priorDebtNote, setPriorDebtNote] = useState(0);
  const [priorDebtRef, setPriorDebtRef] = useState('');
  const [sisaOptions, setSisaOptions] = useState<Array<{ ref: string; label: string; sisa: number }>>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');

  const ringkas = useMemo(() => {
    let totalAwal = 0; let totalAktual = 0; let nota = 0;
    for (const l of lines) {
      totalAwal += Number(l.qtyInitial) || 0;
      totalAktual += Number(l.quantity) || 0;
      nota += (Number(l.quantity) || 0) * (Number(l.price) || 0);
    }
    const selisih = totalAktual - totalAwal;
    const persenPenyusutan = totalAwal > 0 ? ((totalAwal - totalAktual) / totalAwal) * 100 : 0;
    const plase = Math.round(nota * plasePercent / 100);
    const tagihan = nota + priorDebtNote;
    const masuk = dpNote + transport + jasaBongkar + upahSopir + plase;
    const sisa = tagihan - masuk;
    return { totalAwal, totalAktual, selisih, persenPenyusutan, nota, plase, tagihan, masuk, sisa };
  }, [lines, plasePercent, priorDebtNote, dpNote, transport, jasaBongkar, upahSopir]);

  const history = useMemo(() => {
    if (!q.trim()) return beritaAcara;
    const hay = q.trim().toLowerCase();
    return beritaAcara.filter((r) =>
      `${r.number} ${r.purchaseNumber || ''} ${r.supplier} ${r.statusLabel || r.status} ${r.date}`.toLowerCase().includes(hay),
    );
  }, [beritaAcara, q]);

  const today = todayISO();
  const ym = monthKey();
  const summary = useMemo(() => [
    { label: 'Jumlah BA', value: String(beritaAcara.length), tone: 'navy' as const },
    { label: 'Bulan ini', value: String(beritaAcara.filter((r) => r.date.slice(0, 7) === ym).length), tone: 'teal' as const },
    { label: 'Belum PO', value: String(beritaAcara.filter((r) => !r.purchaseId).length), tone: 'red' as const },
    { label: 'Sudah PO', value: String(beritaAcara.filter((r) => !!r.purchaseId).length), tone: 'purple' as const },
    { label: 'Lunas estimasi', value: String(beritaAcara.filter((r) => (r.statusLabel || '') === 'Lunas' || (r.sisaEstimasi || 0) <= 0).length), tone: 'green' as const },
    { label: 'Hari ini', value: String(beritaAcara.filter((r) => r.date.slice(0, 10) === today).length), tone: 'navy' as const },
  ], [beritaAcara, ym, today]);

  const pager = useClientPager(history, 10);

  useEffect(() => {
    if (!supplier.trim()) { setSisaOptions([]); return; }
    const t = setTimeout(() => {
      void apiFetch<Array<{ ref: string; label: string; sisa: number }>>(
        `/erp/berita-acara/sisa-notes?supplier=${encodeURIComponent(supplier)}${editId ? `&excludeId=${editId}` : ''}`,
      ).then(setSisaOptions).catch(() => setSisaOptions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [supplier, editId, apiFetch]);

  const reset = () => {
    setEditId(''); setEditNumber(''); setPurchaseNumber('');
    setSupplier(''); setRefNumber(''); setVehicle(''); setPondLocation('');
    setDateDepart(todayISO()); setDateArrive(todayISO());
    setChecker(''); setAdminName(''); setReceiver('');
    setLines(BAK_SARAN.map((b) => emptyLine(b)));
    setDpNote(0); setPayMethodNote('Kas'); setTransport(0); setJasaBongkar(0); setUpahSopir(0);
    setPlasePercent(3); setPriorDebtNote(0); setPriorDebtRef(''); setNotes('');
  };

  const loadEdit = (row: BeritaAcara) => {
    setEditId(row.id); setEditNumber(row.number); setPurchaseNumber(row.purchaseNumber || '');
    setSupplier(row.supplier); setRefNumber(row.refNumber || '');
    setVehicle(row.vehicle || ''); setPondLocation(row.pondLocation || '');
    setDateDepart((row.dateDepart || row.date).slice(0, 10));
    setDateArrive(row.date.slice(0, 10));
    setChecker(row.checker || ''); setAdminName(row.adminName || ''); setReceiver(row.receiver || '');
    setLines(row.lines.length ? row.lines.map((l) => ({
      binNote: l.binNote || '', sizeLabel: l.sizeLabel, qtyInitial: l.qtyInitial || 0,
      quantity: l.quantity, price: l.price || 0,
    })) : [emptyLine('Bak Depan')]);
    setDpNote(row.dpNote || 0); setPayMethodNote(row.payMethodNote === 'Bank' ? 'Bank' : 'Kas');
    setTransport(row.transport || 0); setJasaBongkar(row.jasaBongkar || 0); setUpahSopir(row.upahSopir || 0);
    setPlasePercent(row.plasePercent ?? 3); setPriorDebtNote(row.priorDebtNote || 0);
    setPriorDebtRef(row.priorDebtRef || ''); setNotes(row.notes || '');
  };

  const openCreate = () => { reset(); setDrawerOpen(true); };
  const openEdit = (row: BeritaAcara) => { loadEdit(row); setDrawerOpen(true); };
  const openDup = (row: BeritaAcara) => {
    loadEdit(row);
    setEditId(''); setEditNumber(''); setPurchaseNumber('');
    setDrawerOpen(true);
  };
  const closeDrawer = () => { reset(); setDrawerOpen(false); };

  const cetak = async (id: string, number: string) => {
    try {
      const doc = await apiFetch<{ html: string; title: string }>(`/erp/documents/berita-acara?id=${id}`);
      if (!doc?.html) throw new Error('Document empty');
      openPrintDocument(doc.title || `Berita Acara ${number}`, doc.html);
      onNotify(`PDF ${number} siap — Preview / Cetak / Share.`);
    } catch (e) {
      const row = history.find(r => r.id === id);
      printBeritaAcaraPdf({
        baNumber: number,
        date: row?.date ? new Date(row.date).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID'),
        petaniName: row?.supplier || 'Supplier / Petani',
        workspaceName: 'TUMBU OS DISTRIBUTION',
        komoditas: row?.lines?.[0]?.sizeLabel || 'Benih Ikan Air Tawar',
        sekatanDetails: (row?.lines || []).map(l => ({
          label: l.binNote || 'Sekatan',
          awalPetani: l.qtyInitial || l.quantity,
          ulangDistributor: l.quantity,
        })),
        totalAwal: (row?.lines || []).reduce((acc, l) => acc + (l.qtyInitial || l.quantity), 0),
        totalUlang: (row?.lines || []).reduce((acc, l) => acc + l.quantity, 0),
        susutEkor: Math.max(0, (row?.lines || []).reduce((acc, l) => acc + ((l.qtyInitial || l.quantity) - l.quantity), 0)),
        notes: row?.notes || 'Hasil hitung ulang fisik benih di lokasi.',
      });
      onNotify(`PDF ${number} siap — Preview / Cetak.`);
    }
  };

  const save = async () => {
    const payloadLines = lines
      .filter((l) => (l.binNote || '').trim() && l.sizeLabel && ((l.qtyInitial || 0) > 0 || (l.quantity || 0) > 0))
      .map((l) => ({
        binNote: (l.binNote || '').trim(),
        sizeLabel: l.sizeLabel,
        qtyInitial: Number(l.qtyInitial) || 0,
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }));
    if (!supplier.trim()) { onNotify('Isi nama supplier terlebih dahulu.'); return; }
    if (!checker.trim() || !adminName.trim()) { onNotify('Checker dan Admin wajib.'); return; }
    if (!payloadLines.length) { onNotify('Minimal satu baris bak/ukuran.'); return; }
    setBusy(true);
    try {
      const body = {
        ...(editId ? { id: editId } : {}),
        supplier: supplier.trim(),
        refNumber: refNumber.trim() || undefined,
        vehicle: vehicle.trim() || undefined,
        pondLocation: pondLocation.trim() || undefined,
        tanggalBerangkat: dateDepart,
        tanggalTiba: dateArrive,
        checker: checker.trim(),
        adminName: adminName.trim(),
        receiver: receiver.trim() || undefined,
        plasePercent, dpNote, transport, jasaBongkar, upahSopir,
        priorDebtNote, priorDebtRef: priorDebtRef.trim() || undefined,
        payMethodNote, notes: notes.trim() || undefined,
        lines: payloadLines,
      };
      const data = await apiFetch<BeritaAcara>(editId ? '/erp/berita-acara' : '/erp/berita-acara', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onNotify(editId ? `BA diperbarui: ${data.number}` : `BA tersimpan: ${data.number}. Cetak lewat ikon PDF di daftar bila perlu.`);
      closeDrawer();
      onRefresh();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal simpan BA');
    } finally {
      setBusy(false);
    }
  };

  const exportHeaders = ['Dokumen', 'Supplier', 'Tanggal', 'Nota', 'Status', 'PO'];
  const exportRows = () => history.map((r) => [
    r.number, r.supplier, new Date(r.date).toLocaleDateString('id-ID'),
    String(r.notaAktual || 0), r.statusLabel || (r.purchaseId ? 'Belum Lunas' : 'Belum PO'),
    r.purchaseNumber || '',
  ]);

  const ringkasMini = (
    <div className="txm-ringkas-mini">
      <div><span>Nota</span><b>{money(ringkas.nota)}</b></div>
      <div><span>Tagihan</span><b>{money(ringkas.tagihan)}</b></div>
      <div><span>Sisa</span><b className={ringkas.sisa > 0 ? 'is-loss' : 'is-ok'}>{money(ringkas.sisa)}</b></div>
    </div>
  );


  return (
    <>
      <TxModulePage
        title="Berita Acara"
        breadcrumb="Logistik"
        hint="Pencatatan serah terima ikan di lapangan (Berita Acara). Klik untuk melihat detail atau mencetak PDF."
        onRefresh={onRefresh}
        onAdd={openCreate}
        addLabel="+ Berita Acara"
        summary={summary}
        toolbar={(
          <>
            <input type="search" placeholder="Cari no BA / PO / supplier…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="btn-secondary btn-sm" onClick={() => downloadCsv('berita-acara.csv', exportHeaders, exportRows())}>Export CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => printHtmlTable('Daftar Berita Acara', exportHeaders, exportRows())}>Print list</button>
          </>
        )}
      >
        <div className="txm-table-scroll">
          {!history.length ? (
            <p className="txm-empty">{q ? 'Tidak ada BA yang cocok' : 'Belum ada BA'}</p>
          ) : (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Supplier</th>
                  <th>Nota</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
                  <tr key={r.id}>
                    <td className="txm-doc">
                      <b>{r.number}</b>
                      <small>{r.purchaseNumber ? `PO ${r.purchaseNumber}` : 'Belum PO'} · {new Date(r.date).toLocaleDateString('id-ID')}</small>
                    </td>
                    <td>{r.supplier}</td>
                    <td>
                      <b>{money(r.notaAktual || 0)}</b>
                      {(r.sisaEstimasi || 0) > 0 ? <small>sisa {money(r.sisaEstimasi || 0)}</small> : null}
                    </td>
                    <td>
                      <span className={`badge ${(r.statusLabel || '') === 'Lunas' ? 'badge-lunas' : (r.purchaseId ? 'badge-due' : '')}`}>
                        {r.statusLabel || (r.purchaseId ? 'Belum Lunas' : 'Belum PO')}
                      </span>
                    </td>
                    <td>
                      <div className="txm-actions">
                        <TxIconBtn icon="print" label="PDF" onClick={() => void cetak(r.id, r.number)} />
                        <TxIconBtn icon="edit" label="Edit" onClick={() => openEdit(r)} />
                        <TxIconBtn icon="copy" label="Duplikat" onClick={() => openDup(r)} />
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
        title={editId ? 'Edit Berita Acara' : 'Tambah Berita Acara'}
        hint="Isi dokumen, item, dan catatan — lalu Simpan."
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
            <p className="hint" style={{ color: '#B45309', gridColumn: '1 / -1' }}>
              Mengedit {editNumber}{purchaseNumber ? ` · tertaut PO ${purchaseNumber}` : ''} — perubahan ikut menyelaraskan PO yang tertaut.
            </p>
          ) : (
            <p className="hint" style={{ gridColumn: '1 / -1' }}>
              Serah terima barang — hitung ulang qty. Angka keuangan di sini hanya catatan (tidak masuk kas/bank/hutang).
            </p>
          )}

          <TxSection title="Dokumen">
            <label className="field"><span>Supplier *</span>
              <input list="list-supplier-ba" value={supplier} onChange={(e) => setSupplier(e.target.value)} required placeholder="Ketik / pilih supplier" />
            </label>
            <datalist id="list-supplier-ba">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            <label className="field"><span>No Referensi</span>
              <input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="No surat jalan / nota dari supplier" />
            </label>
            <label className="field"><span>Kendaraan</span>
              <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="mis. Pick Up / Truk Engkel" />
            </label>
            <label className="field"><span>Lokasi Kolam</span>
              <input value={pondLocation} onChange={(e) => setPondLocation(e.target.value)} placeholder="mis. Kolam A1-A45" />
            </label>
            <label className="field"><span>Tanggal Berangkat *</span>
              <input type="date" value={dateDepart} onChange={(e) => setDateDepart(e.target.value)} required />
            </label>
            <label className="field"><span>Tanggal Tiba *</span>
              <input type="date" value={dateArrive} onChange={(e) => setDateArrive(e.target.value)} required />
            </label>
            <label className="field"><span>Checker *</span>
              <input value={checker} onChange={(e) => setChecker(e.target.value)} required placeholder="Nama pemeriksa" />
            </label>
            <label className="field"><span>Admin gudang *</span>
              <input value={adminName} onChange={(e) => setAdminName(e.target.value)} required placeholder="Nama admin" />
            </label>
            <label className="field full"><span>Penerima Barang</span>
              <input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="opsional" />
            </label>
          </TxSection>

          <TxSection title="Item">
            <p className="hint" style={{ gridColumn: '1 / -1' }}>Isi jumlah awal (estimasi kirim) &amp; jumlah aktual (hasil hitung). Harga opsional — hanya catatan estimasi.</p>
            <div className="full" style={{ gridColumn: '1 / -1' }}>
              {lines.map((line, i) => {
                const selisih = (Number(line.quantity) || 0) - (Number(line.qtyInitial) || 0);
                return (
                  <div key={i} className="tx-item-card">
                    <div className="tx-item-head">
                      <strong>Baris #{i + 1}</strong>
                      {lines.length > 1 ? (
                        <button type="button" className="btn-secondary" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>Hapus</button>
                      ) : null}
                    </div>
                    <div className="form" style={{ margin: 0 }}>
                      <label className="field"><span>Lokasi / bak *</span>
                        <input list="list-bak-ba" value={line.binNote} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, binNote: e.target.value } : r))} required />
                      </label>
                      <label className="field"><span>Varian / SKU *</span>
                        <select value={line.sizeLabel} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, sizeLabel: e.target.value } : r))} required>
                          <option value="">— pilih ukuran —</option>
                          {sizes.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
                          {line.sizeLabel && !sizes.some((s) => s.label === line.sizeLabel) ? <option value={line.sizeLabel}>{line.sizeLabel}</option> : null}
                        </select>
                      </label>
                      <label className="field"><span>Jumlah awal *</span>
                        <input type="number" min={0} value={line.qtyInitial || ''} onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, qtyInitial: Number(e.target.value) || 0 } : r))} />
                      </label>
                      <label className="field"><span>Jumlah aktual *</span>
                        <input type="number" min={0} value={line.quantity || ''} placeholder="Hasil hitung ulang" onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) || 0 } : r))} />
                      </label>
                      <label className="field"><span>Harga/qty (catatan)</span>
                        <input type="number" min={0} value={line.price || ''} placeholder="Opsional" onChange={(e) => setLines((prev) => prev.map((r, idx) => idx === i ? { ...r, price: Number(e.target.value) || 0 } : r))} />
                      </label>
                      <div style={{ alignSelf: 'end', fontSize: 13 }}>
                        Selisih: <b style={{ color: selisih < 0 ? '#DC2626' : (selisih > 0 ? '#16A34A' : undefined) }}>{selisih > 0 ? '+' : ''}{selisih.toLocaleString('id-ID')}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
              <datalist id="list-bak-ba">{BAK_SARAN.map((b) => <option key={b} value={b} />)}</datalist>
              <button type="button" className="btn-add-row"
                style={{ width: '100%', padding: '12px', justifyContent: 'center', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', color: '#64748B' }}
                disabled={lines.length >= MAX_BA}
                onClick={() => {
                  if (lines.length >= MAX_BA) { onNotify(`Maksimal ${MAX_BA} baris.`); return; }
                  const nextBak = BAK_SARAN[lines.length % BAK_SARAN.length] || `Bak ${lines.length + 1}`;
                  setLines((prev) => [...prev, emptyLine(nextBak)]);
                }}>
                <span className="btn-add-row-icon" aria-hidden="true">+</span>
                Tambah Kolam / Bak
              </button>
            </div>
          </TxSection>

          <TxSection title="Biaya / Catatan">
            <label className="field"><span>Down Payment (Rp)</span>
              <input type="number" min={0} value={dpNote || ''} onChange={(e) => setDpNote(Number(e.target.value) || 0)} />
            </label>
            <label className="field"><span>Via Bayar (Catatan)</span>
              <select value={payMethodNote} onChange={(e) => setPayMethodNote(e.target.value as 'Kas' | 'Bank')}>
                <option value="Kas">Cash</option>
                <option value="Bank">Transfer</option>
              </select>
            </label>
            <label className="field"><span>Transport (Rp)</span>
              <input type="number" min={0} value={transport || ''} onChange={(e) => setTransport(Number(e.target.value) || 0)} />
            </label>
            <label className="field"><span>Jasa Bongkar (Rp)</span>
              <input type="number" min={0} value={jasaBongkar || ''} onChange={(e) => setJasaBongkar(Number(e.target.value) || 0)} />
            </label>
            <label className="field"><span>Upah Sopir (Rp)</span>
              <input type="number" min={0} value={upahSopir || ''} onChange={(e) => setUpahSopir(Number(e.target.value) || 0)} />
            </label>
            <label className="field"><span>Persen Plase (%)</span>
              <input type="number" min={0} max={100} step={0.1} value={plasePercent} onChange={(e) => setPlasePercent(Number(e.target.value) || 0)} />
            </label>
            <label className="field full"><span>Catatan Sisa (bukan hutang global)</span>
              <select value={priorDebtRef} onChange={(e) => {
                const ref = e.target.value;
                setPriorDebtRef(ref);
                const opt = sisaOptions.find((o) => o.ref === ref);
                setPriorDebtNote(opt?.sisa || 0);
              }}>
                <option value="">— tidak ada / isi manual —</option>
                {sisaOptions.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
              </select>
              <input type="number" min={0} value={priorDebtNote || ''} onChange={(e) => setPriorDebtNote(Number(e.target.value) || 0)} style={{ marginTop: 8 }} />
              <small style={{ color: 'var(--muted)' }}>Hanya catatan di dokumen BA. Tidak masuk Kas/Bank/Hutang.</small>
            </label>
            <label className="field full"><span>Keterangan</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="opsional" />
            </label>
          </TxSection>

        </div>
      </TxDrawer>
    </>
  );
}

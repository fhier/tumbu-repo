'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { openPrintDocument } from './print';
import { skinForBlueprint, type ServiceSkinConfig } from './service-skin';
import { safeResetForm } from './form-utils';
import { CASH_DIRECTION_LABEL } from './user-labels';

type Cust = { id: string; name: string; phone?: string | null; address?: string | null };
type Svc = { id: string; name: string; category: string; unit: string; price: number | string };
type WO = {
  id: string; number: string; customerName: string; status: string; paymentStatus: string;
  total: number | string; assignedTo?: string | null; scheduleAt?: string | null;
  lines: Array<{ description: string; quantity: number | string; unitPrice: number | string }>;
};

const money = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v) || 0);
const STATUSES = ['NEW', 'SURVEY', 'SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const PAYS = ['UNPAID', 'PARTIAL', 'PAID'] as const;
const STATUS_LABEL: Record<string, string> = {
  NEW: 'Baru', SURVEY: 'Survey', SCHEDULED: 'Terjadwal', ON_THE_WAY: 'Dalam perjalanan',
  IN_PROGRESS: 'Dikerjakan', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
};
const PAY_LABEL: Record<string, string> = { UNPAID: 'Belum bayar', PARTIAL: 'Sebagian', PAID: 'Lunas' };
const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', STAFF: 'Staf', TECHNICIAN: 'Teknisi' };
const QT_LABEL: Record<string, string> = {
  DRAFT: 'Draf', SENT: 'Terkirim', ACCEPTED: 'Diterima', REJECTED: 'Ditolak', EXPIRED: 'Kedaluwarsa', CONVERTED: 'Jadi WO',
};
const statusText = (s: string) => STATUS_LABEL[s] || QT_LABEL[s] || s;
const payText = (s: string) => PAY_LABEL[s] || s;
const statusBadge = (s: string) => (s === 'COMPLETED' || s === 'ACCEPTED' || s === 'CONVERTED' || s === 'PAID' ? 'badge-lunas' : 'badge-due');

export function ServicePages({
  page, apiFetch, onNotify, blueprintId, modules, userName, userRole,
  workspaceName, workspaceTagline, workspaceLogoUrl,
}: {
  page: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefresh?: () => void;
  blueprintId?: string;
  /** Assets visible only when platform module `assets` is enabled (D4 / AST-5). */
  modules?: string[];
  workspaceName?: string;
  workspaceTagline?: string | null;
  workspaceLogoUrl?: string | null;
  userName?: string;
  userRole?: string;
}) {
  const isTech = String(userRole || '').toUpperCase() === 'TECHNICIAN';
  const skin = useMemo(() => skinForBlueprint(blueprintId), [blueprintId]);
  const assetsEnabled = (modules || []).includes('assets');

  if (page === 'customers') return <Customers apiFetch={apiFetch} onNotify={onNotify} readOnly={isTech} />;
  if (page === 'services' && !isTech) return <Services apiFetch={apiFetch} onNotify={onNotify} skin={skin} />;
  if (page === 'quotations' && !isTech) return <Quotations apiFetch={apiFetch} onNotify={onNotify} skin={skin} />;
  if (page === 'orders' || page === 'schedule' || page === 'invoice') {
    return <Orders apiFetch={apiFetch} onNotify={onNotify} mode={page} techMode={isTech} userName={userName} />;
  }
  if ((page === 'technicians' || page === 'members') && !isTech) {
    return <Members apiFetch={apiFetch} onNotify={onNotify} canInvite={['OWNER', 'ADMIN'].includes(String(userRole || '').toUpperCase())} />;
  }
  if (page === 'assets') {
    return <Assets apiFetch={apiFetch} onNotify={onNotify} show={assetsEnabled} readOnly={isTech} skin={skin} />;
  }
  if ((page === 'keuangan' || page === 'laporan') && !isTech) return <Finance apiFetch={apiFetch} />;
  if ((page === 'kas' || page === 'bank' || page === 'pengeluaran' || page === 'piutang') && !isTech) {
    return <FinanceOps page={page} apiFetch={apiFetch} onNotify={onNotify} />;
  }
  if (page === 'pengaturan' && !isTech) return <WsSettings apiFetch={apiFetch} onNotify={onNotify} />;
  if (page === 'dashboard' || !page) {
    return (
      <Dash
        apiFetch={apiFetch}
        techMode={isTech}
        userName={userName}
        skin={skin}
        workspaceName={workspaceName}
        workspaceTagline={workspaceTagline}
        workspaceLogoUrl={workspaceLogoUrl}
      />
    );
  }
  return (
    <p className="empty-state">
      Halaman ini belum tersedia di aplikasi usaha. Silakan pilih menu lain dari navigasi.
    </p>
  );
}

function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch {
      setData(null);
      setError('Data gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

function LoadFeedback({
  loading, error, reload, empty, emptyMessage, children,
}: {
  loading: boolean;
  error: string;
  reload: () => void | Promise<void>;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  if (loading) return <p className="empty-state">Memuat…</p>;
  if (error) {
    return (
      <p className="empty-state danger">
        {error}{' '}
        <button type="button" className="linkish" onClick={() => void reload()}>Coba lagi</button>
      </p>
    );
  }
  if (empty) return <p className="empty-state">{emptyMessage || 'Belum ada data.'}</p>;
  return <>{children}</>;
}

function Dash({ apiFetch, techMode, userName, skin, workspaceName, workspaceTagline, workspaceLogoUrl }: {
  apiFetch: <T>(p: string) => Promise<T>;
  techMode?: boolean;
  userName?: string;
  skin: ServiceSkinConfig;
  workspaceName?: string;
  workspaceTagline?: string | null;
  workspaceLogoUrl?: string | null;
}) {
  const loader = useCallback(() => apiFetch<Record<string, unknown>>('/service/dashboard'), [apiFetch]);
  const ordersLoader = useCallback(() => apiFetch<WO[]>('/service/orders'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const { data: orders } = useLoad(ordersLoader);
  if (loading) return <p className="empty-state">Memuat dashboard…</p>;
  if (error) {
    return (
      <p className="empty-state danger">
        {error}{' '}
        <button type="button" className="linkish" onClick={() => void reload()}>Coba lagi</button>
      </p>
    );
  }
  if (!data) return null;

  const bizName = workspaceName || skin.displayName;
  const tag = (workspaceTagline || '').trim() || skin.tagline || '';

  if (techMode) {
    const mine = (orders || []).filter((o) => {
      const mineName = (userName || '').toLowerCase();
      const assigned = String(o.assignedTo || '').toLowerCase();
      const active = ['SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'NEW'].includes(o.status);
      return active && (!assigned || assigned.includes(mineName) || mineName.includes(assigned));
    });
    const open = (orders || []).filter((o) => ['SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'NEW'].includes(o.status));
    return (
      <>
        <section className="panel hero-panel ws-home-hero">
          <div className="ws-home-hero-row">
            {workspaceLogoUrl ? <img className="ws-home-hero-logo" src={workspaceLogoUrl} alt="" /> : null}
            <div>
              <h2>Halo, {userName || 'Teknisi'}</h2>
              <p className="hint">Fokus ke pekerjaan hari ini di {bizName}.</p>
            </div>
          </div>
        </section>
        <section className="metrics platform-metrics">
          <article className="metric"><span>Perlu dikerjakan</span><strong>{open.length}</strong></article>
          <article className="metric"><span>Ditugaskan ke Anda</span><strong>{mine.length}</strong></article>
          <article className="metric"><span>Terjadwal</span><strong>{String(data.scheduled)}</strong></article>
          <article className="metric"><span>Berjalan</span><strong>{String(data.inProgress)}</strong></article>
        </section>
        <section className="panel">
          <h2>Antrian pekerjaan</h2>
          {!open.length ? <p className="empty-state">Belum ada pekerjaan aktif.</p> : (
            <div className="table wide">
              {open.slice(0, 12).map((o) => (
                <div className="tr" key={o.id}>
                  <span><b>{o.number}</b><br /><small>{o.customerName}</small></span>
                  <span><span className={`badge ${statusBadge(o.status)}`}>{statusText(o.status)}</span></span>
                  <span>{o.scheduleAt ? new Date(o.scheduleAt).toLocaleString('id-ID') : '—'}</span>
                  <span>{o.assignedTo || 'Belum ditugaskan'}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  const cards: Array<[string, string]> = [
    ['Order hari ini', String(data.ordersToday)], ['Terjadwal', String(data.scheduled)], ['Berjalan', String(data.inProgress)],
    ['Selesai', String(data.completed)], ['Pendapatan', money(Number(data.revenue))], ['Pengeluaran', money(Number(data.expenses))],
    ['Piutang', money(Number(data.receivables))], ['Kas', money(Number(data.cashBalance))],
  ];
  return (
    <>
      <section className="panel hero-panel ws-home-hero">
        <div className="ws-home-hero-row">
          {workspaceLogoUrl ? (
            <img className="ws-home-hero-logo" src={workspaceLogoUrl} alt="" />
          ) : bizName ? (
            <span className="ws-home-hero-fallback" aria-hidden="true">{bizName.slice(0, 1).toUpperCase()}</span>
          ) : null}
          <div>
            <h2>Selamat datang di {bizName || 'usaha Anda'}</h2>
            <p className="hint">{tag || `Kelola operasional ${bizName || 'usaha Anda'} hari ini.`}</p>
            <span className="dash-identity-bp">{skin.displayName}</span>
          </div>
        </div>
      </section>
      <section className="metrics platform-metrics">
        {cards.map(([l, v]) => <article className="metric" key={l}><span>{l}</span><strong>{v}</strong></article>)}
      </section>
    </>
  );
}

function Customers({ apiFetch, onNotify, readOnly }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void; readOnly?: boolean }) {
  const loader = useCallback(() => apiFetch<Cust[]>('/service/customers'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    try {
      await apiFetch('/service/customers', { method: 'POST', body: JSON.stringify({ name: f.get('name'), phone: f.get('phone'), address: f.get('address'), notes: f.get('notes') }) });
      onNotify('Pelanggan disimpan.'); safeResetForm(formEl); reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };
  return (
    <>
      {!readOnly && (
      <section className="panel"><h2>Tambah Pelanggan</h2>
        <form className="form" onSubmit={submit}>
          <input name="name" placeholder="Nama" required /><input name="phone" placeholder="Telepon" />
          <input name="address" placeholder="Alamat" /><input name="notes" placeholder="Catatan" />
          <button type="submit">Simpan</button>
        </form>
      </section>
      )}
      <section className="panel"><h2>Daftar Pelanggan</h2>
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!(data || []).length} emptyMessage="Belum ada pelanggan.">
          <div className="table">{(data || []).map((c) => (
            <div className="tr" key={c.id}><span><b>{c.name}</b></span><span>{c.phone || '-'}</span><span>{c.address || '-'}</span></div>
          ))}</div>
        </LoadFeedback>
      </section>
    </>
  );
}

function Services({ apiFetch, onNotify, skin }: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  skin: ServiceSkinConfig;
}) {
  const loader = useCallback(() => apiFetch<Svc[]>('/service/services'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    try {
      await apiFetch('/service/services', { method: 'POST', body: JSON.stringify({ name: f.get('name'), category: f.get('category'), unit: f.get('unit'), price: Number(f.get('price')) }) });
      onNotify('Layanan disimpan.'); safeResetForm(formEl); reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };
  return (
    <>
      <section className="panel"><h2>{skin.pageTitles.services || 'Tambah Layanan'}</h2>
        <form className="form" onSubmit={submit}>
          <input name="name" placeholder="Nama layanan" required /><input name="category" placeholder="Kategori" />
          <input name="unit" placeholder="Satuan" defaultValue="unit" /><input name="price" type="number" placeholder="Harga" required />
          <button type="submit">Simpan</button>
        </form>
      </section>
      <section className="panel"><h2>Katalog Layanan</h2>
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!(data || []).length} emptyMessage={skin.emptyStates.services || 'Belum ada layanan.'}>
          <div className="table">{(data || []).map((s) => (
            <div className="tr" key={s.id}><span><b>{s.name}</b></span><span>{s.category}</span><span>{money(Number(s.price))} / {s.unit}</span></div>
          ))}</div>
        </LoadFeedback>
      </section>
    </>
  );
}

function Quotations({ apiFetch, onNotify, skin }: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  skin: ServiceSkinConfig;
}) {
  type Qt = { id: string; number: string; customerName: string; status: string; total: number | string };
  const loader = useCallback(() => apiFetch<Qt[]>('/service/quotations'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const servicesLoader = useCallback(() => apiFetch<Svc[]>('/service/services'), [apiFetch]);
  const { data: services } = useLoad(servicesLoader);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const svc = (services || []).find((s) => s.id === f.get('serviceId'));
    if (!svc) { onNotify('Pilih layanan.'); return; }
    try {
      await apiFetch('/service/quotations', {
        method: 'POST',
        body: JSON.stringify({
          customerName: f.get('customerName'), customerPhone: f.get('phone'), serviceAddress: f.get('address'),
          discount: Number(f.get('discount') || 0), notes: f.get('notes'),
          lines: [{ description: svc.name, quantity: Number(f.get('qty') || 1), unitPrice: Number(svc.price) }],
        }),
      });
      onNotify('Penawaran dibuat.'); safeResetForm(formEl); reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };
  return (
    <>
      <section className="panel"><h2>{skin.pageTitles.quotations || 'Buat Penawaran'}</h2>
        <form className="form" onSubmit={submit}>
          <input name="customerName" placeholder="Nama pelanggan" required />
          <input name="phone" placeholder="Telepon" />
          <input name="address" placeholder="Alamat" />
          <select name="serviceId" required defaultValue="">{(services || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input name="qty" type="number" defaultValue={1} min={1} />
          <input name="discount" type="number" defaultValue={0} placeholder="Diskon" />
          <input name="notes" placeholder="Catatan survey / catatan" />
          <button type="submit">Simpan Penawaran</button>
        </form>
      </section>
      <section className="panel"><h2>{skin.navLabels.quotations || 'Daftar Penawaran'}</h2>
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!(data || []).length} emptyMessage={skin.emptyStates.quotations || 'Belum ada penawaran.'}>
          <div className="table wide">{(data || []).map((q) => (
            <div className="tr" key={q.id}>
              <span><b>{q.number}</b><br />{q.customerName}</span>
              <span><span className={`badge ${statusBadge(q.status)}`}>{statusText(q.status)}</span></span>
              <span>{money(Number(q.total))}</span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={async () => {
                  const doc = await apiFetch<{ html: string; title: string }>(`/service/documents/quotation?id=${q.id}`);
                  openPrintDocument(doc.title, doc.html);
                }}>Cetak</button>
                {!['REJECTED', 'ACCEPTED', 'EXPIRED'].includes(q.status) && (
                  <>
                    <button type="button" onClick={async () => {
                      await apiFetch(`/service/quotations/${q.id}/convert`, { method: 'POST', body: '{}' });
                      onNotify('Dikonversi ke Work Order.');
                      reload();
                    }}>Jadikan WO</button>
                    <button type="button" className="btn-secondary" onClick={async () => {
                      await apiFetch(`/service/quotations/${q.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'REJECTED' }) });
                      onNotify('Penawaran ditolak.');
                      reload();
                    }}>Tolak</button>
                  </>
                )}
              </span>
            </div>
          ))}</div>
        </LoadFeedback>
      </section>
    </>
  );
}

function Orders({ apiFetch, onNotify, mode, techMode, userName }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void; mode: string; techMode?: boolean; userName?: string }) {
  const loader = useCallback(() => apiFetch<WO[]>('/service/orders'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const servicesLoader = useCallback(() => apiFetch<Svc[]>('/service/services'), [apiFetch]);
  const { data: services } = useLoad(servicesLoader);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const svc = (services || []).find((s) => s.id === f.get('serviceId'));
    if (!svc) { onNotify('Pilih layanan.'); return; }
    try {
      await apiFetch('/service/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: f.get('customerName'), customerPhone: f.get('phone'), serviceAddress: f.get('address'),
          scheduleAt: f.get('scheduleAt') || undefined, assignedTo: f.get('assignedTo') || undefined,
          discount: Number(f.get('discount') || 0), extraCost: Number(f.get('extraCost') || 0), notes: f.get('notes'),
          lines: [{ description: svc.name, itemType: svc.category, quantity: Number(f.get('qty') || 1), unit: svc.unit, unitPrice: Number(svc.price) }],
        }),
      });
      onNotify('Pesanan dibuat.'); safeResetForm(formEl); reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };

  const printDoc = async (path: string, id: string) => {
    try {
      const doc = await apiFetch<{ html: string; title: string }>(`${path}?id=${id}`);
      openPrintDocument(doc.title, doc.html);
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal cetak'); }
  };

  const list = (data || []).filter((o) => {
    if (mode === 'schedule') return ['SCHEDULED', 'ON_THE_WAY', 'NEW'].includes(o.status);
    if (techMode && mode === 'orders') return ['SCHEDULED', 'ON_THE_WAY', 'IN_PROGRESS', 'NEW', 'COMPLETED'].includes(o.status);
    return true;
  });

  return (
    <>
      {mode === 'orders' && !techMode && (
        <section className="panel"><h2>Buat Pesanan / Work Order</h2>
          <form className="form" onSubmit={submit}>
            <input name="customerName" placeholder="Nama pelanggan" required />
            <input name="phone" placeholder="Telepon" />
            <input name="address" placeholder="Alamat layanan" className="full" />
            <select name="serviceId" required defaultValue="">{(services || []).map((s) => <option key={s.id} value={s.id}>{s.name} — {money(Number(s.price))}</option>)}</select>
            <input name="qty" type="number" defaultValue={1} min={1} placeholder="Qty" />
            <input name="scheduleAt" type="datetime-local" />
            <input name="assignedTo" placeholder="Teknisi / tim" />
            <input name="discount" type="number" placeholder="Diskon" defaultValue={0} />
            <input name="extraCost" type="number" placeholder="Biaya tambahan" defaultValue={0} />
            <input name="notes" placeholder="Catatan" />
            <button type="submit">Simpan Pesanan</button>
          </form>
        </section>
      )}
      <section className="panel"><h2>{mode === 'schedule' ? 'Jadwal kerja' : mode === 'invoice' ? 'Invoice & Pembayaran' : (techMode ? 'Pekerjaan saya' : 'Daftar Pesanan')}</h2>
        {techMode && <p className="hint">Ubah status saat berangkat, mengerjakan, dan selesai. Pembayaran dikelola admin.</p>}
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!list.length} emptyMessage="Belum ada pesanan.">
          <div className="table wide">{list.map((o) => (
            <div className="tr" key={o.id}>
              <span><b>{o.number}</b><br />{o.customerName}</span>
              <span><span className={`badge ${o.paymentStatus === 'PAID' ? 'badge-lunas' : 'badge-due'}`}>{statusText(o.status)}</span><br /><small>{payText(o.paymentStatus)}</small></span>
              <span>{money(Number(o.total))}</span>
              <span>{o.assignedTo || '-'}<br />{o.scheduleAt ? new Date(o.scheduleAt).toLocaleString('id-ID') : '-'}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {techMode ? (
                  <>
                    {o.status !== 'ON_THE_WAY' && o.status !== 'IN_PROGRESS' && o.status !== 'COMPLETED' && (
                      <button type="button" onClick={async () => { await apiFetch(`/service/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ON_THE_WAY' }) }); reload(); }}>Berangkat</button>
                    )}
                    {o.status !== 'IN_PROGRESS' && o.status !== 'COMPLETED' && (
                      <button type="button" onClick={async () => { await apiFetch(`/service/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS' }) }); reload(); }}>Kerjakan</button>
                    )}
                    {o.status !== 'COMPLETED' && (
                      <button type="button" onClick={async () => { await apiFetch(`/service/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) }); reload(); }}>Selesai</button>
                    )}
                  </>
                ) : (
                  <select defaultValue={o.status} onChange={async (e) => { await apiFetch(`/service/orders/${o.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); reload(); }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{statusText(s)}</option>)}
                  </select>
                )}
                {!techMode && (
                  <select defaultValue={o.paymentStatus} onChange={async (e) => { await apiFetch(`/service/orders/${o.id}/payment`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: e.target.value }) }); reload(); }}>
                    {PAYS.map((s) => <option key={s} value={s}>{payText(s)}</option>)}
                  </select>
                )}
                <button type="button" className="btn-secondary" onClick={() => printDoc('/service/documents/work-order', o.id)}>Cetak WO</button>
                {!techMode && (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => printDoc('/service/documents/invoice', o.id)}>Invoice</button>
                    <button type="button" className="btn-secondary" onClick={() => printDoc('/service/documents/receipt', o.id)}>Kwitansi</button>
                  </>
                )}
              </span>
            </div>
          ))}</div>
        </LoadFeedback>
      </section>
    </>
  );
}

function Members({ apiFetch, onNotify, canInvite }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void; canInvite?: boolean }) {
  const loader = useCallback(() => apiFetch<Array<{ name: string; email: string; role: string }>>('/service/members'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const [info, setInfo] = useState('');
  const invite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    try {
      const res = await apiFetch<{ members: Array<{ name: string; email: string; role: string }>; invited: { email: string; temporaryPassword: string; role: string } }>('/service/members', {
        method: 'POST',
        body: JSON.stringify({ name: f.get('name'), email: f.get('email'), role: f.get('role'), password: f.get('password') || undefined }),
      });
      setInfo(`Diundang: ${res.invited.email} · ${ROLE_LABEL[res.invited.role] || res.invited.role} · sandi: ${res.invited.temporaryPassword}`);
      onNotify('Anggota diundang.');
      safeResetForm(formEl);
      reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal mengundang'); }
  };
  return (
    <>
      {canInvite && (
        <section className="panel"><h2>Undang Tim</h2>
          <form className="form" onSubmit={invite}>
            <input name="name" placeholder="Nama" required />
            <input name="email" type="email" placeholder="Email" required />
            <select name="role" defaultValue="TECHNICIAN">
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
              <option value="TECHNICIAN">Teknisi</option>
            </select>
            <input name="password" type="password" placeholder="Kata sandi (opsional)" />
            <button type="submit">Undang</button>
          </form>
          {info && <p className="hint" style={{ marginTop: 10 }}>{info}</p>}
        </section>
      )}
      <section className="panel"><h2>Anggota Usaha</h2>
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!(data || []).length} emptyMessage="Belum ada anggota.">
          <div className="table">{(data || []).map((m) => (
            <div className="tr" key={m.email}><span><b>{m.name}</b></span><span>{m.email}</span><span>{m.role}</span></div>
          ))}</div>
        </LoadFeedback>
      </section>
    </>
  );
}

function Assets({ apiFetch, onNotify, show, readOnly, skin }: {
  apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  show: boolean;
  readOnly?: boolean;
  skin: ServiceSkinConfig;
}) {
  const loader = useCallback(() => apiFetch<Array<Record<string, unknown>>>('/service/assets'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const [history, setHistory] = useState<{ asset: Record<string, unknown>; history: Array<Record<string, unknown>> } | null>(null);
  const fl = skin.assetFieldLabels;
  if (!show) return <p className="empty-state">{skin.emptyStates.assetsOff || 'Modul unit servis tidak aktif pada konfigurasi usaha ini.'}</p>;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    try {
      await apiFetch('/service/assets', { method: 'POST', body: JSON.stringify({ locationLabel: f.get('locationLabel'), brand: f.get('brand'), acType: f.get('acType'), capacity: f.get('capacity'), serialNumber: f.get('serial') }) });
      onNotify(skin.notifyAssetSaved); reload(); safeResetForm(formEl);
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };
  return (
    <>
      {!readOnly && (
      <section className="panel"><h2>{skin.pageTitles.assets || 'Registrasi unit servis'}</h2>
        <form className="form" onSubmit={submit}>
          <input name="locationLabel" placeholder={fl.locationLabel} required />
          <input name="brand" placeholder={fl.brand} /><input name="acType" placeholder={fl.type} />
          <input name="capacity" placeholder={fl.capacity} /><input name="serial" placeholder={fl.serial} />
          <button type="submit">Simpan</button>
        </form>
      </section>
      )}
      <section className="panel"><h2>Daftar unit</h2>
        <LoadFeedback loading={loading} error={error} reload={reload} empty={!(data || []).length} emptyMessage={skin.emptyStates.assets || 'Belum ada unit terdaftar.'}>
          <div className="table wide">{(data || []).map((a) => (
            <div className="tr" key={String(a.id)}>
              <span><b>{String(a.locationLabel)}</b><br /><small>Servis terakhir: {a.lastServiceAt ? new Date(String(a.lastServiceAt)).toLocaleDateString('id-ID') : '-'}</small></span>
              <span>{String(a.brand || '-')} {String(a.acType || '')}</span>
              <span>{String(a.capacity || '-')}</span>
              <span><button type="button" className="btn-secondary" onClick={async () => {
                try {
                  const h = await apiFetch<{ asset: Record<string, unknown>; history: Array<Record<string, unknown>> }>(`/service/assets/${a.id}/history`);
                  setHistory(h);
                } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal memuat riwayat'); }
              }}>Riwayat</button></span>
            </div>
          ))}</div>
        </LoadFeedback>
      </section>
      {history && (
        <section className="panel">
          <h2>Riwayat servis — {String(history.asset.locationLabel)}</h2>
          <button type="button" className="btn-secondary" onClick={() => setHistory(null)}>Tutup</button>
          <div className="table" style={{ marginTop: 10 }}>
            {(history.history || []).map((o) => (
              <div className="tr" key={String(o.id)}>
                <span><b>{String(o.number)}</b></span>
                <span>{statusText(String(o.status))}</span>
                <span>{o.createdAt ? new Date(String(o.createdAt)).toLocaleString('id-ID') : '-'}</span>
                <span>{money(Number(o.total || 0))}</span>
              </div>
            ))}
            {!history.history?.length && <p className="empty-state">Belum ada riwayat servis.</p>}
          </div>
        </section>
      )}
    </>
  );
}

function Finance({ apiFetch }: { apiFetch: <T>(p: string) => Promise<T> }) {
  const loader = useCallback(() => apiFetch<Record<string, unknown>>('/service/finance'), [apiFetch]);
  const reportLoader = useCallback(() => apiFetch<Record<string, unknown>>('/service/reports'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const { data: report, loading: reportLoading, error: reportError, reload: reloadReport } = useLoad(reportLoader);
  if (loading || reportLoading) return <p className="empty-state">Memuat keuangan…</p>;
  if (error || reportError || !data) {
    return (
      <p className="empty-state danger">
        {error || reportError || 'Data keuangan tidak tersedia.'}{' '}
        <button type="button" className="linkish" onClick={() => { void reload(); void reloadReport(); }}>Coba lagi</button>
      </p>
    );
  }
  return (
    <>
      <section className="metrics">
        <article className="metric"><span>Pendapatan</span><strong>{money(Number(data.revenue))}</strong></article>
        <article className="metric"><span>Pengeluaran</span><strong>{money(Number(data.expenses))}</strong></article>
        <article className="metric"><span>Laba kotor</span><strong>{money(Number(data.grossProfit))}</strong></article>
        <article className="metric"><span>Kas</span><strong>{money(Number(data.cashBalance))}</strong></article>
      </section>
      <section className="panel"><h2>Rekap periode</h2>
        <p className="hint">Order: {String(report?.orderCount ?? '-')} · Pendapatan: {money(Number(report?.revenue || 0))} · Pengeluaran: {money(Number(report?.expenses || 0))}</p>
      </section>
    </>
  );
}

function FinanceOps({ page, apiFetch, onNotify }: { page: string; apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void }) {
  if (page === 'piutang') {
    return <Finance apiFetch={apiFetch} />;
  }
  const account = page === 'bank' ? 'BANK' : 'CASH';
  const loader = useCallback(() => apiFetch<Array<{ id: string; description: string; amount: number; direction: string; account?: string; date: string }>>('/erp/cash'), [apiFetch]);
  const { data, reload } = useLoad(loader);
  const rows = (data || []).filter((c) => (c.account || 'CASH') === account || page === 'pengeluaran');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    try {
      await apiFetch('/erp/cash', {
        method: 'POST',
        body: JSON.stringify({
          category: f.get('category'), description: f.get('description'), amount: Number(f.get('amount')),
          direction: page === 'pengeluaran' ? 'OUT' : 'IN',
          account: page === 'pengeluaran' ? (f.get('account') || 'CASH') : account,
        }),
      });
      onNotify('Entri kas disimpan.'); safeResetForm(formEl); reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
  };
  return (
    <section className="panel">
      <h2>{page === 'pengeluaran' ? 'Catat Pengeluaran' : page === 'bank' ? 'Bank Masuk' : 'Kas Masuk'}</h2>
      <form className="form" onSubmit={submit}>
        <input name="category" placeholder="Kategori" required />
        <input name="description" placeholder="Keterangan" required />
        <input name="amount" type="number" placeholder="Jumlah" required />
        {page === 'pengeluaran' && (
          <select name="account" defaultValue="CASH"><option value="CASH">Kas</option><option value="BANK">Bank</option></select>
        )}
        <button type="submit">Simpan</button>
      </form>
      <div className="table" style={{ marginTop: 16 }}>
        {rows.slice(0, 20).map((c) => (
          <div className="tr" key={c.id}>
            <span>{new Date(c.date).toLocaleDateString('id-ID')}</span>
            <span>{c.description}</span>
            <span>{c.direction}</span>
            <span>{money(Number(c.amount))}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WsSettings({ apiFetch, onNotify }: { apiFetch: <T>(p: string, i?: RequestInit) => Promise<T>; onNotify: (m: string) => void }) {
  const loader = useCallback(() => apiFetch<{ name: string; phone?: string; address?: string; code?: string }>('/erp/settings'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  if (loading || !data) return <p className="empty-state">Memuat pengaturan…</p>;
  return (
    <section className="panel">
      <h2>Pengaturan Workspace</h2>
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await apiFetch('/erp/settings', {
            method: 'PATCH',
            body: JSON.stringify({ name: f.get('name'), phone: f.get('phone'), address: f.get('address') }),
          });
          onNotify('Pengaturan disimpan.');
          reload();
        } catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal'); }
      }}>
        <input name="name" defaultValue={data.name} required />
        <input name="phone" defaultValue={data.phone || ''} placeholder="Telepon" />
        <input name="address" defaultValue={data.address || ''} placeholder="Alamat" />
        <button type="submit">Simpan</button>
      </form>
    </section>
  );
}

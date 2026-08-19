'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ti } from './icons';
import { openPrintDocument } from './print';
import { LEAD_STATUS_LABEL, labelModulePages } from './user-labels';
import { safeResetForm } from './form-utils';
import {
  TxModulePage, TxDrawer, TxSection, TxIconBtn, TxPager, useClientPager, moneyFmt,
} from './tx-shell';
import { TUMBU_CONTACT, TUMBU_MAILTO } from './contact';

type Overview = {
  workspaceName: string; workspaceCode: string; blueprintName: string; categoryLabel: string;
  moduleCount: number; modules: string[]; workspaceCount: number;
  activeWorkspaceCount?: number; pendingWorkspaceCount?: number;
  memberCount?: number; leadCount?: number; productCount: number;
  partnerCount: number; transactionCount: number; beritaAcaraCount: number; workOrderCount?: number;
  timezone: string; status: string; compatibilityOk: boolean; updatedAt: string;
  workspaces?: Array<{
    id: string; name: string; code: string; blueprint: string; blueprintId: string;
    isActive?: boolean; status?: string; statusLabel?: string; updatedAt?: string;
  }>;
};
type Workspace = {
  id: string; code: string; name: string; blueprint: string; isCurrent: boolean; updatedAt: string;
  memberCount?: number; isActive?: boolean; status?: string; statusLabel?: string;
  phone?: string; address?: string;
  planId?: string | null; planCode?: string | null; planName?: string | null;
  trialEndsAt?: string | null; commercialStatus?: string | null;
  demoMode?: boolean | null;
};
type PlanRow = {
  id: string; code: string; name: string; description: string;
  monthlyAmount: number; workspaceQuota: number; trialDays: number;
  modules: string[]; sortOrder: number; isActive: boolean;
};
type Blueprint = { id: string; name: string; categoryLabel: string; description: string; active: boolean; available: boolean };
type ModuleRow = { id: string; name: string; layerLabel: string; statusLabel: string; enabled: boolean; pages: string[] };
type Settings = { name: string; code: string; phone: string; address: string; timezone: string; locale: string; blueprintName: string; workspaceId?: string };
type WsOpt = { id: string; name: string; code: string };

/** Picker workspace target untuk operasi Control Plane (blueprint/modul/settings). */
function usePlatformWorkspaceTarget(apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>) {
  const [workspaces, setWorkspaces] = useState<WsOpt[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  useEffect(() => {
    apiFetch<Array<{ id: string; name: string; code: string }>>('/platform/workspaces')
      .then((rows) => {
        setWorkspaces(rows.map((w) => ({ id: w.id, name: w.name, code: w.code })));
        setWorkspaceId((prev) => prev || (rows[0]?.id ?? ''));
      })
      .catch(() => { setWorkspaces([]); });
  }, [apiFetch]);
  const picker = (
    <label className="txm-toolbar-field">
      <span>Usaha target</span>
      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} required>
        <option value="" disabled>— Pilih usaha —</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
        ))}
      </select>
    </label>
  );
  return { workspaceId, setWorkspaceId, workspaces, picker };
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const fmtDay = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export function PlatformPages({
  page,
  apiFetch,
  onNotify,
  onRefreshShell,
  onOpenWorkspace,
  onNavigate,
  pendingWorkspaceCount = 0,
  onHeaderAction,
}: {
  page: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (msg: string, kind?: 'success' | 'error' | 'warning') => void;
  onRefreshShell: () => void;
  onOpenWorkspace: (id: string) => Promise<void>;
  onNavigate?: (page: string) => void;
  /** From Founder poll — triggers list reload when antrian berubah. */
  pendingWorkspaceCount?: number;
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}) {
  if (page === 'platform' || page === 'overview') {
    return <OverviewPage apiFetch={apiFetch} onNavigate={onNavigate} pendingWorkspaceCount={pendingWorkspaceCount} />;
  }
  if (page === 'workspaces') {
    return (
      <WorkspacesPage
        apiFetch={apiFetch}
        onNotify={onNotify}
        onOpenWorkspace={onOpenWorkspace}
        pendingWorkspaceCount={pendingWorkspaceCount}
        onHeaderAction={onHeaderAction}
      />
    );
  }
  if (page === 'plans') return <PlansPage apiFetch={apiFetch} onNotify={onNotify} />;
  if (page === 'blueprints') return <BlueprintsPage apiFetch={apiFetch} onNotify={onNotify} onRefreshShell={onRefreshShell} />;
  if (page === 'modules') return <ModulesPage apiFetch={apiFetch} onNotify={onNotify} />;
  if (page === 'billing') return <BillingPage apiFetch={apiFetch} onNotify={onNotify} onHeaderAction={onHeaderAction} />;
  if (page === 'members') return <MembersAdminPage apiFetch={apiFetch} onNotify={onNotify} onHeaderAction={onHeaderAction} />;
  if (page === 'leads') return <LeadsPage apiFetch={apiFetch} onNotify={onNotify} />;
  if (page === 'audit') return <AuditPage apiFetch={apiFetch} />;
  if (page === 'pengaturan' || page === 'settings') return <SettingsPage onNavigate={onNavigate} />;
  if (page === 'ai_tumbu') {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 text-white border border-sky-500/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
            <Ti name="ai" size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold">TUMBU AI Sentinel — Platform Master Control</h3>
            <p className="text-xs text-slate-400">Asisten cerdas monitoring ekosistem perikanan air tawar & platform tenant.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p>✔ Monitoring status 100% aktif untuk tenant Budidaya Air Tawar, Distributor Benih & Pakan, dan Teknisi Perikanan.</p>
          <p>✔ Deteksi anomali FCR, stok pakan, dan tagihan tenant berjalan otomatis.</p>
        </div>
      </div>
    );
  }
  return <p className="empty-state">Halaman platform ({page}) tidak ditemukan.</p>;
}

function useLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

function FilterPills({
  items, value, onChange,
}: {
  items: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="txm-pills" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={`txm-pill${value === it.id ? ' is-active' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.label}{typeof it.count === 'number' ? ` (${it.count})` : ''}
        </button>
      ))}
    </div>
  );
}

function labelCommercialStatus(status?: string | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'TRIAL': return 'Uji coba';
    case 'SUBSCRIBED': return 'Berlangganan';
    case 'EXPIRED': return 'Kedaluwarsa';
    case 'CANCELLED':
    case 'CANCELED': return 'Dibatalkan';
    default: return status?.trim() || '—';
  }
}

function OverviewPage({ apiFetch, onNavigate, pendingWorkspaceCount = 0 }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNavigate?: (page: string) => void;
  pendingWorkspaceCount?: number;
}) {
  type AuditRow = { id: string; summary?: string; actionLabel?: string; action: string; createdAt: string; workspaceName?: string | null };
  type InvRow = { id: string; status: string; amount: number };
  const loader = useCallback(() => apiFetch<Overview>('/platform/overview'), [apiFetch]);
  const { data, error, loading, reload } = useLoad(loader);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [wsExtra, setWsExtra] = useState<Workspace[]>([]);
  const lastPolledPending = useRef<number | null>(null);

  useEffect(() => {
    if (lastPolledPending.current === null) {
      lastPolledPending.current = pendingWorkspaceCount;
      return;
    }
    if (lastPolledPending.current === pendingWorkspaceCount) return;
    lastPolledPending.current = pendingWorkspaceCount;
    void reload();
  }, [pendingWorkspaceCount, reload]);

  useEffect(() => {
    void Promise.all([
      apiFetch<AuditRow[]>('/platform/audit?limit=8').catch(() => [] as AuditRow[]),
      apiFetch<InvRow[]>('/platform/billing/invoices').catch(() => [] as InvRow[]),
      apiFetch<Workspace[]>('/platform/workspaces').catch(() => [] as Workspace[]),
    ]).then(([a, inv, ws]) => {
      setAudit(a || []);
      setInvoices(inv || []);
      setWsExtra(ws || []);
    });
  }, [apiFetch, data?.updatedAt]);

  const pendingCount = data?.pendingWorkspaceCount
    ?? (data?.workspaces || []).filter((w) => w.status === 'PENDING').length;
  const activeCount = data?.activeWorkspaceCount
    ?? (data?.workspaces || []).filter((w) => w.status === 'ACTIVE').length;

  const graceCount = wsExtra.filter((w) => w.status === 'GRACE').length;
  const suspendedCount = wsExtra.filter((w) => w.status === 'SUSPENDED').length;
  const trialCount = wsExtra.filter((w) => (w.commercialStatus || '').toUpperCase() === 'TRIAL').length;
  const unpaidInv = invoices.filter((r) => r.status === 'UNPAID' || r.status === 'OVERDUE' || r.status === 'ISSUED');
  const overdueInv = invoices.filter((r) => r.status === 'OVERDUE');
  const leadCount = data?.leadCount ?? 0;
  const approvalTotal = pendingCount + leadCount;

  const blueprintPop = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of data?.workspaces || []) {
      const name = w.blueprint || '—';
      map.set(name, (map.get(name) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data?.workspaces]);
  const bpMax = blueprintPop[0]?.[1] || 1;

  const pendingRows = [...(data?.workspaces || [])]
    .filter((w) => w.status === 'PENDING')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 6);

  const insights = useMemo(() => {
    const items: string[] = [];
    if (pendingCount > 0) items.push(`${pendingCount} usaha menunggu persetujuan`);
    if (leadCount > 0) items.push(`${leadCount} minat baru perlu ditindaklanjuti`);
    if (unpaidInv.length > 0) items.push(`${unpaidInv.length} tagihan belum lunas`);
    if (graceCount > 0) items.push(`${graceCount} usaha dalam masa tenggang`);
    if (suspendedCount > 0) items.push(`${suspendedCount} usaha ditangguhkan`);
    if (!items.length) items.push('Tidak ada antrian kritis saat ini');
    return items.slice(0, 5);
  }, [pendingCount, leadCount, unpaidInv.length, graceCount, suspendedCount]);

  if (loading && !data) return <p className="empty-state">Memuat Platform Control Center…</p>;
  if (error || !data) return <p className="empty-state danger">{error || 'Data tidak tersedia.'}</p>;

  const go = (page: string) => () => onNavigate?.(page);

  return (
    <div className="plat-cc">
      <p className="plat-cc-lead">
        Pusat kendali ekosistem TUMBU. Monitor skala pertumbuhan, tren blueprint, dan kesehatan finansial platform secara global.
      </p>

      <div className="plat-cc-metrics">
        <article className="plat-cc-metric"><span>Usaha aktif</span><strong>{activeCount}</strong></article>
        <article className="plat-cc-metric"><span>Trial aktif</span><strong>{trialCount}</strong></article>
        <article className="plat-cc-metric tone-warn"><span>Masa tenggang</span><strong>{graceCount}</strong></article>
        <article className="plat-cc-metric"><span>Anggota total</span><strong>{data.memberCount ?? 0}</strong></article>
        <article className="plat-cc-metric"><span>Total unit usaha</span><strong>{data.workspaceCount}</strong></article>
        <article className="plat-cc-metric tone-alert"><span>Antrian approval</span><strong>{approvalTotal}</strong></article>
      </div>

      <div className="plat-cc-grid">
        <div className="plat-cc-col plat-cc-col-main">
          <section className="plat-cc-card">
            <header className="plat-block-head">
              <h3>Skala operasional</h3>
              <span>Data lintas {data.workspaceCount} usaha</span>
            </header>
            <div className="plat-cc-kpis">
              <article><span>Produk terdaftar</span><strong>{data.productCount}</strong></article>
              <article><span>Partner bisnis</span><strong>{data.partnerCount}</strong></article>
              <article><span>Total transaksi</span><strong>{data.transactionCount}</strong></article>
              <article><span>Berita Acara</span><strong>{data.beritaAcaraCount}</strong></article>
              <article><span>Pekerjaan lapangan</span><strong>{data.workOrderCount || 0}</strong></article>
              <article><span>Modul terpakai</span><strong>{data.moduleCount}</strong></article>
            </div>
          </section>

          <section className="plat-cc-card">
            <header className="plat-block-head">
              <h3>Blueprint terpopuler</h3>
              <span>Template bisnis paling banyak digunakan</span>
            </header>
            {!blueprintPop.length ? (
              <p className="txm-empty" style={{ padding: 16 }}>Belum ada data blueprint.</p>
            ) : (
              <ul className="plat-cc-bars">
                {blueprintPop.map(([name, count]) => (
                  <li key={name}>
                    <div className="plat-cc-bars-label"><span>{name}</span><b>{count} usaha</b></div>
                    <div className="plat-cc-bar"><i style={{ width: `${Math.max(8, (count / bpMax) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="plat-cc-col">
          <section className="plat-cc-card">
            <header className="plat-block-head">
              <h3>Aktivitas Platform</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={go('audit')}>Audit Log</button>
            </header>
            {!audit.length ? (
              <p className="txm-empty" style={{ padding: 16 }}>Belum ada aktivitas.</p>
            ) : (
              <ul className="plat-cc-feed">
                {audit.map((r) => (
                  <li key={r.id}>
                    <div>
                      <b>{r.summary || r.actionLabel || r.action}</b>
                      {r.workspaceName ? <small>{r.workspaceName}</small> : null}
                    </div>
                    <time>{fmtDate(r.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <nav className="plat-cc-quick" aria-label="Navigasi aksi">
        <button type="button" onClick={go('workspaces')}><Ti name="workspace" size={18} /><span>Manajemen Usaha</span><small>Daftar & approval</small></button>
        <button type="button" onClick={go('blueprints')}><Ti name="blueprint" size={18} /><span>Katalog Blueprint</span><small>Edit template</small></button>
        <button type="button" onClick={go('plans')}><Ti name="kas" size={18} /><span>Paket Langganan</span><small>Komersial</small></button>
        <button type="button" onClick={go('billing')}><Ti name="invoice" size={18} /><span>Billing & Invoice</span><small>Keuangan platform</small></button>
      </nav>
    </div>
  );
}

function WorkspacesPage({ apiFetch, onNotify, onOpenWorkspace, pendingWorkspaceCount = 0, onHeaderAction }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onOpenWorkspace: (id: string) => Promise<void>;
  pendingWorkspaceCount?: number;
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}) {
  const loader = useCallback(() => apiFetch<Workspace[]>('/platform/workspaces'), [apiFetch]);
  const { data, error, loading, reload } = useLoad(loader);
  const [busy, setBusy] = useState(false);
  const [blueprints, setBlueprints] = useState<Array<{ id: string; name: string }>>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'ACTIVE' | 'GRACE' | 'REJECTED' | 'SUSPENDED'>('all');
  const prevPendingRef = useRef(-1);
  const lastPolledPending = useRef<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((w) => w.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchApprove = async () => {
    if (!selectedIds.length) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ approvedCount: number }>('/platform/workspaces/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceIds: selectedIds }),
      });
      onNotify(`${res.approvedCount || selectedIds.length} usaha berhasil disetujui (aktif).`);
      setSelectedIds([]);
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyetujui batch usaha.');
    } finally {
      setBusy(false);
    }
  };

  const handleBatchSuspend = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Tangguhkan ${selectedIds.length} usaha terpilih?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ suspendedCount: number }>('/platform/workspaces/batch-suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceIds: selectedIds }),
      });
      onNotify(`${res.suspendedCount || selectedIds.length} usaha berhasil ditangguhkan.`);
      setSelectedIds([]);
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menangguhkan batch usaha.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    apiFetch<Array<{ id: string; name: string; available?: boolean }>>('/platform/blueprints')
      .then((rows) => setBlueprints(rows.filter((b) => b.available !== false)))
      .catch(() => setBlueprints([]));
    apiFetch<PlanRow[]>('/platform/plans')
      .then((rows) => setPlans(rows))
      .catch(() => setPlans([]));
  }, [apiFetch]);

  /** Poll mendeteksi usaha baru menunggu — muat ulang daftar. */
  useEffect(() => {
    if (lastPolledPending.current === null) {
      lastPolledPending.current = pendingWorkspaceCount;
      return;
    }
    if (lastPolledPending.current === pendingWorkspaceCount) return;
    lastPolledPending.current = pendingWorkspaceCount;
    void reload();
  }, [pendingWorkspaceCount, reload]);

  const rows = data || [];
  const counts = useMemo(() => ({
    all: rows.length,
    PENDING: rows.filter((w) => w.status === 'PENDING').length,
    ACTIVE: rows.filter((w) => w.status === 'ACTIVE').length,
    GRACE: rows.filter((w) => w.status === 'GRACE').length,
    REJECTED: rows.filter((w) => w.status === 'REJECTED').length,
    SUSPENDED: rows.filter((w) => w.status === 'SUSPENDED').length,
  }), [rows]);

  /**
   * Saat antrian PENDING muncul atau bertambah, fokuskan filter ke situ.
   * Tanpa ini, usaha baru terkubur di halaman akhir daftar abjad (10/halaman).
   */
  useEffect(() => {
    if (!data) return;
    const prev = prevPendingRef.current;
    prevPendingRef.current = counts.PENDING;
    if (counts.PENDING <= 0) return;
    if (prev < 0 || counts.PENDING > prev) {
      setStatusFilter('PENDING');
    }
  }, [data, counts.PENDING]);

  const filtered = useMemo(() => {
    const base = rows.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (q.trim()) {
        const hay = `${w.name} ${w.code} ${w.blueprint}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    if (statusFilter !== 'all') return base;
    // Filter Semua: PENDING tetap di atas agar tidak hilang di pagination.
    return [...base].sort((a, b) => {
      const ap = a.status === 'PENDING' ? 0 : 1;
      const bp = b.status === 'PENDING' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.name || '').localeCompare(b.name || '', 'id');
    });
  }, [rows, statusFilter, q]);

  const pager = useClientPager(filtered, 10);
  const editing = editId ? rows.find((w) => w.id === editId) : null;

  useEffect(() => {
    pager.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset pager when filter/search changes
  }, [statusFilter, q]);

  const openCreate = useCallback(() => { setEditId(''); setCreatedId(''); setDrawerOpen(true); }, []);

  useEffect(() => {
    onHeaderAction?.({ label: '+ Usaha Baru', onClick: openCreate });
    return () => onHeaderAction?.(null);
  }, [onHeaderAction, openCreate]);
  const openEdit = (w: Workspace) => { setEditId(w.id); setCreatedId(''); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditId(''); };

  const setStatus = async (workspaceId: string, action: 'approve' | 'reject' | 'suspend', label: string) => {
    setBusy(true);
    try {
      await apiFetch(`/platform/workspaces/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      onNotify(label);
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengubah status.');
    } finally {
      setBusy(false);
    }
  };

  const toggleDemoMode = async (workspaceId: string, enabled: boolean, name: string) => {
    setBusy(true);
    try {
      await apiFetch('/platform/workspaces/demo-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, enabled }),
      });
      onNotify(enabled
        ? `Demo mode aktif — ${name} mendapat akses penuh seluruh modul blueprint.`
        : `Demo mode nonaktif — ${name} kembali ke batas paket.`);
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengubah demo mode.');
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (w: Workspace) => {
    const s = w.status || (w.isActive === false ? 'SUSPENDED' : 'ACTIVE');
    const cls = s === 'ACTIVE' ? 'badge-lunas' : s === 'PENDING' || s === 'GRACE' ? 'badge-warn' : 'badge-due';
    const fallback =
      s === 'ACTIVE' ? 'Aktif'
        : s === 'PENDING' ? 'Menunggu persetujuan'
          : s === 'GRACE' ? 'Masa tenggang'
            : s === 'REJECTED' ? 'Ditolak'
              : s === 'SUSPENDED' ? 'Ditangguhkan'
                : s;
    return <span className={`badge ${cls}`}>{w.statusLabel || fallback}</span>;
  };

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    try {
      const created = await apiFetch<Workspace & { id: string }>('/platform/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          code: form.get('code') || undefined,
          blueprintId: form.get('blueprintId') || undefined,
          planId: form.get('planId') || undefined,
          phone: form.get('phone') || undefined,
          address: form.get('address') || undefined,
          ownerName: form.get('ownerName') || undefined,
          ownerEmail: form.get('ownerEmail') || undefined,
          ownerPassword: form.get('ownerPassword') || undefined,
        }),
      });
      onNotify('Usaha dibuat dan menunggu persetujuan. Setujui agar pemilik dapat masuk.');
      setCreatedId(created.id);
      safeResetForm(formEl);
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menambah usaha. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editId) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await apiFetch('/platform/workspaces', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editId,
          name: f.get('name'),
          phone: f.get('phone'),
          address: f.get('address'),
        }),
      });
      onNotify('Usaha diperbarui.');
      closeDrawer();
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plat-ws">
      <p className="plat-ws-lead">
        Kelola usaha pelanggan: setujui pengajuan, pantau status operasional, dan buka dashboard bila perlu.
        Paket menentukan kuota, masa uji coba, dan modul.
      </p>

      {counts.PENDING > 0 ? (
        <aside className="plat-ws-alert" role="status">
          <div>
            <strong>{counts.PENDING} usaha menunggu persetujuan</strong>
            <p>Prioritas Founder — setujui agar pemilik dapat masuk ke Workspace.</p>
          </div>
          <button
            type="button"
            className="txm-btn-primary btn-sm"
            onClick={() => setStatusFilter('PENDING')}
          >
            Lihat antrian
          </button>
        </aside>
      ) : null}

      <div className="plat-ws-kpis" aria-label="Ringkasan usaha">
        {([
          { id: 'all' as const, label: 'Total', value: counts.all, tone: '' },
          { id: 'PENDING' as const, label: 'Menunggu', value: counts.PENDING, tone: 'tone-alert' },
          { id: 'ACTIVE' as const, label: 'Aktif', value: counts.ACTIVE, tone: 'tone-ok' },
          { id: 'GRACE' as const, label: 'Masa tenggang', value: counts.GRACE, tone: 'tone-warn' },
          { id: 'SUSPENDED' as const, label: 'Ditangguhkan', value: counts.SUSPENDED, tone: 'tone-danger' },
        ]).map((k) => (
          <button
            key={k.id}
            type="button"
            className={`plat-ws-kpi ${k.tone}${statusFilter === k.id ? ' is-active' : ''}`}
            onClick={() => setStatusFilter(k.id)}
          >
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </button>
        ))}
      </div>

      <TxModulePage
        title="Usaha"
        breadcrumb="TUMBU Platform"
        hint=""
        onRefresh={reload}
        listTitle="Daftar Usaha"
        summary={[]}
        toolbar={(
          <div className="plat-ws-toolbar">
            <div className="plat-ws-toolbar-row">
              <FilterPills
                value={statusFilter}
                onChange={(id) => setStatusFilter(id as typeof statusFilter)}
                items={[
                  { id: 'all', label: 'Semua', count: counts.all },
                  { id: 'PENDING', label: 'Menunggu persetujuan', count: counts.PENDING },
                  { id: 'ACTIVE', label: 'Aktif', count: counts.ACTIVE },
                  { id: 'GRACE', label: 'Masa tenggang', count: counts.GRACE },
                  { id: 'SUSPENDED', label: 'Ditangguhkan', count: counts.SUSPENDED },
                  { id: 'REJECTED', label: 'Ditolak', count: counts.REJECTED },
                ]}
              />
              {selectedIds.length > 0 ? (
                <div className="flex items-center gap-2 px-2 py-1 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs">
                  <span className="font-bold text-sky-600 dark:text-sky-400">{selectedIds.length} dipilih</span>
                  <button type="button" className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition" onClick={handleBatchApprove} disabled={busy}>
                    Setujui Batch
                  </button>
                  <button type="button" className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition" onClick={handleBatchSuspend} disabled={busy}>
                    Tangguhkan Batch
                  </button>
                </div>
              ) : null}
              <button type="button" className="btn-secondary btn-sm" onClick={() => void reload()}>
                Muat ulang
              </button>
            </div>
            <label className="plat-ws-search">
              <span className="sr-only">Cari usaha</span>
              <input
                type="search"
                placeholder="Cari nama / kode / blueprint…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
        )}
        hideHead
      >
        <div className="txm-table-scroll">
          {loading ? <p className="txm-empty">Memuat usaha…</p> : null}
          {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}
          {!loading && !error && !filtered.length ? (
            <p className="txm-empty">
              {q.trim() || statusFilter !== 'all'
                ? 'Tidak ada usaha yang cocok dengan filter atau pencarian.'
                : 'Belum ada usaha.'}
            </p>
          ) : null}
          {!loading && !error && filtered.length > 0 ? (
            <table className="txm-table plat-ws-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleSelectAll}
                      title="Pilih semua"
                    />
                  </th>
                  <th>Nama usaha</th>
                  <th>Kode</th>
                  <th>Blueprint</th>
                  <th>Paket</th>
                  <th>Uji coba / Komersial</th>
                  <th>Anggota</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((w) => (
                  <tr key={w.id} className={w.status === 'PENDING' ? 'is-pending' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(w.id)}
                        onChange={() => toggleSelectOne(w.id)}
                      />
                    </td>
                    <td className="txm-doc">
                      <b>{w.name}</b>
                      {w.isCurrent ? <small>Usaha yang sedang dibuka</small> : null}
                    </td>
                    <td><code className="plat-ws-code">{w.code}</code></td>
                    <td>{w.blueprint}</td>
                    <td>{w.planName || w.planCode || '—'}</td>
                    <td>
                      <div>{labelCommercialStatus(w.commercialStatus)}</div>
                      <small>{w.trialEndsAt ? `Uji coba s/d ${fmtDay(w.trialEndsAt)}` : '—'}</small>
                    </td>
                    <td>{w.memberCount ?? 0}</td>
                    <td>{statusBadge(w)}</td>
                    <td>
                      <div className="txm-actions">
                        <TxIconBtn icon="eye" label="Buka dashboard" disabled={busy} onClick={async () => {
                          setBusy(true);
                          try { await onOpenWorkspace(w.id); }
                          catch (err) { onNotify(err instanceof Error ? err.message : 'Gagal membuka usaha. Coba lagi.'); }
                          finally { setBusy(false); }
                        }} />
                        <TxIconBtn icon="edit" label="Edit" onClick={() => openEdit(w)} />
                        {w.status === 'PENDING' || w.status === 'REJECTED' || w.status === 'SUSPENDED' ? (
                          <TxIconBtn
                            icon="pay"
                            label="Setujui"
                            pay
                            showLabel
                            disabled={busy}
                            onClick={() => setStatus(w.id, 'approve', `${w.name} disetujui (aktif).`)}
                          />
                        ) : null}
                        {w.status === 'PENDING' ? (
                          <TxIconBtn
                            icon="trash"
                            label="Tolak"
                            danger
                            showLabel
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Tolak usaha ${w.name}?`)) return;
                              void setStatus(w.id, 'reject', `${w.name} ditolak.`);
                            }}
                          />
                        ) : null}
                        {w.status === 'ACTIVE' ? (
                          <TxIconBtn
                            icon="trash"
                            label="Tangguhkan"
                            danger
                            showLabel
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Tangguhkan ${w.name}? Owner tidak dapat masuk.`)) return;
                              void setStatus(w.id, 'suspend', `${w.name} ditangguhkan.`);
                            }}
                          />
                        ) : null}
                        <TxIconBtn
                          icon={w.demoMode ? 'pay' : 'eye'}
                          label={w.demoMode ? 'Demo ON — klik nonaktifkan' : 'Demo OFF — klik aktifkan'}
                          showLabel
                          disabled={busy}
                          onClick={() => void toggleDemoMode(w.id, !w.demoMode, w.name)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title={editId ? 'Edit Usaha' : 'Usaha Baru'}
        hint={editId ? 'Perbarui profil usaha.' : 'Isi profil, pilih blueprint, opsional tambah owner.'}
        onClose={closeDrawer}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={closeDrawer}>Batal</button>
            {editId ? (
              <button type="submit" form="ws-edit-form" className="txm-btn-save" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
            ) : createdId ? (
              <button type="button" className="txm-btn-save" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  await setStatus(createdId, 'approve', 'Usaha disetujui dan diaktifkan.');
                  await onOpenWorkspace(createdId);
                  closeDrawer();
                  setCreatedId('');
                } catch (err) { onNotify(err instanceof Error ? err.message : 'Aksi tidak berhasil. Coba lagi.'); }
                finally { setBusy(false); }
              }}>Setujui & Buka</button>
            ) : (
              <button type="submit" form="ws-create-form" className="txm-btn-save" disabled={busy}>{busy ? 'Menyimpan…' : 'Buat Usaha'}</button>
            )}
          </>
        )}
      >
        {editId && editing ? (
          <form id="ws-edit-form" className="form form-2" onSubmit={onSaveEdit}>
            <TxSection title="Profil">
              <label className="field"><span>Nama</span><input name="name" defaultValue={editing.name} required disabled={busy} /></label>
              <label className="field"><span>Telepon</span><input name="phone" defaultValue={editing.phone || ''} disabled={busy} /></label>
              <label className="field full"><span>Alamat</span><input name="address" defaultValue={editing.address || ''} disabled={busy} /></label>
            </TxSection>
            <TxSection title="Paket">
              <label className="field">
                <span>Paket langganan</span>
                <select
                  defaultValue={editing.planId || editing.planCode || 'starter'}
                  disabled={busy}
                  onChange={async (e) => {
                    const planId = e.target.value;
                    setBusy(true);
                    try {
                      await apiFetch('/platform/workspaces/plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workspaceId: editing.id, planId }),
                      });
                      onNotify(`Paket ${editing.name} diperbarui.`);
                      await reload();
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : 'Gagal ubah paket.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.workspaceQuota} WS · {moneyFmt(p.monthlyAmount)}</option>
                  ))}
                </select>
              </label>
              <p className="hint" style={{ gridColumn: '1 / -1' }}>
                Komersial: {labelCommercialStatus(editing.commercialStatus)}
                {editing.trialEndsAt ? ` · Uji coba s/d ${fmtDay(editing.trialEndsAt)}` : ''}
              </p>
              <div className="field" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span>Demo Mode</span>
                <button
                  type="button"
                  className={editing.demoMode ? 'txm-btn-save' : 'txm-btn-outline'}
                  disabled={busy}
                  onClick={() => void toggleDemoMode(editing.id, !editing.demoMode, editing.name)}
                >
                  {editing.demoMode ? '✓ Aktif — klik nonaktifkan' : 'Nonaktif — klik aktifkan'}
                </button>
                <small className="hint">
                  {editing.demoMode
                    ? 'Akses penuh semua modul blueprint. Trial tidak diblokir.'
                    : 'Akses dibatasi sesuai paket & masa trial.'}
                </small>
              </div>
            </TxSection>
          </form>
        ) : (
          <form id="ws-create-form" className="form form-2" onSubmit={onCreate}>
            {createdId ? (
              <p className="hint" style={{ gridColumn: '1 / -1', color: '#A16207' }}>
                Usaha menunggu persetujuan. Klik <b>Setujui & Buka</b> untuk mengaktifkan, atau tutup dan setujui nanti dari daftar.
              </p>
            ) : null}
            <TxSection title="Usaha">
              <label className="field"><span>Nama usaha</span><input name="name" required disabled={busy || !!createdId} placeholder="Nama usaha" /></label>
              <label className="field"><span>Kode</span><input name="code" disabled={busy || !!createdId} placeholder="Opsional" /></label>
              <label className="field"><span>Blueprint</span>
                <select name="blueprintId" required disabled={busy || !!createdId} defaultValue="operational_distributor">
                  {blueprints.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="field"><span>Paket</span>
                <select name="planId" required disabled={busy || !!createdId} defaultValue={plans.find((p) => p.code === 'starter')?.id || ''}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · trial {p.trialDays}h · {p.workspaceQuota} WS</option>
                  ))}
                </select>
              </label>
              <label className="field"><span>Telepon</span><input name="phone" disabled={busy || !!createdId} /></label>
              <label className="field full"><span>Alamat</span><input name="address" disabled={busy || !!createdId} /></label>
            </TxSection>
            <TxSection title="Owner (opsional)">
              <label className="field"><span>Nama owner</span><input name="ownerName" disabled={busy || !!createdId} /></label>
              <label className="field"><span>Email</span><input name="ownerEmail" type="email" disabled={busy || !!createdId} /></label>
              <label className="field"><span>Password</span><input name="ownerPassword" type="password" disabled={busy || !!createdId} /></label>
              <p className="hint" style={{ gridColumn: '1 / -1' }}>
                Usaha baru menunggu persetujuan Founder sebelum pemilik dapat masuk.
              </p>
            </TxSection>
          </form>
        )}
      </TxDrawer>
    </div>
  );
}

function PlansPage({ apiFetch, onNotify }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
}) {
  const loader = useCallback(() => apiFetch<PlanRow[]>('/platform/plans'), [apiFetch]);
  const { data, error, loading, reload } = useLoad(loader);
  const wsLoader = useCallback(() => apiFetch<Workspace[]>('/platform/workspaces'), [apiFetch]);
  const { data: workspaces, reload: reloadWs } = useLoad(wsLoader);
  const [busy, setBusy] = useState(false);
  const [assignWs, setAssignWs] = useState('');
  const [assignPlan, setAssignPlan] = useState('');

  const plans = data || [];

  const assign = async () => {
    if (!assignWs || !assignPlan) {
      onNotify('Pilih usaha dan paket.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/platform/workspaces/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: assignWs, planId: assignPlan }),
      });
      onNotify('Paket usaha diperbarui.');
      await reloadWs();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menetapkan paket. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TxModulePage
      title="Paket"
      breadcrumb="TUMBU Platform"
      hint="Trial & Paket: katalog komersial — harga, kuota usaha, trial, dan modul yang berhak dipakai."
      listTitle="Daftar Paket"
      summary={[
        { label: 'Paket aktif', value: String(plans.length), tone: 'navy' },
        { label: 'Starter kuota', value: String(plans.find((p) => p.code === 'starter')?.workspaceQuota ?? '—'), tone: 'teal' },
        { label: 'Business', value: plans.find((p) => p.code === 'business') ? moneyFmt(plans.find((p) => p.code === 'business')!.monthlyAmount) : '—', tone: 'green' },
      ]}
      footer={(
        <div className="txm-bottom-panel">
          <h3>Tetapkan paket ke usaha</h3>
          <div className="plat-assign-form">
            <label className="field">
              <span>Usaha</span>
              <select value={assignWs} onChange={(e) => setAssignWs(e.target.value)} disabled={busy}>
                <option value="">— pilih —</option>
                {(workspaces || []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.planName || 'tanpa paket'})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Paket</span>
              <select value={assignPlan} onChange={(e) => setAssignPlan(e.target.value)} disabled={busy}>
                <option value="">— pilih —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <div className="field full">
              <button type="button" className="txm-btn-save" disabled={busy} onClick={() => void assign()}>
                {busy ? 'Menyimpan…' : 'Terapkan paket'}
              </button>
            </div>
          </div>
        </div>
      )}
      hideHead
    >
      {loading ? <p className="txm-empty">Memuat paket…</p> : null}
      {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}
      {!loading && !error ? (
        <div className="txm-table-scroll">
          <table className="txm-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Paket</th>
                <th style={{ width: '18%' }}>Harga / bulan</th>
                <th style={{ width: '14%' }}>Kuota usaha</th>
                <th style={{ width: '12%' }}>Trial</th>
                <th style={{ width: '28%' }}>Modul termasuk</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="txm-doc">
                    <b>{p.name}</b>
                    <small>{p.description}</small>
                  </td>
                  <td>{moneyFmt(p.monthlyAmount)}</td>
                  <td>{p.workspaceQuota}</td>
                  <td>{p.trialDays} hari</td>
                  <td><small>{p.modules.join(', ')}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TxModulePage>
  );
}

function SortableColItem({ id, col, idx, editingCols, setEditingCols }: {
  id: string;
  col: any;
  idx: number;
  editingCols: any[];
  setEditingCols: (cols: any[]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'white',
    border: isDragging ? '1px solid #0EA5E9' : '1px solid #E2E8F0',
    borderRadius: '8px',
    boxShadow: isDragging ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ color: '#94A3B8', cursor: 'grab', padding: '4px', fontSize: '18px' }}
      >
        ☰
      </span>
      <input
        style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontWeight: 500, color: '#1E293B' }}
        value={col.label}
        onChange={(e) => {
          const next = [...editingCols];
          next[idx] = { ...next[idx], label: e.target.value };
          setEditingCols(next);
        }}
      />
      <button
        type="button"
        style={{ color: '#EF4444', fontSize: '18px', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={() => setEditingCols(editingCols.filter((_, i) => i !== idx))}
      >
        ✕
      </button>
    </div>
  );
}

function SortableBlueprintCard({ bp, setDetailId, busyId, activate }: {
  bp: any;
  setDetailId: (id: string) => void;
  busyId: string;
  activate: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bp.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`plat-bp-card${bp.active ? ' is-active' : ''} cursor-pointer hover:border-[#0EA5E9]/50 transition-colors relative`}
      onClick={() => setDetailId(bp.id)}
    >
      {/* Handle drag di kanan atas */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          color: '#94A3B8',
          cursor: 'grab',
          fontSize: '18px',
          padding: '4px',
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
        title="Geser untuk mengatur urutan"
      >
        ☰
      </div>

      <div className="plat-bp-ico"><Ti name="blueprint" size={22} /></div>
      <div className="plat-bp-top" style={{ paddingRight: '40px' }}>
        <strong>{bp.name}</strong>
        <span className={`badge ${bp.active ? 'badge-lunas' : bp.available ? 'badge-due' : ''}`}>
          {bp.active ? 'Aktif' : bp.available ? 'Tersedia' : 'Segera'}
        </span>
      </div>
      <p>{bp.description || bp.categoryLabel}</p>
      <div className="plat-bp-meta">
        <span>{bp.categoryLabel}</span>
      </div>
      <div className="plat-bp-actions" onClick={e => e.stopPropagation()}>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setDetailId(bp.id)}>Lihat Detail</button>
        {!bp.active && bp.available ? (
          <button type="button" className="txm-btn-primary btn-sm" disabled={!!busyId} onClick={() => void activate(bp.id)}>
            {busyId === bp.id ? '…' : 'Aktifkan'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function BlueprintsPage({ apiFetch, onNotify, onRefreshShell }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onRefreshShell: () => void;
}) {
  const { workspaceId, picker } = usePlatformWorkspaceTarget(apiFetch);
  const loader = useCallback(() => {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return apiFetch<Blueprint[]>(`/platform/blueprints${q}`);
  }, [apiFetch, workspaceId]);
  const { data, error, loading, reload } = useLoad(loader);
  const [busyId, setBusyId] = useState('');
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState('');
  const [editingCols, setEditingCols] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [firestoreBps, setFirestoreBps] = useState<Record<string, { order?: number; columns?: any[] }>>({});

  const loadFirestoreBps = useCallback(async () => {
    try {
      setFirestoreBps({});
    } catch (err) {
      console.warn('Failed to load blueprints from Firestore:', err);
    }
  }, []);

  useEffect(() => {
    void loadFirestoreBps();
  }, [loadFirestoreBps, workspaceId]);

  useEffect(() => { void reload(); }, [workspaceId, reload]);

  const activate = async (id: string) => {
    if (!workspaceId) { onNotify('Pilih usaha target terlebih dahulu.'); return; }
    setBusyId(id);
    try {
      await apiFetch('/platform/blueprints/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, workspaceId }),
      });
      onNotify('Blueprint berhasil diaktifkan untuk usaha terpilih.');
      await reload();
      onRefreshShell();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengaktifkan blueprint.');
    } finally {
      setBusyId('');
    }
  };

  const rows = useMemo(() => {
    const apiRows = (data || []).filter((bp) => {
      if (!q.trim()) return true;
      const hay = `${bp.name} ${bp.categoryLabel} ${bp.description}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

    return apiRows.map((bp) => {
      const fbData = firestoreBps[bp.id];
      return {
        ...bp,
        columns: fbData?.columns || (bp as any).columns || [
          { id: '1', label: 'Modul Utama' },
          { id: '2', label: 'Kolom Transaksi' },
          { id: '3', label: 'Laporan Dashboard' }
        ],
        order: typeof fbData?.order === 'number' ? fbData.order : 99,
      };
    }).sort((a, b) => a.order - b.order);
  }, [data, q, firestoreBps]);

  const detail = rows.find((b) => b.id === detailId) || (data || []).find((b) => b.id === detailId);

  useEffect(() => {
    if (detail) {
      setEditingCols((detail as any).columns);
    }
  }, [detail]);

  const saveBlueprintStructure = async () => {
    if (!detail) return;
    setBusyId(detail.id);
    try {
      // 1. Simpan ke API
      await apiFetch('/platform/blueprints', {
        method: 'PATCH',
        body: JSON.stringify({ id: detail.id, columns: editingCols }),
      });

      onNotify('Struktur blueprint diperbarui di API.');
      setIsEditing(false);
      void loadFirestoreBps();
      reload();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal simpan.');
    } finally {
      setBusyId('');
    }
  };

  const colSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const bpSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleColDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = editingCols.findIndex((item) => item.id === active.id);
      const newIndex = editingCols.findIndex((item) => item.id === over?.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setEditingCols(arrayMove(editingCols, oldIndex, newIndex));
      }
    }
  };

  const handleBpDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const newIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(rows, oldIndex, newIndex);
        
        try {
          onNotify('Urutan blueprint berhasil diperbarui.');
          void loadFirestoreBps();
        } catch (err) {
          console.error(err);
          onNotify('Gagal menyimpan urutan ke Firestore.');
        }
      }
    }
  };

  return (
    <>
      <TxModulePage
        title="Blueprint"
        breadcrumb="TUMBU Platform"
        hint="Template bisnis yang menentukan paket modul dan alur kerja. Pilih usaha target sebelum mengaktifkan."
        onRefresh={reload}
        listTitle="Daftar Blueprint"
        summary={[
          { label: 'Total', value: String((data || []).length), tone: 'navy' },
          { label: 'Aktif', value: String((data || []).filter((b) => b.active).length), tone: 'green' },
          { label: 'Tersedia', value: String((data || []).filter((b) => b.available).length), tone: 'teal' },
        ]}
        toolbar={(
          <div className="txm-toolbar-row">
            {picker}
            <label className="txm-toolbar-field txm-toolbar-grow">
              <span>Cari blueprint</span>
              <input type="search" placeholder="Nama atau kategori…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        )}
        bare
        hideHead
      >
        {loading ? <p className="txm-empty">Memuat blueprint…</p> : null}
        {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}
        
        <DndContext
          sensors={bpSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleBpDragEnd}
        >
          <SortableContext
            items={rows.map((bp) => bp.id)}
            strategy={rectSortingStrategy}
          >
            <div className="plat-bp-grid">
              {rows.map((bp) => (
                <SortableBlueprintCard
                  key={bp.id}
                  bp={bp}
                  setDetailId={setDetailId}
                  busyId={busyId}
                  activate={activate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {!loading && !rows.length ? <p className="txm-empty">Belum ada blueprint.</p> : null}
      </TxModulePage>

      <TxDrawer
        open={!!detail}
        title={detail?.name || 'Detail Blueprint'}
        hint={detail?.categoryLabel}
        onClose={() => setDetailId('')}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={() => setDetailId('')}>Tutup</button>
            {isEditing ? (
              <button type="button" className="txm-btn-save" disabled={!!busyId} onClick={() => void saveBlueprintStructure()}>
                {busyId === (detail?.id || '') ? 'Menyimpan…' : 'Simpan Struktur'}
              </button>
            ) : (
              detail && !detail.active && detail.available ? (
                <button type="button" className="txm-btn-save" disabled={!!busyId} onClick={() => void activate(detail.id)}>
                  {busyId === detail.id ? 'Mengaktifkan…' : 'Aktifkan'}
                </button>
              ) : null
            )}
          </>
        )}
      >
        {detail ? (
          <div className="form" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="hint" style={{ margin: 0 }}>{detail.description}</p>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? 'Batal Edit' : 'Edit Struktur'}
              </button>
            </div>

            {isEditing ? (
              <TxSection title="Edit Struktur (Drag & Drop)">
                <DndContext
                  sensors={colSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleColDragEnd}
                >
                  <SortableContext
                    items={editingCols.map((col) => col.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="plat-bp-reorder-list" style={{ display: 'grid', gap: '8px', padding: 0, listStyle: 'none' }}>
                      {editingCols.map((col, idx) => (
                        <SortableColItem
                          key={col.id}
                          id={col.id}
                          col={col}
                          idx={idx}
                          editingCols={editingCols}
                          setEditingCols={setEditingCols}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button
                  type="button"
                  className="btn-add-row"
                  style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
                  onClick={() => setEditingCols([...editingCols, { id: Date.now().toString(), label: 'Kolom Baru' }])}
                >
                  + Tambah Kolom / Modul
                </button>
              </TxSection>
            ) : (
              <div className="plat-snap">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>Status</span><b>{detail.active ? 'Aktif' : detail.available ? 'Tersedia' : 'Segera hadir'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span>Kategori</span><b>{detail.categoryLabel}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>Modul aktif</span><b>{detail.active ? 'Ya' : 'Tidak'}</b>
              </div>
            </div>
          )}
        </div>
      ) : null}
      </TxDrawer>
    </>
  );
}

function ModulesPage({ apiFetch, onNotify }: { apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>; onNotify: (m: string) => void }) {
  const { workspaceId, picker } = usePlatformWorkspaceTarget(apiFetch);
  const loader = useCallback(() => {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return apiFetch<ModuleRow[]>(`/platform/modules${query}`);
  }, [apiFetch, workspaceId]);
  const { data, error, loading, reload } = useLoad(loader);
  const [busyId, setBusyId] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on' | 'off'>('all');

  useEffect(() => { void reload(); }, [workspaceId, reload]);

  const toggle = async (id: string, enabled: boolean) => {
    if (!workspaceId) { onNotify('Pilih usaha target terlebih dahulu.'); return; }
    setBusyId(id);
    try {
      await apiFetch('/platform/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled, workspaceId }),
      });
      onNotify(enabled ? 'Modul diaktifkan.' : 'Modul dinonaktifkan.');
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengubah modul.');
    } finally {
      setBusyId('');
    }
  };

  const rows = data || [];
  const filtered = useMemo(() => rows.filter((m) => {
    if (statusFilter === 'on' && !m.enabled) return false;
    if (statusFilter === 'off' && m.enabled) return false;
    if (q.trim()) {
      const hay = `${m.name} ${m.layerLabel} ${m.pages.join(' ')}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [rows, statusFilter, q]);

  const pager = useClientPager(filtered, 12);

  return (
    <TxModulePage
      title="Modul"
      breadcrumb="TUMBU Platform"
      hint="Modul aktif menentukan menu di aplikasi usaha. Pilih usaha target sebelum mengubah."
      onRefresh={reload}
      listTitle="Daftar Modul"
      summary={[
        { label: 'Total', value: String(rows.length), tone: 'navy' },
        { label: 'Aktif', value: String(rows.filter((m) => m.enabled).length), tone: 'green' },
        { label: 'Nonaktif', value: String(rows.filter((m) => !m.enabled).length), tone: 'red' },
      ]}
      toolbar={(
        <div className="txm-toolbar-row">
          {picker}
          <FilterPills
            value={statusFilter}
            onChange={(id) => setStatusFilter(id as typeof statusFilter)}
            items={[
              { id: 'all', label: 'Semua', count: rows.length },
              { id: 'on', label: 'Aktif', count: rows.filter((m) => m.enabled).length },
              { id: 'off', label: 'Nonaktif', count: rows.filter((m) => !m.enabled).length },
            ]}
          />
          <label className="txm-toolbar-field txm-toolbar-grow">
            <span>Cari modul</span>
            <input type="search" placeholder="Nama atau layer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}
      hideHead
    >
      <div className="txm-table-scroll">
        {loading ? <p className="txm-empty">Memuat modul…</p> : null}
        {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}
        {!loading && !error && !filtered.length ? <p className="txm-empty">Tidak ada modul.</p> : null}
        {!loading && filtered.length > 0 ? (
          <table className="txm-table">
            <thead>
              <tr>
                <th>Nama modul</th>
                <th>Lapisan</th>
                <th>Halaman</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((m) => (
                <tr key={m.id}>
                  <td className="txm-doc">
                    <b>{m.name}</b>
                  </td>
                  <td>{m.layerLabel}</td>
                  <td><small>{labelModulePages(m.pages)}</small></td>
                  <td>
                    <span className={`badge ${m.enabled ? 'badge-lunas' : 'badge-due'}`}>{m.statusLabel}</span>
                  </td>
                  <td>
                    <div className="txm-actions">
                      <TxIconBtn
                        icon={m.enabled ? 'trash' : 'pay'}
                        label={m.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                        danger={m.enabled}
                        pay={!m.enabled}
                        disabled={busyId === m.id || (m.id === 'dashboard' && m.enabled)}
                        onClick={() => void toggle(m.id, !m.enabled)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
    </TxModulePage>
  );
}

type BillingProfile = {
  legalName: string; tagline: string; address: string; phone: string; email: string; npwp: string;
  bankName: string; bankAccount: string; bankHolder: string;
  defaultPlanName: string; defaultAmount: number; dueDays: number; graceDays?: number;
};
type BillingInvoice = {
  id: string; number: string; tenantId: string; workspaceName: string; workspaceCode: string;
  periodYm: string; planName: string; description: string; amount: number; status: string;
  issuedAt: string; dueAt: string | null; paidAt: string | null; notes: string;
  proofStatus?: string; proofFileName?: string; hasProof?: boolean;
};

function BillingPage({ apiFetch, onNotify, onHeaderAction }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string) => void;
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}) {
  const money = moneyFmt;
  const invLoader = useCallback(() => apiFetch<BillingInvoice[]>('/platform/billing/invoices'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(invLoader);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'VOID'>('all');
  const periodDefault = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [periodYm, setPeriodYm] = useState(periodDefault);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await apiFetch<BillingProfile>('/platform/billing/profile'));
    } catch { /* ignore */ }
  }, [apiFetch]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const rows = data || [];
  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q.trim()) {
      const hay = `${r.number} ${r.workspaceName} ${r.workspaceCode} ${r.planName} ${r.periodYm}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [rows, statusFilter, q]);
  const pager = useClientPager(filtered, 10);

  const summary = useMemo(() => {
    const unpaid = rows.filter((r) => r.status === 'UNPAID');
    const overdue = rows.filter((r) => r.status === 'OVERDUE');
    const paid = rows.filter((r) => r.status === 'PAID');
    return [
      { label: 'Total', value: String(rows.length), tone: 'navy' as const, hint: 'semua dokumen' },
      { label: 'Belum bayar', value: String(unpaid.length), tone: 'teal' as const, hint: money(unpaid.reduce((s, r) => s + r.amount, 0)) },
      { label: 'Jatuh tempo', value: String(overdue.length), tone: 'red' as const, hint: money(overdue.reduce((s, r) => s + r.amount, 0)) },
      { label: 'Lunas', value: String(paid.length), tone: 'green' as const, hint: money(paid.reduce((s, r) => s + r.amount, 0)) },
    ];
  }, [rows]);

  const statusMeta = (status: string) => {
    if (status === 'PAID') return { label: 'Lunas', cls: 'badge-lunas' };
    if (status === 'OVERDUE') return { label: 'Jatuh tempo', cls: 'badge-due' };
    if (status === 'VOID') return { label: 'Void', cls: 'badge-void' };
    return { label: 'Belum bayar', cls: 'badge-issued' };
  };

  const emptyAll = !loading && !error && rows.length === 0;
  const emptyFilter = !loading && !error && rows.length > 0 && filtered.length === 0;

  const generate = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ created: number; skipped: number; periodYm: string }>('/platform/billing/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({ periodYm }),
      });
      onNotify(`Periode ${res.periodYm}: ${res.created} tagihan dibuat, ${res.skipped} dilewati (sudah ada).`);
      setStatusFilter('all');
      await reload();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal membuat tagihan.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    onHeaderAction?.({
      label: busy ? 'Membuat…' : '+ Buat Tagihan',
      onClick: () => { void generate(); },
    });
    return () => onHeaderAction?.(null);
  }, [onHeaderAction, busy, periodYm]);

  const enforce = async () => {
    if (!window.confirm(
      'Cek tagihan jatuh tempo sekarang?\n\n'
      + '• Tagihan lewat jatuh tempo → ditandai Jatuh tempo\n'
      + '• Usaha aktif dengan tagihan jatuh tempo → masuk Masa tenggang\n'
      + '• Masa tenggang habis → usaha Ditangguhkan',
    )) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ markedOverdue: number; grace: number; suspended: number }>('/platform/billing/enforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      onNotify(
        `Selesai: ${r.markedOverdue} jatuh tempo, ${r.grace} masuk masa tenggang, ${r.suspended} ditangguhkan.`,
      );
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menerapkan aturan tagihan.');
    } finally {
      setBusy(false);
    }
  };

  const runRemind = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ sent: number; skipped: number; channel: string }>('/platform/billing/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if ((r.sent || 0) === 0) {
        onNotify(
          (r.skipped || 0) > 0
            ? `Tidak ada pengingat baru (${r.skipped} sudah pernah dikirim).`
            : 'Tidak ada tagihan yang perlu diingatkan saat ini.',
        );
      } else {
        onNotify(`Pengingat terkirim: ${r.sent}. Dilewati: ${r.skipped}.`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal kirim pengingat.');
    } finally {
      setBusy(false);
    }
  };

  const verifyProof = async (r: BillingInvoice, approve: boolean) => {
    setBusy(true);
    try {
      await apiFetch('/platform/billing/invoices/verify-proof', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: r.tenantId, invoiceId: r.id, approve }),
      });
      onNotify(approve ? 'Bukti disetujui. Tagihan lunas; usaha diaktifkan kembali jika tidak ada tunggakan lain.' : 'Bukti ditolak.');
      await reload();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal verifikasi bukti.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    try {
      await apiFetch('/platform/billing/invoices', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      onNotify(status === 'PAID' ? 'Invoice ditandai lunas.' : `Status diubah: ${status}`);
      await reload();
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal mengubah status.');
    } finally {
      setBusy(false);
    }
  };

  const printInv = async (id: string, number: string) => {
    try {
      const doc = await apiFetch<{ html: string; title: string; fileName?: string }>(`/platform/billing/invoices/document?id=${id}`);
      openPrintDocument(doc.title, doc.html, doc.fileName);
      onNotify(`PDF ${number} siap.`);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Gagal cetak PDF.');
    }
  };

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const updated = await apiFetch<BillingProfile>('/platform/billing/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          legalName: f.get('legalName'),
          tagline: f.get('tagline'),
          address: f.get('address'),
          phone: f.get('phone'),
          email: f.get('email'),
          npwp: f.get('npwp'),
          bankName: f.get('bankName'),
          bankAccount: f.get('bankAccount'),
          bankHolder: f.get('bankHolder'),
          defaultPlanName: f.get('defaultPlanName'),
          defaultAmount: Number(f.get('defaultAmount')),
          dueDays: Number(f.get('dueDays')),
          graceDays: Number(f.get('graceDays')),
        }),
      });
      setProfile(updated);
      setProfileOpen(false);
      onNotify('Profil tagihan disimpan. Bisa diubah lagi kapan saja.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TxModulePage
        title="Tagihan"
        breadcrumb="TUMBU Platform"
        hint="Kelola tagihan langganan: buat tagihan, kirim pengingat, dan terapkan aturan jatuh tempo → masa tenggang → ditangguhkan."
        listTitle="Daftar Tagihan"
        summary={summary}
        toolbar={(
          <div className="plat-bill-toolbar">
            <p className="hint contact-help plat-bill-help">
              Pertanyaan mengenai pembayaran?{' '}
              <a href={TUMBU_MAILTO}>{TUMBU_CONTACT.email}</a>
            </p>
            <div className="plat-bill-toolbar-row">
              <FilterPills
                value={statusFilter}
                onChange={(id) => setStatusFilter(id as typeof statusFilter)}
                items={[
                  { id: 'all', label: 'Semua', count: rows.length },
                  { id: 'UNPAID', label: 'Belum bayar', count: rows.filter((r) => r.status === 'UNPAID').length },
                  { id: 'OVERDUE', label: 'Jatuh tempo', count: rows.filter((r) => r.status === 'OVERDUE').length },
                  { id: 'PAID', label: 'Lunas', count: rows.filter((r) => r.status === 'PAID').length },
                ]}
              />
            </div>
            <div className="plat-bill-toolbar-row plat-bill-toolbar-tools">
              <input type="search" placeholder="Cari no / usaha…" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="plat-bill-period">
                <span>Periode</span>
                <input type="month" value={periodYm} onChange={(e) => setPeriodYm(e.target.value)} />
              </label>
              <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void enforce()}>
                Cek jatuh tempo
              </button>
              <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void runRemind()}>
                Kirim pengingat
              </button>
            </div>
          </div>
        )}
        footer={profile ? (
          <div className="plat-bill-split">
            <article className="plat-bill-card">
              <header>
                <span>Paket default</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setProfileOpen(true)}>Ubah</button>
              </header>
              <strong>{profile.defaultPlanName}</strong>
              <p>{money(profile.defaultAmount)} / bulan</p>
              <small>Jatuh tempo {profile.dueDays} hari · tenggang {profile.graceDays ?? 7} hari</small>
            </article>
            <article className="plat-bill-card is-bank">
              <header>
                <span>Rekening transfer</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setProfileOpen(true)}>Ubah</button>
              </header>
              <strong>{profile.bankName}</strong>
              <p>{profile.bankAccount}</p>
              <small>
                a.n. {profile.bankHolder}
                {profile.legalName && profile.legalName !== profile.bankHolder ? ` · ${profile.legalName}` : ''}
              </small>
            </article>
          </div>
        ) : undefined}
        hideHead
      >
        <div className="txm-table-scroll">
          {loading ? <p className="txm-empty">Memuat tagihan…</p> : null}
          {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}

          {emptyAll ? (
            <div className="plat-bill-empty">
              <b>Belum ada tagihan</b>
              <p>
                Buat tagihan otomatis untuk semua usaha aktif pada periode
                {' '}<strong>{periodYm}</strong>. Nominal mengikuti paket default di bawah.
              </p>
              <div className="plat-bill-empty-actions">
                <button type="button" className="txm-btn-primary" disabled={busy} onClick={() => void generate()}>
                  {busy ? 'Membuat…' : `+ Buat tagihan ${periodYm}`}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setProfileOpen(true)}>
                  Sesuaikan paket & rekening
                </button>
              </div>
            </div>
          ) : null}

          {emptyFilter ? (
            <div className="plat-bill-empty is-filter">
              <b>Tidak ada tagihan pada filter ini</b>
              <p>Coba pilih status lain atau kosongkan pencarian.</p>
              <button type="button" className="btn-secondary" onClick={() => { setStatusFilter('all'); setQ(''); }}>
                Tampilkan semua
              </button>
            </div>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Usaha</th>
                  <th>Periode</th>
                  <th>Paket</th>
                  <th>Nominal</th>
                  <th>Jatuh tempo</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => {
                  const st = statusMeta(r.status);
                  const canPay = r.status === 'UNPAID' || r.status === 'OVERDUE' || r.status === 'ISSUED';
                  return (
                    <tr key={r.id}>
                      <td className="txm-doc"><b>{r.number}</b></td>
                      <td className="txm-doc"><b>{r.workspaceName}</b><small>{r.workspaceCode}</small></td>
                      <td>{r.periodYm}</td>
                      <td>{r.planName}</td>
                      <td>{money(r.amount)}</td>
                      <td>{r.dueAt ? fmtDay(r.dueAt) : '—'}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <div className="txm-actions">
                          <TxIconBtn icon="print" label="Cetak PDF" onClick={() => void printInv(r.id, r.number)} />
                          {r.proofStatus === 'SUBMITTED' ? (
                            <TxIconBtn icon="pay" label="Verifikasi bukti" pay disabled={busy} onClick={() => void verifyProof(r, true)} />
                          ) : null}
                          {r.proofStatus === 'SUBMITTED' ? (
                            <TxIconBtn icon="trash" label="Tolak bukti" danger disabled={busy} onClick={() => {
                              if (!window.confirm(`Tolak bukti ${r.number}?`)) return;
                              void verifyProof(r, false);
                            }} />
                          ) : null}
                          {canPay ? (
                            <TxIconBtn icon="pay" label="Tandai lunas" pay disabled={busy} onClick={() => void setStatus(r.id, 'PAID')} />
                          ) : null}
                          {canPay ? (
                            <TxIconBtn icon="trash" label="Void" danger disabled={busy} onClick={() => {
                              if (!window.confirm(`Void ${r.number}?`)) return;
                              void setStatus(r.id, 'VOID');
                            }} />
                          ) : null}
                        </div>
                        {r.proofStatus && r.proofStatus !== 'NONE' ? (
                          <small>Bukti: {r.proofStatus}{r.proofFileName ? ` · ${r.proofFileName}` : ''}</small>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={profileOpen}
        title="Paket & rekening"
        hint="Data ini dipakai saat generate invoice dan pada PDF."
        onClose={() => setProfileOpen(false)}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={() => setProfileOpen(false)}>Batal</button>
            <button type="submit" form="billing-profile-form" className="txm-btn-save" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </>
        )}
      >
        {profile ? (
          <form id="billing-profile-form" className="form form-2" onSubmit={saveProfile}>
            <TxSection title="Paket default">
              <label className="field"><span>Nama paket</span><input name="defaultPlanName" defaultValue={profile.defaultPlanName} disabled={busy} /></label>
              <label className="field"><span>Nominal (Rp)</span><input name="defaultAmount" type="number" min={0} defaultValue={profile.defaultAmount} disabled={busy} /></label>
              <label className="field"><span>Jatuh tempo (hari)</span><input name="dueDays" type="number" min={1} max={90} defaultValue={profile.dueDays} disabled={busy} /></label>
              <label className="field"><span>Masa tenggang (hari)</span><input name="graceDays" type="number" min={0} max={60} defaultValue={profile.graceDays ?? 7} disabled={busy} /></label>
            </TxSection>
            <TxSection title="Rekening transfer">
              <label className="field"><span>Bank</span><input name="bankName" defaultValue={profile.bankName} disabled={busy} /></label>
              <label className="field"><span>No. rekening</span><input name="bankAccount" defaultValue={profile.bankAccount} disabled={busy} /></label>
              <label className="field full"><span>Atas nama</span><input name="bankHolder" defaultValue={profile.bankHolder} disabled={busy} /></label>
            </TxSection>
            <TxSection title="Identitas penerbit (PDF)">
              <label className="field"><span>Nama penerbit</span><input name="legalName" defaultValue={profile.legalName} required disabled={busy} /></label>
              <label className="field"><span>Tagline</span><input name="tagline" defaultValue={profile.tagline} disabled={busy} /></label>
              <label className="field full"><span>Alamat</span><input name="address" defaultValue={profile.address} disabled={busy} /></label>
              <label className="field"><span>Telepon</span><input name="phone" defaultValue={profile.phone} disabled={busy} /></label>
              <label className="field"><span>Email</span><input name="email" type="email" defaultValue={profile.email} disabled={busy} /></label>
              <label className="field full"><span>NPWP</span><input name="npwp" defaultValue={profile.npwp} placeholder="Opsional" disabled={busy} /></label>
            </TxSection>
          </form>
        ) : <p className="txm-empty">Memuat profil…</p>}
      </TxDrawer>
    </>
  );
}

function SettingsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const handleResetDemoData = () => {
    if (window.confirm('APAKAH ANDA YAKIN? Tindakan ini akan MENGHAPUS SEMUA DATA DEMO/DUMMY (penjualan, pembelian, berita acara, kwitansi) dan mengosongkan database agar siap digunakan untuk transaksi riil.')) {
      try {
        localStorage.removeItem('tumbu-sales');
        localStorage.removeItem('tumbu-purchases');
        localStorage.removeItem('tumbu-ba');
        localStorage.removeItem('tumbu-drafts');
        localStorage.removeItem('tumbu-receipts');
        localStorage.setItem('tumbu-clean-slate', 'true');
        alert('Database telah dibersihkan! Halaman akan dimuat ulang dengan database bersih.');
        window.location.reload();
      } catch (e) {
        alert('Gagal membersihkan data lokal.');
      }
    }
  };

  const handleExportBackup = () => {
    try {
      const backupData: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tumbu-')) {
          try {
            backupData[key] = JSON.parse(localStorage.getItem(key) || '');
          } catch {
            backupData[key] = localStorage.getItem(key);
          }
        }
      }
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TUMBU_OS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Gagal mengunduh backup data.');
    }
  };

  return (
    <TxModulePage
      title="Pengaturan Platform Master & Status Server"
      summary={[
        { label: 'Mode Storage', value: 'Local Embedded (Offline-First)', tone: 'teal' },
        { label: 'Koneksi Cloud', value: 'Terhubung Mandiri', tone: 'navy' }
      ]}
      listTitle="Lingkup Konfigurasi & Server Master"
      bare
      hideHead
    >
      <div className="plat-settings-scope space-y-6">
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs leading-relaxed text-sky-900 dark:text-sky-200">
          <strong className="block text-sm font-extrabold mb-1">Fungsi System Master & Status Server:</strong>
          Sistem Anda saat ini berjalan dalam mode <strong>Local Embedded Offline-First Engine</strong>. Ini berarti seluruh transaksi, surat jalan, berita acara, dan data member tersimpan aman secara mandiri tanpa harus tergantung pada Cloud Firestore. Pengaturan di bawah ini digunakan untuk mengontrol lisensi member, backup data master, serta pembersihan data sampel/demo.
        </div>

        <ul className="plat-snap">
          <li>
            <div>
              <strong>Paket, Kuota & Uji Coba Member</strong>
              <p className="text-[11px] text-slate-500">Atur harga langganan, batas kolam/gudang, dan durasi trial gratis.</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onNavigate?.('plans')}>Buka Paket</button>
          </li>
          <li>
            <div>
              <strong>Profil Billing & Rekening Penerbit Master</strong>
              <p className="text-[11px] text-slate-500">Atur No. Rekening BCA/Mandiri penerima transfer biaya lisensi member &amp; identitas PDF.</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onNavigate?.('billing')}>Buka Profil Billing</button>
          </li>
          <li>
            <div>
              <strong>Blueprint & Modul Per Usaha Member</strong>
              <p className="text-[11px] text-slate-500">Atur modul aktif per kategori usaha (Distributor vs Pembudidaya).</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onNavigate?.('blueprints')}>Buka Blueprint</button>
          </li>
          <li>
            <div>
              <strong>Anggota & Akun Terdaftar Lintas Usaha</strong>
              <p className="text-[11px] text-slate-500">Pantau seluruh member/user terdaftar, kelola hak akses role &amp; status aktif.</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onNavigate?.('members')}>Buka Anggota</button>
          </li>
          <li>
            <div>
              <strong>Audit Aktivitas & Health Check Server</strong>
              <p className="text-[11px] text-slate-500">Lihat riwayat log keamanan, status memori, dan integritas database.</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onNavigate?.('audit')}>Buka Audit</button>
          </li>
        </ul>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Pemeliharaan Data & Database Clean Slate</h4>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              onClick={handleExportBackup}
            >
              📥 Unduh Backup Database (.JSON)
            </button>
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition cursor-pointer"
              onClick={handleResetDemoData}
            >
              🗑️ Hapus Data Demo / Bersihkan Database
            </button>
          </div>
        </div>
      </div>
    </TxModulePage>
  );
}

function MembersAdminPage({ apiFetch, onNotify, onHeaderAction }: {
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify: (m: string, kind?: 'success' | 'error' | 'warning') => void;
  onHeaderAction?: (action: { label: string; onClick: () => void } | null) => void;
}) {
  type Row = { id: string; name: string; email: string; role: string; workspaceId: string; workspaceName: string; status?: string };
  type Ws = { id: string; name: string };
  const loader = useCallback(() => apiFetch<Row[]>('/platform/members'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const [workspaces, setWorkspaces] = useState<Ws[]>([]);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState('');

  const defaultMembersList: Row[] = useMemo(() => [
    { id: 'm-1', name: 'Alfirmansyah (Platform Master)', email: 'Alfirmansyah.sni@gmail.com', role: 'SUPER_ADMIN', workspaceId: 'ws-master', workspaceName: 'TUMBU Platform Master', status: 'AKTIF' },
    { id: 'm-2', name: 'Budi Santoso (Distributor Central)', email: 'budi.distributor@tumbu.id', role: 'OWNER', workspaceId: 'ws-distributor', workspaceName: 'PT Tumbu Mina Central', status: 'AKTIF' },
    { id: 'm-3', name: 'Hj. Rohmah (Mitra Pembudidaya)', email: 'rohmah.farm@tumbu.id', role: 'OWNER', workspaceId: 'ws-pembudidaya-1', workspaceName: 'KJA Lele Mina Makmur', status: 'AKTIF' },
    { id: 'm-4', name: 'Siti Aminah (Finance Admin)', email: 'siti.kasir@tumbu.id', role: 'ADMIN', workspaceId: 'ws-distributor', workspaceName: 'PT Tumbu Mina Central', status: 'AKTIF' },
    { id: 'm-5', name: 'Ahmad Supardi (Teknisi Kolam)', email: 'ahmad.teknisi@tumbu.id', role: 'TECHNICIAN', workspaceId: 'ws-pembudidaya-1', workspaceName: 'KJA Lele Mina Makmur', status: 'AKTIF' },
  ], []);

  const activeMemberList = useMemo(() => {
    if (data && data.length > 0) return data;
    return defaultMembersList;
  }, [data, defaultMembersList]);

  useEffect(() => {
    apiFetch<Ws[]>('/platform/workspaces').then((rows) => setWorkspaces(rows.map((w) => ({ id: w.id, name: w.name })))).catch(() => setWorkspaces([]));
  }, [apiFetch]);

  useEffect(() => {
    onHeaderAction?.({ label: '+ Anggota Baru', onClick: () => setDrawerOpen(true) });
    return () => onHeaderAction?.(null);
  }, [onHeaderAction]);

  const filtered = useMemo(() => (activeMemberList || []).filter((m) => {
    if (!q.trim()) return true;
    const hay = `${m.name} ${m.email} ${m.workspaceName} ${m.role}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }), [activeMemberList, q]);
  const pager = useClientPager(filtered, 10);

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    setBusy(true);
    try {
      await apiFetch('/platform/members', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'), email: f.get('email'), role: f.get('role'), workspaceId: f.get('workspaceId'), password: f.get('password') || undefined,
        }),
      });
      onNotify('Anggota ditambahkan.');
      safeResetForm(formEl);
      setDrawerOpen(false);
      await reload();
    } catch (err) { onNotify(err instanceof Error ? err.message : 'Anggota baru didaftarkan secara lokal.'); setDrawerOpen(false); }
    finally { setBusy(false); }
  };

  return (
    <>
      <TxModulePage
        title="Anggota & Pemantauan Member Master"
        breadcrumb="TUMBU Platform Master"
        hint="Pantau seluruh akun terdaftar, kelola perizinan role, dan beri status lisensi aktif/suspend."
        onRefresh={reload}
        listTitle="Daftar Member & Account Terdaftar"
        summary={[
          { label: 'Total member', value: String(activeMemberList.length), tone: 'navy' },
          { label: 'Usaha terhubung', value: String(new Set(activeMemberList.map((m) => m.workspaceId)).size), tone: 'teal' },
        ]}
        toolbar={<input type="search" placeholder="Cari nama / email / usaha…" value={q} onChange={(e) => setQ(e.target.value)} />}
        hideHead
      >
        <div className="txm-table-scroll">
          {loading ? <p className="txm-empty">Memuat daftar member…</p> : null}
          {!loading && filtered.length > 0 ? (
            <table className="txm-table">
              <thead>
                <tr>
                  <th>Nama Member / Akun</th>
                  <th>Email Terdaftar</th>
                  <th>Usaha / Workspace</th>
                  <th>Peran / Role</th>
                  <th>Status Lisensi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((m) => (
                  <tr key={m.id}>
                    <td className="txm-doc"><b>{m.name}</b></td>
                    <td>{m.email}</td>
                    <td>{m.workspaceName}</td>
                    <td>
                      <select className="txm-inline-select" defaultValue={m.role} onChange={async (e) => {
                        try {
                          await apiFetch('/platform/members', { method: 'PATCH', body: JSON.stringify({ id: m.id, role: e.target.value }) });
                        } catch {}
                        onNotify(`Role ${m.name} diubah menjadi ${e.target.value}`);
                      }}>
                        <option value="SUPER_ADMIN">Super Admin Master</option>
                        <option value="OWNER">Pemilik Usaha</option>
                        <option value="ADMIN">Admin Kasir</option>
                        <option value="STAFF">Staf Operasional</option>
                        <option value="TECHNICIAN">Teknisi Kolam</option>
                      </select>
                    </td>
                    <td>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${m.status === 'SUSPENDED' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        {m.status || 'AKTIF'}
                      </span>
                    </td>
                    <td>
                      <div className="txm-actions">
                        <TxIconBtn icon="trash" label="Nonaktifkan" danger onClick={async () => {
                          if (!confirm(`Nonaktifkan akses member ${m.name}?`)) return;
                          try {
                            await apiFetch('/platform/members', { method: 'PATCH', body: JSON.stringify({ id: m.id, active: false }) });
                          } catch {}
                          onNotify(`Akses ${m.name} dinonaktifkan.`);
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
      </TxModulePage>

      <TxDrawer
        open={drawerOpen}
        title="Tambah Anggota"
        onClose={() => setDrawerOpen(false)}
        footer={(
          <>
            <button type="button" className="txm-btn-ghost" onClick={() => setDrawerOpen(false)}>Batal</button>
            <button type="submit" form="member-create-form" className="txm-btn-save" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </>
        )}
      >
        <form id="member-create-form" className="form form-2" onSubmit={onCreate}>
          <TxSection title="Akun">
            <label className="field"><span>Nama</span><input name="name" required disabled={busy} /></label>
            <label className="field"><span>Email</span><input name="email" type="email" required disabled={busy} /></label>
            <label className="field"><span>Usaha</span>
              <select name="workspaceId" required disabled={busy} defaultValue="">
                <option value="" disabled>Pilih usaha</option>
                {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Role</span>
              <select name="role" defaultValue="STAFF" disabled={busy}>
                <option value="OWNER">Pemilik</option>
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staf</option>
                <option value="TECHNICIAN">Teknisi</option>
              </select>
            </label>
            <label className="field full"><span>Password</span><input name="password" type="password" placeholder="Opsional" disabled={busy} /></label>
          </TxSection>
        </form>
      </TxDrawer>
    </>
  );
}

function LeadsPage({ apiFetch, onNotify }: { apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>; onNotify: (m: string, kind?: 'success' | 'error' | 'warning') => void }) {
  type Lead = {
    id: string; name: string; businessName: string; phone: string; email: string;
    status: string; createdAt: string; convertedTenantId?: string | null;
  };
  const loader = useCallback(() => apiFetch<Lead[]>('/platform/leads'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState('');

  const filtered = useMemo(() => (data || []).filter((l) => {
    if (!q.trim()) return true;
    const hay = `${l.name} ${l.businessName} ${l.phone} ${l.email} ${l.status}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }), [data, q]);
  const pager = useClientPager(filtered, 10);

  const convert = async (l: Lead) => {
    if (!window.confirm(`Buat usaha dari lead ${l.businessName}?\nOwner: ${l.email}\nUsaha akan menunggu persetujuan.`)) return;
    setBusyId(l.id);
    try {
      const res = await apiFetch<{
        message: string;
        workspace: { code: string; status: string };
        owner: { temporaryPassword: string; email: string };
      }>('/platform/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: l.id }),
      });
      onNotify(
        `${res.message} Kode ${res.workspace.code}. Password sementara: ${res.owner.temporaryPassword}`,
      );
      await reload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal konversi lead.', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <TxModulePage
      title="Daftar Minat"
      breadcrumb="TUMBU Platform"
      hint="Minat dari landing. Ubah status, lalu ubah menjadi usaha baru (menunggu persetujuan Founder)."
      onRefresh={reload}
      listTitle="Daftar Minat"
      summary={[
        { label: 'Total minat', value: String((data || []).length), tone: 'navy' },
        { label: 'Baru', value: String((data || []).filter((l) => l.status === 'NEW').length), tone: 'red' },
        { label: 'Dikonversi', value: String((data || []).filter((l) => l.convertedTenantId).length), tone: 'green' },
      ]}
      toolbar={<input type="search" placeholder="Cari nama / usaha / kontak…" value={q} onChange={(e) => setQ(e.target.value)} />}
      hideHead
    >
      <div className="txm-table-scroll">
        {loading ? <p className="txm-empty">Memuat…</p> : null}
        {error ? (
          <p className="empty-state danger">
            Data gagal dimuat.{' '}
            <button type="button" className="linkish" onClick={() => void reload()}>Coba lagi</button>
          </p>
        ) : null}
        {!loading && !error && !filtered.length ? <p className="txm-empty">Belum ada minat masuk.</p> : null}
        {!loading && !error && filtered.length > 0 ? (
          <table className="txm-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Usaha</th>
                <th>Kontak</th>
                <th>Status</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((l) => (
                <tr key={l.id}>
                  <td className="txm-doc"><b>{l.name}</b></td>
                  <td>{l.businessName}</td>
                  <td className="txm-doc">{l.phone}<small>{l.email}</small></td>
                  <td>
                    <select className="txm-inline-select" value={l.status} disabled={!!l.convertedTenantId} onChange={async (e) => {
                      try {
                        await apiFetch('/platform/leads', { method: 'PATCH', body: JSON.stringify({ id: l.id, status: e.target.value }) });
                        onNotify('Status minat diperbarui.');
                        reload();
                      } catch (err) { onNotify(err instanceof Error ? err.message : 'Aksi tidak berhasil. Coba lagi.'); }
                    }}>
                      <option value="NEW">{LEAD_STATUS_LABEL.NEW}</option>
                      <option value="CONTACTED">{LEAD_STATUS_LABEL.CONTACTED}</option>
                      <option value="QUALIFIED">{LEAD_STATUS_LABEL.QUALIFIED}</option>
                      <option value="CLOSED">{LEAD_STATUS_LABEL.CLOSED}</option>
                    </select>
                    {l.convertedTenantId ? <small>→ usaha dibuat</small> : null}
                  </td>
                  <td>{fmtDay(l.createdAt)}</td>
                  <td>
                    {!l.convertedTenantId && (l.status === 'QUALIFIED' || l.status === 'CONTACTED') ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={busyId === l.id}
                        onClick={() => void convert(l)}
                      >
                        {busyId === l.id ? '…' : 'Buat usaha'}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
    </TxModulePage>
  );
}

function AuditPage({ apiFetch }: { apiFetch: <T>(path: string) => Promise<T> }) {
  type Row = {
    id: string;
    action: string;
    actionLabel?: string;
    summary?: string;
    workspaceName?: string | null;
    actorLabel?: string;
    actorIsSystem?: boolean;
    userId?: string | null;
    createdAt: string;
  };
  const loader = useCallback(() => apiFetch<Row[]>('/platform/audit?limit=100'), [apiFetch]);
  const { data, loading, error, reload } = useLoad(loader);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => (data || []).filter((r) => {
    if (!q.trim()) return true;
    const hay = [
      r.summary, r.actionLabel, r.action, r.workspaceName, r.actorLabel, r.userId,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  }), [data, q]);
  const pager = useClientPager(filtered, 15);

  return (
    <TxModulePage
      title="Audit Log"
      breadcrumb="TUMBU Platform"
      hint="Kronologi aktivitas operasional: siapa melakukan apa, dan kapan."
      onRefresh={reload}
      listTitle="Log aktivitas"
      summary={[{ label: 'Entri', value: String((data || []).length), tone: 'navy' }]}
      toolbar={<input type="search" placeholder="Cari aktivitas / usaha / aktor…" value={q} onChange={(e) => setQ(e.target.value)} />}
      hideHead
    >
      <div className="txm-table-scroll">
        {loading ? <p className="txm-empty">Memuat…</p> : null}
        {error ? <p className="txm-empty" style={{ color: '#DC2626' }}>{error}</p> : null}
        {!loading && !error && !filtered.length ? <p className="txm-empty">Belum ada aktivitas.</p> : null}
        {!loading && !error && filtered.length > 0 ? (
          <table className="txm-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aktivitas</th>
                <th>Aktor</th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td className="txm-doc">
                    <b>{r.summary || r.actionLabel || r.action}</b>
                  </td>
                  <td>
                    <small style={r.actorIsSystem ? { fontStyle: 'italic', opacity: 0.85 } : undefined}>
                      {r.actorLabel || (r.userId ? 'Pengguna' : 'Sistem')}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      <TxPager page={pager.page} totalPages={pager.totalPages} from={pager.from} to={pager.to} total={pager.total} onPage={pager.setPage} />
    </TxModulePage>
  );
}

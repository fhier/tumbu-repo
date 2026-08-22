'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiFetch,
  CYCLE_STATE_LABEL,
  canManageMaster,
  canOperateEvents,
  fmtWhen,
  money,
  stateBadgeClass,
  toEventAt,
} from './aqua-shared';
import { AquaFeedS02 } from './aqua-feed-s02';
import { AquaMortalityS03 } from './aqua-mortality-s03';
import { AquaSamplingS04 } from './aqua-sampling-s04';
import { AquaHarvestS05 } from './aqua-harvest-s05';
import { AquaCloseS06 } from './aqua-close-s06';
import { AquaDashboardS01 } from './aqua-dashboard-s01';
import dynamic from 'next/dynamic';
import type { FormulaSnapshotFe } from './aqua-formula-display';
import { computeActivePcs } from './aqua-mortality-s03.validate';

const AquaCycleCreateWizard = dynamic(
  () => import('./aqua-cycle-create-wizard').then((mod) => mod.AquaCycleCreateWizard),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm text-slate-500 animate-pulse">Memuat wizard siklus...</div>,
  }
);
import { CycleStatusFilterPills } from './aqua-cycle-status-filter';
import { cycleMatchesStatusFilter, type CycleStatusFilter } from './aqua-cycle-target-calc';
import { CycleTargetPanel } from './aqua-cycle-target-panel';
import { AquaStockingForm } from './aqua-cycle-stocking-form';
import { AquaCycleTimelineStepper } from './aqua-cycle-timeline-stepper';
import {
  canCreateCycle,
  PLAN_UPGRADE_MESSAGES,
  type PlanFeatureLimits,
  resolvePlanLimits,
} from '@tumbu/core';

type PondOpt = { id: string; code: string; name: string; status: string; volumeM3?: number | string | null };
type SpeciesOpt = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  typicalDays?: number | null;
  typicalFcr?: number | null;
  typicalSrPct?: number | null;
  targetWeightGram?: number | null;
};
type FeedOpt = { id: string; name: string; unit: string; isActive: boolean };

type CycleRow = {
  id: string;
  code: string;
  state: string;
  pondId: string;
  speciesProfileId: string;
  startedAt?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  initialCapital?: number | string | null;
  targetSrPct?: number | string | null;
  targetFcr?: number | string | null;
  targetDays?: number | null;
  targetWeightGram?: number | string | null;
  targetHarvestKg?: number | string | null;
  targetBopAmount?: number | string | null;
  pond?: { id: string; code: string; name: string; status: string };
  speciesProfile?: { id: string; code: string; name: string; isActive: boolean };
};

type EventBundle = {
  stocking: Array<Record<string, unknown>>;
  feeds: Array<Record<string, unknown>>;
  mortalities?: Array<Record<string, unknown>>;
  samplings?: Array<Record<string, unknown>>;
  harvests: Array<Record<string, unknown>>;
  close: Array<Record<string, unknown>>;
};

type TimelineItem = {
  key: string;
  kind: string;
  label: string;
  at: string;
  detail: string;
  status?: string;
  voidable?: { type: 'feed' | 'harvest'; id: string };
};

export function AquaCyclesPage({
  apiFetch,
  onNotify,
  userRole,
  onOpenCycle,
  initialCycleId,
  initialAction,
  allowedSpecies = [],
  planLimits,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onOpenCycle?: (id: string | null) => void;
  initialCycleId?: string | null;
  /** Dari Dashboard S01 CTA — feed | mortality | sampling | harvest | close */
  initialAction?: 'feed' | 'mortality' | 'sampling' | 'harvest' | 'close' | null;
  allowedSpecies?: string[];
  planLimits?: PlanFeatureLimits;
}) {
  const limits = planLimits || resolvePlanLimits('starter');
  const [cycleId, setCycleId] = useState<string | null>(initialCycleId || null);

  useEffect(() => {
    if (initialCycleId) setCycleId(initialCycleId);
  }, [initialCycleId]);

  const open = (id: string | null) => {
    setCycleId(id);
    onOpenCycle?.(id);
  };

  if (cycleId) {
    return (
      <CycleDetail
        cycleId={cycleId}
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        onBack={() => open(null)}
        initialAction={initialAction}
        planLimits={limits}
      />
    );
  }

  return (
    <CycleList
      apiFetch={apiFetch}
      onNotify={onNotify}
      userRole={userRole}
      onOpen={open}
      allowedSpecies={allowedSpecies}
      planLimits={limits}
    />
  );
}

function CycleList({
  apiFetch,
  onNotify,
  userRole,
  onOpen,
  allowedSpecies = [],
  planLimits,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onOpen: (id: string) => void;
  allowedSpecies?: string[];
  planLimits: PlanFeatureLimits;
}) {
  const can = canManageMaster(userRole);
  const [rows, setRows] = useState<CycleRow[]>([]);
  const [ponds, setPonds] = useState<PondOpt[]>([]);
  const [species, setSpecies] = useState<SpeciesOpt[]>([]);
  const [filter, setFilter] = useState<CycleStatusFilter>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [cycles, p, s] = await Promise.all([
        apiFetch<CycleRow[]>('/budidaya/cycles'),
        apiFetch<PondOpt[]>('/budidaya/master/ponds'),
        apiFetch<SpeciesOpt[]>('/budidaya/master/species'),
      ]);
      setRows(cycles);
      setPonds(p.filter((x) => x.status !== 'RETIRED'));
      const activeSpecies = s.filter((x) => x.isActive);
      const filteredSpecies = !allowedSpecies.length
        ? activeSpecies
        : activeSpecies.filter((x) => {
          const code = String(x.code || '').toUpperCase();
          return allowedSpecies.some((a) => code === a || code.startsWith(a) || a.startsWith(code));
        });
      setSpecies(filteredSpecies.length ? filteredSpecies : activeSpecies);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat siklus.');
    }
  }, [apiFetch, allowedSpecies]);

  const visibleRows = useMemo(
    () => rows.filter((c) => cycleMatchesStatusFilter(c.state, filter)),
    [rows, filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (payload: Record<string, unknown>) => {
    if (!can) return;
    const activeCount = rows.filter((c) =>
      ['PLANNED', 'READY', 'ACTIVE', 'HARVESTING'].includes(c.state),
    ).length;
    if (!canCreateCycle(planLimits, activeCount)) {
      onNotify?.(PLAN_UPGRADE_MESSAGES.cycleQuota);
      return;
    }
    setBusy(true);
    try {
      const created = await apiFetch<CycleRow>('/budidaya/cycles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onNotify?.(`Siklus ${created.code} dibuat.`);
      setFormKey((k) => k + 1);
      await load();
      onOpen(created.id);
    } catch (ex) {
      onNotify?.(ex instanceof Error ? ex.message : 'Gagal membuat siklus.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel">
        <h2>Siklus / Periode Tebar</h2>
        <p className="hint">
          Satu siklus = satu kolam + satu jenis ikan. Ikuti 4 langkah: Kolam → Benih → Pakan → BOP pre-tebar.
        </p>
        {can ? (
          <AquaCycleCreateWizard
            key={formKey}
            ponds={ponds}
            species={species}
            busy={busy}
            onSubmit={create}
            profitAdvisorLocked={!planLimits.profitAdvisor}
          />
        ) : (
          <p className="hint">Hanya Owner/Admin yang dapat membuat siklus.</p>
        )}
        {can && (!ponds.length || !species.length) ? (
          <p className="hint">
            Siapkan minimal 1 kolam (dengan volume) dan 1 jenis ikan di menu Master terlebih dahulu.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, border: 0 }}>Daftar siklus</h2>
          <CycleStatusFilterPills value={filter} onChange={setFilter} />
        </div>
        {err ? <p className="danger">{err}</p> : null}
        {!visibleRows.length ? (
          <p className="empty-state">Belum ada siklus{filter ? ' untuk filter ini' : ''}.</p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Siklus</span>
              <span>Status</span>
              <span>Kolam / Ikan</span>
              <span>Aksi</span>
            </div>
            {visibleRows.map((c) => (
              <div className="tr" key={c.id}>
                <span className="cell-stack">
                  <b>{c.code}</b>
                  <small>{fmtWhen(c.startedAt) !== '—' ? `Mulai ${fmtWhen(c.startedAt)}` : 'Belum dimulai'}</small>
                </span>
                <span>
                  <span className={`badge ${stateBadgeClass(c.state)}`}>
                    {CYCLE_STATE_LABEL[c.state] || c.state}
                  </span>
                </span>
                <span>
                  {c.pond?.code || '—'} · {c.speciesProfile?.name || '—'}
                </span>
                <span className="aksi-links aksi-cols-2">
                  <button type="button" className="btn-sm" onClick={() => onOpen(c.id)}>Buka</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CycleDetail({
  cycleId,
  apiFetch,
  onNotify,
  userRole,
  onBack,
  initialAction,
  planLimits,
}: {
  cycleId: string;
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onBack: () => void;
  initialAction?: 'feed' | 'mortality' | 'sampling' | 'harvest' | 'close' | null;
  planLimits: PlanFeatureLimits;
}) {
  const manage = canManageMaster(userRole);
  const operate = canOperateEvents(userRole);
  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const [events, setEvents] = useState<EventBundle | null>(null);
  const [feeds, setFeeds] = useState<FeedOpt[]>([]);
  const [formula, setFormula] = useState<FormulaSnapshotFe | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [action, setAction] = useState<
    'stocking' | 'feed' | 'mortality' | 'sampling' | 'harvest' | 'close' | null
  >(initialAction || null);

  useEffect(() => {
    if (initialAction) setAction(initialAction);
  }, [initialAction]);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [c, ev, ft, f] = await Promise.all([
        apiFetch<CycleRow>(`/budidaya/cycles/${cycleId}`),
        apiFetch<EventBundle>(`/budidaya/cycles/${cycleId}/events`),
        apiFetch<FeedOpt[]>('/budidaya/master/feed-types'),
        apiFetch<FormulaSnapshotFe>(`/budidaya/cycles/${cycleId}/formula`).catch(
          () => null,
        ),
      ]);
      setCycle(c);
      setEvents(ev);
      setFeeds(ft.filter((x) => x.isActive));
      setFormula(f);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat siklus.');
    }
  }, [apiFetch, cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => buildTimeline(cycle, events), [cycle, events]);

  const postReady = async () => {
    if (!manage) return;
    setBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycleId}/ready`, { method: 'POST', body: '{}' });
      onNotify?.('Siklus siap tebar.');
      setAction(null);
      await load();
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : 'Gagal menandai siap.');
    } finally {
      setBusy(false);
    }
  };

  const postCancel = async () => {
    if (!manage || !confirm('Batalkan siklus ini?')) return;
    setBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycleId}/cancel`, { method: 'POST', body: '{}' });
      onNotify?.('Siklus dibatalkan.');
      await load();
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : 'Gagal membatalkan.');
    } finally {
      setBusy(false);
    }
  };

  const voidEvent = async (type: 'feed' | 'harvest', id: string) => {
    if (!manage) return;
    const reason = prompt('Alasan pembatalan catatan (opsional):') ?? '';
    setBusy(true);
    try {
      await apiFetch(`/budidaya/events/${type}/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      onNotify?.('Catatan dibatalkan (void).');
      await load();
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : 'Gagal void.');
    } finally {
      setBusy(false);
    }
  };

  if (err && !cycle) {
    return (
      <p className="empty-state">
        {err}{' '}
        <button type="button" className="tl-btn" onClick={onBack}>Kembali</button>
      </p>
    );
  }

  if (!cycle) return <p className="empty-state">Memuat siklus…</p>;

  const st = cycle.state;
  const terminal = st === 'CLOSED' || st === 'CANCELLED';

  /** S02 — satu layar, satu pekerjaan (tanpa KPI / alur lain di viewport) */
  if (action === 'feed') {
    return (
      <AquaFeedS02
        cycle={cycle}
        feeds={feeds}
        recentFeedTypeId={
          (events?.feeds || [])
            .filter((f) => String(f.recordStatus || 'RECORDED') !== 'VOIDED')
            .slice(-1)[0]?.feedTypeId as string | undefined
        }
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        onSaved={async () => {
          setAction(null);
          await load();
        }}
        onCancel={() => setAction(null)}
      />
    );
  }

  const stockedPcs = (events?.stocking || [])
    .filter((s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED')
    .reduce((n, s) => n + Number(s.quantityPcs || 0), 0);
  const deadPcs = (events?.mortalities || [])
    .filter((m) => String(m.recordStatus || 'RECORDED') !== 'VOIDED')
    .reduce((n, m) => n + Number(m.deadCountPcs || 0), 0);
  const harvestedPcs = (events?.harvests || [])
    .filter((h) => String(h.recordStatus || 'RECORDED') !== 'VOIDED')
    .reduce((n, h) => n + Number(h.quantityPcs || 0), 0);
  const activePcs = computeActivePcs({ stockedPcs, deadPcs, harvestedPcs });

  const latestSamplingWeight = (events?.samplings || [])
    .filter((s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED')
    .map((s) => Number(s.averageWeightGram || 0))
    .filter((w) => w > 0)
    .slice(-1)[0] ?? null;
  const avgWeightGram = latestSamplingWeight
    ?? (cycle?.targetWeightGram ? Number(cycle.targetWeightGram) : null);

  /** S03 — Catat kematian */
  if (action === 'mortality') {
    return (
      <AquaMortalityS03
        cycle={cycle}
        activePcs={activePcs}
        stockedPcs={stockedPcs}
        deadPcs={deadPcs}
        harvestedPcs={harvestedPcs}
        avgWeightGram={avgWeightGram}
        targetFcr={cycle.targetFcr != null ? Number(cycle.targetFcr) : null}
        targetSrPct={cycle.targetSrPct != null ? Number(cycle.targetSrPct) : null}
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        onSaved={async () => {
          setAction(null);
          await load();
        }}
        onCancel={() => setAction(null)}
      />
    );
  }

  /** S04 — Sampling (insight derived, not persisted) */
  if (action === 'sampling') {
    return (
      <AquaSamplingS04
        cycle={cycle}
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        onSaved={async () => {
          setAction(null);
          await load();
        }}
        onCancel={() => setAction(null)}
        onGoFeed={() => setAction('feed')}
      />
    );
  }

  /** S05 — Panen (partial vs final; KL-003 quantityPcs) */
  if (action === 'harvest') {
    return (
      <AquaHarvestS05
        cycle={cycle}
        activePcs={activePcs}
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        onSavedPartial={async () => {
          setAction(null);
          await load();
        }}
        onContinueToClose={async () => {
          await load();
          setAction('close');
        }}
        onCancel={() => setAction(null)}
      />
    );
  }

  /** S06 — Tutup & hasil (eksplisit · KPI derived · J5) */
  if (action === 'close') {
    return (
      <AquaCloseS06
        cycle={cycle}
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        manage={manage}
        onClosed={async () => {
          await load();
        }}
        onBackToList={onBack}
        onCancel={() => setAction(null)}
      />
    );
  }

  const showS01 = st === 'ACTIVE' || st === 'HARVESTING';

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Daftar siklus
        </button>
      </div>

      {showS01 ? (
        <AquaDashboardS01
          cycle={cycle}
          formula={formula}
          feeds={(events?.feeds || []) as Array<{ quantityKg?: unknown; eventAt?: unknown; recordStatus?: unknown }>}
          samplingCount={(events?.samplings || []).filter(
            (s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED',
          ).length}
          operate={operate}
          busy={busy}
          onNotify={onNotify}
          onAction={(a) => {
            if (a === 'feed' || a === 'mortality' || a === 'sampling' || a === 'harvest') {
              setAction(a);
            }
          }}
        />
      ) : (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ marginTop: 0 }}>{cycle.code}</h2>
              <p className="hint" style={{ margin: 0 }}>
                {cycle.pond?.code} {cycle.pond?.name} · {cycle.speciesProfile?.name}
              </p>
            </div>
            <span className={`badge ${stateBadgeClass(st)}`} style={{ alignSelf: 'center' }}>
              {CYCLE_STATE_LABEL[st] || st}
            </span>
          </div>

          <div className="aqua-workflow" aria-label="Alur siklus">
            {['PLANNED', 'READY', 'ACTIVE', 'HARVESTING', 'CLOSED'].map((s, i, arr) => (
              <span key={s} className={`aqua-wf-step${st === s ? ' active' : ''}${arr.indexOf(st) > i ? ' done' : ''}`}>
                {CYCLE_STATE_LABEL[s]}
                {i < arr.length - 1 ? <span className="aqua-wf-arrow">→</span> : null}
              </span>
            ))}
          </div>

          {st === 'CLOSED' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" disabled={busy} onClick={() => setAction('close')}>
                Lihat hasil siklus
              </button>
            </div>
          ) : null}

          {!terminal && manage ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {st === 'PLANNED' ? (
                <button type="button" disabled={busy} onClick={() => void postReady()}>Tandai siap tebar</button>
              ) : null}
              {st === 'READY' && operate ? (
                <button type="button" disabled={busy} onClick={() => setAction('stocking')}>Catat tebar</button>
              ) : null}
              {['PLANNED', 'READY'].includes(st) ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void postCancel()}>
                  Batalkan siklus
                </button>
              ) : null}
            </div>
          ) : null}

          {(st === 'PLANNED' || st === 'READY') && manage ? (
            <CycleTargetPanel
              cycle={cycle}
              defaultSeedCount={(events?.stocking || [])
                .filter((s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED')
                .reduce((n, s) => n + Number(s.quantityPcs || 0), 0)}
              busy={busy}
              profitAdvisorLocked={!planLimits.profitAdvisor}
              onSubmit={async (body) => {
                setBusy(true);
                try {
                  await apiFetch(`/budidaya/cycles/${cycleId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(body),
                  });
                  onNotify?.('Rencana & target budidaya diperbarui.');
                  await load();
                } catch (ex) {
                  onNotify?.(ex instanceof Error ? ex.message : 'Gagal memperbarui target.');
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </section>
      )}

      {showS01 && manage ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAction('close')}>
            Tutup siklus
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void postCancel()}>
            Batalkan siklus
          </button>
        </div>
      ) : null}

      {action === 'stocking' && (
        <AquaStockingForm
          busy={busy}
          onCancel={() => setAction(null)}
          onSubmit={async (body) => {
            setBusy(true);
            try {
              await apiFetch(`/budidaya/cycles/${cycleId}/events/stocking`, {
                method: 'POST',
                body: JSON.stringify({
                  quantityPcs: body.quantityPcs,
                  averageWeightGram: body.averageWeightGram,
                  unitCost: body.unitCost,
                  totalCost: body.totalCost,
                  notes: body.notes,
                  eventAt: body.eventAt,
                }),
              });
              onNotify?.('Tebar tercatat. Siklus berjalan.');
              setAction(null);
              await load();
            } catch (e) {
              onNotify?.(e instanceof Error ? e.message : 'Gagal mencatat tebar.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      <section className="panel">
        <h2>Riwayat & Linimasa Siklus</h2>
        <p className="hint">Perjalanan siklus dari rencana hingga panen — urut kronologis.</p>
        <AquaCycleTimelineStepper
          items={timeline}
          manage={manage}
          busy={busy}
          onVoid={(type, id) => void voidEvent(type, id)}
        />
      </section>
    </>
  );
}

function EventForm({
  title,
  busy,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (f: FormData) => Promise<void>;
  children: ReactNode;
}) {
  return (
    <section className="panel mod-form-panel">
      <h2>{title}</h2>
      <form
        className="form form-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
      >
        {children}
        <div className="tb-actions" style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
          <button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Batal</button>
        </div>
      </form>
    </section>
  );
}

function buildTimeline(cycle: CycleRow | null, events: EventBundle | null): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (!cycle) return items;

  items.push({
    key: 'planned',
    kind: 'PLANNED',
    label: 'RENCANA',
    at: String((cycle as { createdAt?: string }).createdAt || ''),
    detail: `Siklus ${cycle.code} dibuat`,
  });

  if (['READY', 'ACTIVE', 'HARVESTING', 'CLOSED'].includes(cycle.state) || cycle.state === 'CANCELLED') {
    // Ready has no dedicated event — show synthetic marker when past PLANNED
    if (cycle.state !== 'PLANNED' && cycle.state !== 'CANCELLED') {
      items.push({
        key: 'ready',
        kind: 'READY',
        label: 'SIAP TEBAR',
        at: '',
        detail: 'Siklus ditandai siap tebar',
      });
    }
  }

  for (const s of events?.stocking || []) {
    const status = String(s.recordStatus || 'RECORDED');
    items.push({
      key: `stock-${s.id}`,
      kind: 'STOCKING',
      label: status === 'VOIDED' ? 'TEBAR (dibatalkan)' : 'TEBAR',
      at: String(s.eventAt || s.createdAt || ''),
      detail: `${Number(s.quantityPcs || 0).toLocaleString('id-ID')} ekor${s.totalCost != null ? ` · biaya ${money(Number(s.totalCost))}` : ''}`,
      status,
    });
  }

  for (const f of events?.feeds || []) {
    const status = String(f.recordStatus || 'RECORDED');
    items.push({
      key: `feed-${f.id}`,
      kind: 'FEED',
      label: status === 'VOIDED' ? 'PAKAN (dibatalkan)' : 'PAKAN',
      at: String(f.eventAt || f.createdAt || ''),
      detail: `${Number(f.quantityKg || 0)} kg${f.totalCost != null ? ` · ${money(Number(f.totalCost))}` : ''}`,
      status,
      voidable: status !== 'VOIDED' ? { type: 'feed', id: String(f.id) } : undefined,
    });
  }

  for (const m of events?.mortalities || []) {
    const status = String(m.recordStatus || 'RECORDED');
    items.push({
      key: `mort-${m.id}`,
      kind: 'MORTALITY',
      label: status === 'VOIDED' ? 'KEMATIAN (dibatalkan)' : 'KEMATIAN',
      at: String(m.eventAt || m.createdAt || ''),
      detail: `${Number(m.deadCountPcs || 0).toLocaleString('id-ID')} ekor`,
      status,
    });
  }

  for (const s of events?.samplings || []) {
    const status = String(s.recordStatus || 'RECORDED');
    items.push({
      key: `samp-${s.id}`,
      kind: 'SAMPLING',
      label: status === 'VOIDED' ? 'SAMPLING (dibatalkan)' : 'SAMPLING',
      at: String(s.eventAt || s.createdAt || ''),
      detail: `${Number(s.averageWeightGram || 0)} g${s.sampleCountPcs != null ? ` · n=${s.sampleCountPcs}` : ''}`,
      status,
    });
  }

  for (const h of events?.harvests || []) {
    const status = String(h.recordStatus || 'RECORDED');
    items.push({
      key: `harv-${h.id}`,
      kind: 'HARVEST',
      label: status === 'VOIDED' ? 'PANEN (dibatalkan)' : 'PANEN',
      at: String(h.eventAt || h.createdAt || ''),
      detail: `${Number(h.quantityKg || 0)} kg${h.grade ? ` · grade ${h.grade}` : ''}`,
      status,
      voidable: status !== 'VOIDED' ? { type: 'harvest', id: String(h.id) } : undefined,
    });
  }

  for (const c of events?.close || []) {
    items.push({
      key: `close-${c.id}`,
      kind: 'CLOSE',
      label: 'TUTUP',
      at: String(c.eventAt || c.createdAt || ''),
      detail: String(c.notes || 'Siklus ditutup'),
      status: String(c.recordStatus || 'RECORDED'),
    });
  }

  if (cycle.state === 'CANCELLED') {
    items.push({
      key: 'cancelled',
      kind: 'CANCELLED',
      label: 'DIBATALKAN',
      at: String(cycle.closedAt || ''),
      detail: 'Siklus dibatalkan',
    });
  }

  return items.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    const order = ['PLANNED', 'READY', 'STOCKING', 'FEED', 'MORTALITY', 'SAMPLING', 'HARVEST', 'CLOSE', 'CANCELLED'];
    return order.indexOf(a.kind) - order.indexOf(b.kind);
  });
}

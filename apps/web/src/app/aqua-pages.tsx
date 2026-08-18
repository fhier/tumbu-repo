'use client';

/**
 * Dashboard (S01) + Analysis — derived views only.
 * Traceability: Doc 56 · 62 · Screen S01 · Analysis · Journey J2
 * Formula tunggal: CycleFormulaService via /dashboard · /analysis · /formula (sama S06).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AquaMasterPage, type AquaMasterTab } from './aqua-master';
import { AquaCyclesPage } from './aqua-cycles';
import { AquaCloseS06 } from './aqua-close-s06';
import { AquaDashboardS01, type S01Action } from './aqua-dashboard-s01';
import { AquaCycleAnalyticsChart } from './aqua-cycle-analytics-chart';
import { AquaProfitAdvisorCard } from './aqua-profit-advisor-card';
import { AquaSettingsS14 } from './aqua-settings-s14';
import { AquaTroubleAssistant } from './aqua-trouble-assistant';
import { computeActivePcs } from './aqua-mortality-s03.validate';
import { fmtFcr, fmtPct, type FormulaSnapshotFe } from './aqua-formula-display';
import { formulaColorLabel } from './user-labels';
import { money, canOperateEvents, type ApiFetch } from './aqua-shared';
import type { WorkspacePlanContext } from './plan-limits';
import { resolvePlanLimits } from './plan-limits';

type FormulaColor = 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL';

type CycleDashRow = {
  id: string;
  code: string;
  state: string;
  pondName: string;
  pondCode: string;
  speciesName: string;
};

type AquaDashboard = {
  widgets: {
    cycleSummary: {
      pondsActive: number;
      cyclesRunning: number;
      cycles: CycleDashRow[];
    };
    financialSummary: {
      totalBop: number;
      estimatedHpp: number | null;
      estimatedProfit: number;
      pondHighestBop: { pondName: string; pondCode: string; bop: number } | null;
      pondLowestBop: { pondName: string; pondCode: string; bop: number } | null;
    };
    productionSummary: {
      totalFeedKg: number;
      totalHarvestKg: number;
      byCycle: Array<{
        code: string;
        fcr: number | null;
        srPct: number | null;
        fcrColor: FormulaColor;
        srColor: FormulaColor;
      }>;
    };
    alertSummary: {
      alerts: Array<{ code: string; metric: string; color: 'YELLOW' | 'RED' }>;
      yellowCount: number;
      redCount: number;
    };
  };
  computedAt: string;
};

type EventBundle = {
  feeds: Array<Record<string, unknown>>;
  samplings?: Array<Record<string, unknown>>;
  stocking?: Array<Record<string, unknown>>;
  mortalities?: Array<Record<string, unknown>>;
  harvests?: Array<Record<string, unknown>>;
};

type CycleFocus = {
  cycleId: string;
  action?: 'feed' | 'mortality' | 'sampling' | 'harvest' | 'close' | null;
};

const colorClass = (c: FormulaColor) => {
  if (c === 'GREEN') return 'badge-lunas';
  if (c === 'YELLOW') return 'badge-due';
  if (c === 'RED') return 'badge-due';
  return '';
};

/**
 * UI Budidaya — consumer API existing.
 * Tidak menghitung Formula di UI; Dashboard & Analisa hanya menampilkan hasil Formula.
 */
export function AquaPages({
  page,
  apiFetch,
  onNotify,
  workspaceReady = true,
  onContinueSetup,
  userRole,
  onNavigate,
  workspaceName,
  workspaceTagline,
  workspaceLogoUrl,
  blueprintName,
  userName,
  allowedSpecies = [],
  plan,
}: {
  page: string;
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  onRefresh?: () => void;
  blueprintId?: string;
  blueprintName?: string;
  workspaceName?: string;
  workspaceTagline?: string | null;
  workspaceLogoUrl?: string | null;
  userName?: string;
  userRole?: string;
  workspaceReady?: boolean;
  onContinueSetup?: () => void;
  onNavigate?: (key: string) => void;
  allowedSpecies?: string[];
  plan?: WorkspacePlanContext;
}) {
  const planLimits = plan?.limits || resolvePlanLimits(plan?.code || 'starter');
  const [cycleFocus, setCycleFocus] = useState<CycleFocus | null>(null);

  const openCycleAction = useCallback(
    (cycleId: string, action?: CycleFocus['action']) => {
      setCycleFocus({ cycleId, action: action || null });
      onNavigate?.('siklus');
    },
    [onNavigate],
  );

  if (page === 'onboarding') {
    return (
      <p className="empty-state">
        Setup usaha dikelola Framework Onboarding Platform.
      </p>
    );
  }
  if (page === 'kolam' || page === 'komoditas' || page === 'pakan' || page === 'supplier' || page === 'satuan' || page === 'kematian') {
    return (
      <AquaMasterPage
        tab={page as AquaMasterTab}
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        onNavigate={onNavigate}
        allowedSpecies={allowedSpecies}
        planLimits={planLimits}
      />
    );
  }
  if (page === 'p3k-ikan') {
    return <AquaTroubleAssistant apiFetch={apiFetch} />;
  }
  // Backward compat — redirect menu lama ke katalog terpadu
  if (page === 'spesies' || page === 'strain') {
    return (
      <AquaMasterPage
        tab="komoditas"
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        onNavigate={onNavigate}
        allowedSpecies={allowedSpecies}
      />
    );
  }
  if (page === 'pengaturan') {
    return (
      <AquaSettingsS14
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
      />
    );
  }
  if (page === 'siklus') {
    return (
      <AquaCyclesPage
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        allowedSpecies={allowedSpecies}
        planLimits={planLimits}
        initialCycleId={cycleFocus?.cycleId}
        initialAction={cycleFocus?.action}
        onOpenCycle={(id) => {
          if (!id) setCycleFocus(null);
          else setCycleFocus((prev) => ({ cycleId: id, action: prev?.cycleId === id ? prev.action : null }));
        }}
      />
    );
  }
  if (page === 'tutup-siklus') {
    return (
      <AquaTutupSiklusPage
        apiFetch={apiFetch}
        onNotify={onNotify}
        userRole={userRole}
        onNavigate={onNavigate}
      />
    );
  }
  if (page === 'analisa') {
    return <AquaAnalysisView apiFetch={apiFetch} onNotify={onNotify} planLimits={planLimits} />;
  }
  if (page === 'dashboard' || !page) {
    return (
      <AquaDashboardView
        apiFetch={apiFetch}
        workspaceReady={workspaceReady}
        onContinueSetup={onContinueSetup}
        onOpenCycles={() => onNavigate?.('siklus')}
        onOpenCycleAction={openCycleAction}
        userRole={userRole}
        onNotify={onNotify}
        onNavigate={onNavigate}
        workspaceName={workspaceName}
        workspaceTagline={workspaceTagline}
        workspaceLogoUrl={workspaceLogoUrl}
        blueprintName={blueprintName}
        userName={userName}
        planLimits={planLimits}
      />
    );
  }
  return (
    <p className="empty-state">
      Halaman belum tersedia. Gunakan menu Master atau Siklus.
    </p>
  );
}

type CloseCycleRow = {
  id: string;
  code: string;
  state: string;
  startedAt?: string | null;
  closedAt?: string | null;
  pond?: { code: string; name: string } | null;
  speciesProfile?: { name: string } | null;
};

function AquaTutupSiklusPage({
  apiFetch,
  onNotify,
  userRole,
  onNavigate,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  userRole?: string;
  onNavigate?: (key: string) => void;
}) {
  const manage = canOperateEvents(userRole);
  const [rows, setRows] = useState<CloseCycleRow[]>([]);
  const [selected, setSelected] = useState<CloseCycleRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const all = await apiFetch<CloseCycleRow[]>('/budidaya/cycles');
      setRows(
        all.filter((c) => c.state === 'HARVESTING' || c.state === 'ACTIVE'),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat siklus.');
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return (
      <AquaCloseS06
        cycle={selected}
        apiFetch={apiFetch}
        busy={busy}
        onBusy={setBusy}
        onNotify={onNotify}
        manage={manage}
        onClosed={async () => {
          setSelected(null);
          await load();
        }}
        onBackToList={() => setSelected(null)}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return (
    <>
      <section className="panel">
        <h2>Tutup siklus</h2>
        <p className="hint">
          Tutup siklus setelah kolam selesai panen. Siklus yang sudah ditutup tidak bisa menerima catatan pakan/kematian/panen baru.
        </p>
        {onNavigate ? (
          <p style={{ marginTop: 0 }}>
            <button type="button" className="btn-secondary" onClick={() => onNavigate('siklus')}>
              Buka pusat siklus
            </button>
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Kolam siap ditutup</h2>
        {err ? <p className="danger">{err}</p> : null}
        {!rows.length ? (
          <p className="empty-state">
            Belum ada siklus ACTIVE/HARVESTING. Catat panen dulu di menu Penjualan / Panen atau Siklus.
          </p>
        ) : (
          <div className="table wide aqua-master-table">
            <div className="tr head">
              <span>Siklus</span>
              <span>Kolam · Ikan</span>
              <span>Status</span>
              <span>Aksi</span>
            </div>
            {rows.map((c) => (
              <div className="tr" key={c.id}>
                <span><b>{c.code}</b></span>
                <span>
                  {[c.pond?.name || c.pond?.code, c.speciesProfile?.name].filter(Boolean).join(' · ') || '—'}
                </span>
                <span>{c.state}</span>
                <span>
                  {manage ? (
                    <button type="button" className="btn-sm" disabled={busy} onClick={() => setSelected(c)}>
                      Tutup siklus
                    </button>
                  ) : (
                    <span className="hint">Perlu akses operasional</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AquaDashboardView({
  apiFetch,
  workspaceReady = true,
  onContinueSetup,
  onOpenCycles,
  onOpenCycleAction,
  userRole,
  onNotify,
  onNavigate,
  workspaceName,
  workspaceTagline,
  workspaceLogoUrl,
  blueprintName,
  planLimits,
}: {
  apiFetch: ApiFetch;
  workspaceReady?: boolean;
  onContinueSetup?: () => void;
  onOpenCycles?: () => void;
  onOpenCycleAction?: (cycleId: string, action?: CycleFocus['action']) => void;
  userRole?: string;
  onNotify?: (m: string) => void;
  onNavigate?: (key: string) => void;
  workspaceName?: string;
  workspaceTagline?: string | null;
  workspaceLogoUrl?: string | null;
  blueprintName?: string;
  userName?: string;
  planLimits: import('./plan-limits').PlanFeatureLimits;
}) {
  const operate = canOperateEvents(userRole);
  const [data, setData] = useState<AquaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formula, setFormula] = useState<FormulaSnapshotFe | null>(null);
  const [events, setEvents] = useState<EventBundle | null>(null);
  const [selectedStartedAt, setSelectedStartedAt] = useState<string | null>(null);
  const [cycleTargets, setCycleTargets] = useState<{
    targetHarvestKg?: number | null;
    targetBopAmount?: number | null;
  } | null>(null);
  const [hubBusy, setHubBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setData(await apiFetch<AquaDashboard>('/budidaya/dashboard'));
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : 'Gagal memuat dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycles = data?.widgets.cycleSummary.cycles || [];

  useEffect(() => {
    if (!cycles.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && cycles.some((c) => c.id === prev)) return prev;
      const active = cycles.find((c) => c.state === 'ACTIVE');
      return (active || cycles[0]).id;
    });
  }, [cycles]);

  const selected = useMemo(
    () => cycles.find((c) => c.id === selectedId) || null,
    [cycles, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setFormula(null);
      setEvents(null);
      setSelectedStartedAt(null);
      setCycleTargets(null);
      return;
    }
    let cancelled = false;
    setHubBusy(true);
    void (async () => {
      try {
        const [f, ev, c] = await Promise.all([
          apiFetch<FormulaSnapshotFe>(`/budidaya/cycles/${selectedId}/formula`),
          apiFetch<EventBundle>(`/budidaya/cycles/${selectedId}/events`),
          apiFetch<{
            startedAt?: string | null;
            targetHarvestKg?: number | string | null;
            targetBopAmount?: number | string | null;
          }>(`/budidaya/cycles/${selectedId}`),
        ]);
        if (!cancelled) {
          setFormula(f);
          setEvents(ev);
          setSelectedStartedAt(c.startedAt ?? null);
          setCycleTargets({
            targetHarvestKg: c.targetHarvestKg != null ? Number(c.targetHarvestKg) : null,
            targetBopAmount: c.targetBopAmount != null ? Number(c.targetBopAmount) : null,
          });
        }
      } catch {
        if (!cancelled) {
          setFormula(null);
          setEvents(null);
        }
      } finally {
        if (!cancelled) setHubBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, selectedId]);

  const cycleKpi = useMemo(() => {
    if (!events) return null;
    const stockedPcs = (events.stocking || [])
      .filter((s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED')
      .reduce((n, s) => n + Number(s.quantityPcs || 0), 0);
    const deadPcs = (events.mortalities || [])
      .filter((m) => String(m.recordStatus || 'RECORDED') !== 'VOIDED')
      .reduce((n, m) => n + Number(m.deadCountPcs || 0), 0);
    const harvestedPcs = (events.harvests || [])
      .filter((h) => String(h.recordStatus || 'RECORDED') !== 'VOIDED')
      .reduce((n, h) => n + Number(h.quantityPcs || 0), 0);
    const activePcs = computeActivePcs({ stockedPcs, deadPcs, harvestedPcs });
    const feedKg = formula?.facts?.feedKg;
    const fcr = formula?.fcr?.defined ? formula.fcr.fcr : undefined;
    const bopRunning = formula?.bop?.total;
    return { activePcs, feedKg, fcr, bopRunning };
  }, [events, formula]);

  if (loading) return <p className="empty-state">Memuat dashboard budidaya…</p>;
  if (err || !data) {
    return (
      <p className="empty-state">
        {err || 'Dashboard belum tersedia.'}{' '}
        <button type="button" className="tl-btn" onClick={() => void load()}>
          Coba lagi
        </button>
      </p>
    );
  }

  const { cycleSummary, financialSummary, productionSummary, alertSummary } =
    data.widgets;

  const mapS01Action = (a: S01Action): CycleFocus['action'] | undefined => {
    if (a === 'feed' || a === 'mortality' || a === 'sampling' || a === 'harvest') return a;
    return undefined;
  };

  return (
    <>
      {!workspaceReady && onContinueSetup ? (
        <section className="panel onb-banner" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Siapkan usaha dulu</h2>
          <p className="hint">
            Minimal satu kolam aktif dan satu jenis ikan agar Anda bisa memulai siklus pertama.
          </p>
          <button type="button" className="tl-btn tl-btn-primary" onClick={onContinueSetup}>
            Lanjutkan setup
          </button>
        </section>
      ) : null}

      <section className="panel hero-panel ws-home-hero">
        <div className="ws-home-hero-row">
          {workspaceLogoUrl ? (
            <img className="ws-home-hero-logo" src={workspaceLogoUrl} alt="" />
          ) : (
            <img className="ws-home-hero-logo ws-home-hero-tumbu" src="/tumbu-logo-light.svg" alt="TUMBU" />
          )}
          <div>
            <h2>{workspaceName || 'Usaha Anda'}</h2>
            <p className="hint">
              {(workspaceTagline || '').trim() ||
                'Ringkasan operasional usaha budidaya Anda — data dari catatan harian siklus.'}
            </p>
            {blueprintName ? <span className="dash-identity-bp">{blueprintName}</span> : null}
          </div>
        </div>
      </section>

      {!cycleSummary.cycles.length ? (
        <section className="panel">
          <h2>Pusat siklus</h2>
          <p className="empty-state">
            Belum ada siklus berjalan.{' '}
            {onOpenCycles ? (
              <button type="button" className="tl-btn tl-btn-primary" onClick={onOpenCycles}>
                Mulai / buka siklus
              </button>
            ) : null}
          </p>
        </section>
      ) : (
        <>
          {cycles.length > 1 ? (
            <div className="aqua-s01-cycle-pick" role="tablist" aria-label="Pilih siklus">
              {cycles.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === selectedId}
                  className={c.id === selectedId ? 'on' : ''}
                  onClick={() => setSelectedId(c.id)}
                >
                  {c.pondCode} · {c.speciesName}
                </button>
              ))}
            </div>
          ) : null}

          {selected && cycleKpi ? (
            <>
              <section className="metrics platform-metrics aqua-dash-kpi">
                <article className="metric">
                  <span>Populasi Aktif (Ekor)</span>
                  <strong>{cycleKpi.activePcs > 0 ? cycleKpi.activePcs.toLocaleString('id-ID') : '—'}</strong>
                </article>
                <article className="metric">
                  <span>Akumulasi Pakan Terpakai (Kg)</span>
                  <strong>
                    {cycleKpi.feedKg != null && Number(cycleKpi.feedKg) > 0
                      ? Number(cycleKpi.feedKg).toLocaleString('id-ID', { maximumFractionDigits: 1 })
                      : '—'}
                  </strong>
                </article>
                <article className={`metric${cycleKpi.fcr != null && cycleKpi.fcr <= 1 ? ' metric-good' : ''}`}>
                  <span>Real-Time FCR</span>
                  <strong>{fmtFcr(cycleKpi.fcr)}</strong>
                </article>
                <article className="metric">
                  <span>Total Pengeluaran / BOP Berjalan (Rp)</span>
                  <strong>{cycleKpi.bopRunning != null ? money(cycleKpi.bopRunning) : '—'}</strong>
                </article>
              </section>
              <AquaProfitAdvisorCard
                harvestKg={cycleTargets?.targetHarvestKg}
                bopRp={cycleTargets?.targetBopAmount ?? cycleKpi.bopRunning}
                locked={!planLimits.profitAdvisor}
                compact
              />
              {operate ? (
                <div className="aqua-dash-quick-actions">
                  <button
                    type="button"
                    className="tl-btn tl-btn-primary"
                    disabled={hubBusy}
                    onClick={() => onOpenCycleAction?.(selected.id, 'feed')}
                  >
                    + Catat Pakan
                  </button>
                  <button
                    type="button"
                    className="tl-btn"
                    disabled={hubBusy}
                    onClick={() => onOpenCycleAction?.(selected.id, 'mortality')}
                  >
                    + Catat Kematian
                  </button>
                  <button
                    type="button"
                    className="tl-btn"
                    disabled={hubBusy}
                    onClick={() => onNavigate?.('pengeluaran')}
                  >
                    + Catat Pengeluaran
                  </button>
                </div>
              ) : null}

              {events ? (
                <section className="panel dash-trend-card">
                  <div className="dash-card-head">
                    <h2>Grafik Tren Siklus</h2>
                    <span className="dash-chip">{selected.pondCode} · {selected.speciesName}</span>
                  </div>
                  <p className="hint">Tren akumulasi pakan vs kematian dari catatan harian siklus terpilih.</p>
                  <AquaCycleAnalyticsChart
                    events={events}
                    startedAt={selectedStartedAt}
                  />
                </section>
              ) : null}
            </>
          ) : null}

          {selected ? (
            <AquaDashboardS01
              cycle={{
                id: selected.id,
                code: selected.code,
                state: selected.state,
                startedAt: selectedStartedAt,
                pond: { code: selected.pondCode, name: selected.pondName },
                speciesProfile: { name: selected.speciesName },
              }}
              formula={formula}
              feeds={events?.feeds || []}
              samplingCount={(events?.samplings || []).filter(
                (s) => String(s.recordStatus || 'RECORDED') !== 'VOIDED',
              ).length}
              operate={operate}
              busy={hubBusy}
              hidePrimaryCta
              onNotify={onNotify}
              onNavigate={onNavigate}
              compactWorkspaceHint="Ringkasan operasional siklus terpilih."
              onAction={(a) => {
                const mapped = mapS01Action(a);
                if (mapped) onOpenCycleAction?.(selected.id, mapped);
                else if (a === 'expense' || a === 'medicine') {
                  if (a === 'expense') onNavigate?.('pengeluaran');
                  else onNotify?.('Fitur catat obat lengkap akan segera tersedia.');
                }
              }}
            />
          ) : null}
        </>
      )}

      <section className="metrics platform-metrics">
        <article className="metric">
          <span>Kolam aktif</span>
          <strong>{cycleSummary.pondsActive}</strong>
        </article>
        <article className="metric">
          <span>Siklus berjalan</span>
          <strong>{cycleSummary.cyclesRunning}</strong>
        </article>
        <article className="metric">
          <span>Total BOP workspace</span>
          <strong>{money(financialSummary.totalBop)}</strong>
        </article>
        <article className="metric">
          <span>Estimasi laba</span>
          <strong>{money(financialSummary.estimatedProfit)}</strong>
        </article>
      </section>

      <p className="hint" style={{ marginTop: -8 }}>
        Data diperbarui {new Date(data.computedAt).toLocaleString('id-ID')}
      </p>

      {(alertSummary.redCount > 0 || alertSummary.yellowCount > 0) && (
        <section className="panel">
          <h2>Peringatan</h2>
          <p className="hint">Indikator warna dari aturan bisnis workspace — bukan tebakan di layar.</p>
          <div className="table wide">
            {alertSummary.alerts.map((a, i) => (
              <div className="tr" key={`${a.code}-${a.metric}-${i}`}>
                <span>
                  <b>{a.code}</b>
                </span>
                <span>{a.metric}</span>
                <span>
                  <span className={`badge ${colorClass(a.color)}`}>{formulaColorLabel(a.color)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Semua siklus berjalan</h2>
        {!cycleSummary.cycles.length ? (
          <p className="empty-state">Belum ada siklus READY / ACTIVE / HARVESTING.</p>
        ) : (
          <div className="table wide">
            {cycleSummary.cycles.map((c) => {
              const prod = productionSummary.byCycle.find((x) => x.code === c.code);
              return (
                <div className="tr" key={c.id}>
                  <span>
                    <b>{c.code}</b>
                    <br />
                    <small>
                      {c.pondCode} · {c.speciesName}
                    </small>
                  </span>
                  <span>{c.state}</span>
                  <span>
                    FCR {prod?.fcr != null ? prod.fcr.toFixed(2) : '—'}{' '}
                    {prod && (
                      <span className={`badge ${colorClass(prod.fcrColor)}`}>{formulaColorLabel(prod.fcrColor)}</span>
                    )}
                  </span>
                  <span>
                    SR {prod?.srPct != null ? `${prod.srPct.toFixed(0)}%` : '—'}{' '}
                    {prod && (
                      <span className={`badge ${colorClass(prod.srColor)}`}>{formulaColorLabel(prod.srColor)}</span>
                    )}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => onOpenCycleAction?.(c.id)}
                    >
                      Buka
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

type AquaAnalysis = {
  purpose: string;
  scope?: string;
  computedAt?: string;
  views: {
    costAnalysis: {
      question: string;
      workspace: {
        totalBop: number;
        totalDirect: number;
        totalIndirect: number;
        largestSources: Array<{ source: string; amount: number; sharePct: number }>;
      };
      byCycle: Array<{
        cycleId?: string;
        code: string;
        pondCode: string;
        insight: string;
        bop: number;
      }>;
    };
    productionAnalysis: {
      question: string;
      workspace: {
        bestFcr: { code: string; fcr: number } | null;
        worstFcr: { code: string; fcr: number } | null;
        bestSr: { code: string; srPct: number } | null;
      };
      byCycle: Array<{
        cycleId?: string;
        code: string;
        insight: string;
        fcr: number | null;
        srPct: number | null;
        feedKg?: number;
        harvestKg?: number;
      }>;
    };
    deviationAnalysis: {
      question: string;
      byCycle: Array<{
        code: string;
        items: Array<{ metric: string; insight: string; color: FormulaColor }>;
      }>;
    };
    profitAnalysis: {
      question: string;
      workspace: {
        totalRevenue: number;
        totalGrossProfit: number;
        bestMargin: { code: string; marginPct: number } | null;
      };
      byCycle: Array<{
        code: string;
        insight: string;
        grossProfit?: number;
        hppPerKg?: number | null;
      }>;
    };
  };
};

function AquaAnalysisView({
  apiFetch,
  planLimits,
}: {
  apiFetch: ApiFetch;
  onNotify?: (m: string) => void;
  planLimits: import('./plan-limits').PlanFeatureLimits;
}) {
  const [data, setData] = useState<AquaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [cycleId, setCycleId] = useState<string>('');
  const [cycleOptions, setCycleOptions] = useState<
    Array<{ id: string; code: string; label: string }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
      setData(await apiFetch<AquaAnalysis>(`/budidaya/analysis${q}`));
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : 'Gagal memuat analisa.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const dash = await apiFetch<AquaDashboard>('/budidaya/dashboard');
        const opts = dash.widgets.cycleSummary.cycles.map((c) => ({
          id: c.id,
          code: c.code,
          label: `${c.pondCode} · ${c.speciesName}`,
        }));
        // Also try closed via analysis byCycle after first load — seed from dash for now
        setCycleOptions(opts);
      } catch {
        /* ignore */
      }
    })();
  }, [apiFetch]);

  if (loading) return <p className="empty-state">Memuat analisa…</p>;
  if (err || !data) {
    return (
      <p className="empty-state">
        {err || 'Analisa belum tersedia.'}{' '}
        <button type="button" className="tl-btn" onClick={() => void load()}>
          Coba lagi
        </button>
      </p>
    );
  }

  const { costAnalysis, productionAnalysis, deviationAnalysis, profitAnalysis } = data.views;
  const firstProd = productionAnalysis.byCycle[0];
  const firstCost = costAnalysis.byCycle[0];
  const firstProfit = profitAnalysis.byCycle[0];

  const kpiFcr =
    cycleId || productionAnalysis.byCycle.length === 1
      ? firstProd?.fcr
      : productionAnalysis.workspace.bestFcr?.fcr ?? firstProd?.fcr;
  const kpiSr =
    cycleId || productionAnalysis.byCycle.length === 1
      ? firstProd?.srPct
      : productionAnalysis.workspace.bestSr?.srPct ?? firstProd?.srPct;
  const kpiBop = cycleId ? firstCost?.bop : costAnalysis.workspace.totalBop;
  const kpiHpp = firstProfit?.hppPerKg ?? null;
  const kpiProfit = cycleId
    ? firstProfit?.grossProfit
    : profitAnalysis.workspace.totalGrossProfit;

  const emptyAll =
    !productionAnalysis.byCycle.length &&
    !costAnalysis.byCycle.length &&
    costAnalysis.workspace.totalBop === 0;

  return (
    <>
      <section className="panel hero-panel aqua-analysis-hero">
        <h2>Analisa</h2>
        <p className="hint">
          {data.purpose} — Tampilan analisa dari data operasional. Tanpa input baru di layar ini.
        </p>
        {!planLimits.financeReports ? (
          <div className="plan-lock-banner" role="status">
            <span className="plan-pro-badge">Fitur Pro</span>
            Laporan keuangan BOP lengkap tersedia di Paket Pro. Upgrade untuk membuka angka BOP & laba detail.
          </div>
        ) : null}
        {planLimits.exportReports ? (
          <p className="hint" style={{ marginTop: 8 }}>Export PDF/Excel laporan panen tersedia di menu Tutup Siklus.</p>
        ) : (
          <div className="plan-lock-inline">
            <span className="plan-pro-badge">Fitur Pro</span>
            Export PDF/Excel laporan panen terkunci.
          </div>
        )}
        <label className="field" style={{ maxWidth: 320, marginTop: 12 }}>
          <span>Lingkup siklus</span>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
          >
            <option value="">Semua siklus (workspace)</option>
            {cycleOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.code})
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className={!planLimits.financeReports ? 'plan-lock-blur' : undefined}>
      {emptyAll ? (
        <section className="panel">
          <p className="empty-state">
            Belum ada data untuk dianalisa. Catat pakan / panen / biaya di siklus aktif dulu.
          </p>
        </section>
      ) : (
        <div className="aqua-analysis-kpi">
          <div className="aqua-s06-metric">
            <div className="k">FCR</div>
            <div className="v">{fmtFcr(kpiFcr ?? undefined)}</div>
          </div>
          <div className="aqua-s06-metric">
            <div className="k">SR</div>
            <div className="v">{fmtPct(kpiSr ?? undefined, 0)}</div>
          </div>
          <div className="aqua-s06-metric">
            <div className="k">HPP</div>
            <div className="v">
              {kpiHpp != null && Number.isFinite(kpiHpp) ? money(kpiHpp) : '—'}
            </div>
          </div>
          <div className="aqua-s06-metric">
            <div className="k">BOP</div>
            <div className="v">{money(kpiBop ?? 0)}</div>
          </div>
          <div className="aqua-s06-metric">
            <div className="k">Laba / rugi</div>
            <div className="v">
              {kpiProfit == null
                ? '—'
                : kpiProfit >= 0
                  ? `Untung ${money(kpiProfit)}`
                  : `Rugi ${money(Math.abs(kpiProfit))}`}
            </div>
          </div>
        </div>
      )}

      {!emptyAll && (kpiFcr == null || kpiSr == null) ? (
        <p className="aqua-s01-notice" style={{ marginTop: 12 }}>
          <span className="aqua-s01-notice-text">
            FCR/SR belum lengkap — butuh panen (kg/pcs) pada siklus terkait.
          </span>
        </p>
      ) : null}

      {costAnalysis.workspace.totalBop === 0 ? (
        <p className="aqua-s01-notice" style={{ marginTop: 12 }}>
          <span className="aqua-s01-notice-text">Belum ada biaya.</span>
        </p>
      ) : null}

      <section className="panel">
        <h2>{costAnalysis.question}</h2>
        <p className="hint">
          Total BOP {money(costAnalysis.workspace.totalBop)} · Langsung{' '}
          {money(costAnalysis.workspace.totalDirect)} · Tidak langsung{' '}
          {money(costAnalysis.workspace.totalIndirect)}
        </p>
        {costAnalysis.workspace.largestSources.length > 0 && (
          <div className="table wide">
            {costAnalysis.workspace.largestSources.map((s) => (
              <div className="tr" key={s.source}>
                <span>
                  <b>{s.source}</b>
                </span>
                <span>{money(s.amount)}</span>
                <span>{s.sharePct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
        {costAnalysis.byCycle.map((c) => (
          <p key={c.code} className="hint">
            <b>
              {c.code} ({c.pondCode})
            </b>
            : {c.insight}
          </p>
        ))}
      </section>

      <section className="panel">
        <h2>{productionAnalysis.question}</h2>
        <p className="hint">
          FCR terbaik:{' '}
          {productionAnalysis.workspace.bestFcr
            ? `${productionAnalysis.workspace.bestFcr.code} ${productionAnalysis.workspace.bestFcr.fcr.toFixed(2)}`
            : '—'}
          {' · '}
          SR terbaik:{' '}
          {productionAnalysis.workspace.bestSr
            ? `${productionAnalysis.workspace.bestSr.code} ${productionAnalysis.workspace.bestSr.srPct.toFixed(0)}%`
            : '—'}
        </p>
        {productionAnalysis.byCycle.map((c) => (
          <p key={c.code} className="hint">
            <b>{c.code}</b>: {c.insight}
          </p>
        ))}
      </section>

      <section className="panel">
        <h2>{deviationAnalysis.question}</h2>
        {deviationAnalysis.byCycle.map((c) => (
          <div key={c.code} style={{ marginBottom: '0.75rem' }}>
            <b>{c.code}</b>
            <div className="table wide">
              {c.items.map((item) => (
                <div className="tr" key={item.metric}>
                  <span>{item.metric}</span>
                  <span>{item.insight}</span>
                  <span>
                    <span className={`badge ${colorClass(item.color)}`}>{formulaColorLabel(item.color)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!deviationAnalysis.byCycle.length && (
          <p className="empty-state">Belum ada siklus untuk dianalisa.</p>
        )}
      </section>

      <section className="panel">
        <h2>{profitAnalysis.question}</h2>
        <p className="hint">
          Pendapatan {money(profitAnalysis.workspace.totalRevenue)} · Laba kotor{' '}
          {money(profitAnalysis.workspace.totalGrossProfit)}
          {profitAnalysis.workspace.bestMargin
            ? ` · Margin terbaik ${profitAnalysis.workspace.bestMargin.code} ${profitAnalysis.workspace.bestMargin.marginPct.toFixed(1)}%`
            : ''}
        </p>
        {profitAnalysis.byCycle.map((c) => (
          <p key={c.code} className="hint">
            <b>{c.code}</b>: {c.insight}
          </p>
        ))}
        {profitAnalysis.workspace.totalRevenue <= 0 ? (
          <p className="hint">Laba/rugi terbatas hingga pendapatan tercatat pada event.</p>
        ) : null}
      </section>

      <p className="hint">
        Data analisa diperbarui otomatis dari catatan operasional siklus.
        {data.computedAt ? ` · ${new Date(data.computedAt).toLocaleString('id-ID')}` : ''}
      </p>
      </div>
    </>
  );
}

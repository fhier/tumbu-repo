'use client';

/**
 * S01 — Pusat siklus (Validated Baseline Wave 1).
 * Traceability: Doc 56 · Doc 62 · Screen S01 · Journey J2
 *
 * Membaca Formula Layer (sama S06). Tidak menghitung BOP/HPP/FCR/SR di UI.
 * Pakan hari ini = fakta event Feed hari ini.
 */

import { useEffect, useState } from 'react';
import { CYCLE_STATE_LABEL } from './aqua-shared';
import { cycleDayNumber } from './aqua-feed-s02.validate';
import {
  formatFcrPlanDeviation,
  fmtPct,
  srSignalNote,
  sumFeedKgToday,
  type FormulaSnapshotFe,
} from './aqua-formula-display';

type CycleCtx = {
  id: string;
  code: string;
  state: string;
  startedAt?: string | null;
  pond?: { code: string; name: string } | null;
  speciesProfile?: { name: string } | null;
};

type FeedRow = {
  quantityKg?: unknown;
  eventAt?: unknown;
  recordStatus?: unknown;
};

export type S01Action = 'feed' | 'mortality' | 'sampling' | 'harvest' | 'expense' | 'medicine';

export function AquaDashboardS01({
  cycle,
  formula,
  feeds,
  samplingCount,
  operate,
  busy,
  onAction,
  onNotify,
  onNavigate,
  compactWorkspaceHint,
  hidePrimaryCta,
}: {
  cycle: CycleCtx;
  formula: FormulaSnapshotFe | null;
  feeds: FeedRow[];
  samplingCount: number;
  operate: boolean;
  busy?: boolean;
  onAction: (a: S01Action) => void;
  onNotify?: (m: string) => void;
  onNavigate?: (key: string) => void;
  /** Optional strip when embedded on workspace dashboard */
  compactWorkspaceHint?: string;
  /** Hide duplicate CTA row when dashboard already shows quick actions */
  hidePrimaryCta?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [moreOpen]);

  const ctxLabel = [
    cycle.pond?.code || cycle.pond?.name,
    cycle.speciesProfile?.name,
  ]
    .filter(Boolean)
    .join(' · ') || cycle.code;

  const dayN = cycleDayNumber(cycle.startedAt);
  const stocked = formula?.facts?.stockedPcs;
  const feedToday = sumFeedKgToday(feeds);
  const hasFeedToday = feedToday > 0;
  const expenseCount = formula?.facts?.expenseCount ?? 0;
  const srPct = formula?.sr?.defined ? formula.sr.srPct : undefined;
  const srColor = formula?.colors?.sr;
  const plan = formatFcrPlanDeviation(formula);
  const stateLabel =
    cycle.state === 'ACTIVE' || cycle.state === 'HARVESTING'
      ? 'Berjalan'
      : CYCLE_STATE_LABEL[cycle.state] || cycle.state;

  const notices: Array<{ text: string; cta?: string; action?: S01Action }> = [];
  if (!hasFeedToday && (cycle.state === 'ACTIVE' || cycle.state === 'HARVESTING')) {
    notices.push({
      text: 'Belum ada pakan hari ini.',
      cta: 'Catat sekarang',
      action: 'feed',
    });
  }
  if (samplingCount === 0 && (cycle.state === 'ACTIVE' || cycle.state === 'HARVESTING')) {
    notices.push({
      text: 'Belum ada sampling.',
      cta: 'Catat sampling',
      action: 'sampling',
    });
  }
  if (expenseCount === 0) {
    notices.push({
      text: 'Belum ada biaya tercatat.',
      cta: 'Biaya',
      action: 'expense',
    });
  }

  const run = (a: S01Action) => {
    if (a === 'expense') {
      onNavigate?.('pengeluaran');
      setMoreOpen(false);
      return;
    }
    if (a === 'medicine') {
      onNotify?.('Fitur catat obat lengkap akan segera tersedia.');
      setMoreOpen(false);
      return;
    }
    onAction(a);
    setMoreOpen(false);
  };

  return (
    <section className="panel aqua-s02 aqua-s01" data-screen="S01" data-journey="J2">
      {compactWorkspaceHint ? (
        <p className="hint aqua-s01-ws-hint">{compactWorkspaceHint}</p>
      ) : null}

      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Pusat siklus</div>
        <div className="aqua-s02-sub">Status siklus aktif · satu pekerjaan utama hari ini</div>
      </div>

      <div className="aqua-s02-context">
        <div className="aqua-s02-id">{ctxLabel}</div>
        <span className="badge badge-lunas">{stateLabel}</span>
        <div className="aqua-s02-meta">
          {dayN != null ? (
            <span>
              Hari ke-<b>{dayN}</b>
            </span>
          ) : null}
          {stocked != null && stocked > 0 ? (
            <span>Tebar {Number(stocked).toLocaleString('id-ID')} ekor</span>
          ) : null}
        </div>
      </div>

      <h2 className="aqua-s02-title">Pusat siklus</h2>
      <p className="hint aqua-s02-lead">Cek cepat, lalu catat pekerjaan hari ini.</p>

      {notices.slice(0, 2).map((n) => (
        <div className="aqua-s01-notice" key={n.text}>
          <span className="aqua-s01-notice-text">{n.text}</span>
          {n.cta && n.action && operate ? (
            <button
              type="button"
              className="aqua-s01-notice-cta"
              disabled={busy}
              onClick={() => run(n.action!)}
            >
              {n.cta}
            </button>
          ) : null}
        </div>
      ))}

      <div className="aqua-s01-signals">
        <div className="aqua-s01-signal kpi-l1">
          <div className="k">Pakan hari ini</div>
          <div className="v">{hasFeedToday ? `${feedToday.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg` : '—'}</div>
          <div className="n">{hasFeedToday ? 'Dari catatan Feed' : 'Belum dicatat'}</div>
        </div>
        <div
          className={`aqua-s01-signal kpi-l2${
            srColor === 'YELLOW' || srColor === 'RED' ? ' warn' : ''
          }`}
        >
          <div className="k">Daya hidup (SR)</div>
          <div className="v">{fmtPct(srPct, 0)}</div>
          <div className="n">{(srColor ? srSignalNote(srColor) : '') || 'Dari catatan siklus'}</div>
        </div>
        <div className="aqua-s01-signal kpi-l3">
          <div className="k">vs rencana pakan</div>
          <div className="v">{plan.value}</div>
          <div className="n">{plan.note}</div>
        </div>
      </div>

      {operate && !hidePrimaryCta ? (
        <div className="aqua-s01-cta">
          <button
            type="button"
            className="aqua-s02-primary"
            disabled={busy}
            onClick={() => run('feed')}
          >
            Catat pakan
          </button>
          <button
            type="button"
            className="aqua-s04-secondary"
            disabled={busy}
            onClick={() => run('mortality')}
          >
            Catat kematian
          </button>
          <div className="aqua-s01-more">
            <button
              type="button"
              className="aqua-s01-more-btn"
              disabled={busy}
              aria-expanded={moreOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((v) => !v);
              }}
            >
              Lainnya <span aria-hidden>▼</span>
            </button>
            {moreOpen ? (
              <div className="aqua-s01-more-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" role="menuitem" onClick={() => run('sampling')}>
                  Sampling
                </button>
                <button type="button" role="menuitem" onClick={() => run('harvest')}>
                  Panen
                </button>
                <button type="button" role="menuitem" onClick={() => run('expense')}>
                  Biaya
                </button>
                <button type="button" role="menuitem" onClick={() => run('medicine')}>
                  Obat
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="hint">Mode baca — hanya lihat data, tidak bisa mencatat operasional.</p>
      )}

      <p className="hint aqua-s02-safe">
        SR &amp; vs rencana dari perhitungan siklus · Pakan hari ini dari catatan harian
        {formula?.computedAt
          ? ` · ${new Date(formula.computedAt).toLocaleString('id-ID')}`
          : ''}
      </p>
    </section>
  );
}

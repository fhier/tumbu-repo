'use client';

/**
 * S06 — Tutup & hasil (Validated Baseline).
 * Traceability: Doc 56 · Doc 62 · Screen S06 · Journey J5
 *
 * Close = tindakan eksplisit pengguna (POST .../events/close).
 * KPI = GET .../formula — derived only, bukan snapshot SoT.
 * Tidak mengubah formula · tidak auto-close dari Harvest · KL-001 tidak disentuh.
 */

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ApiFetch,
  CYCLE_STATE_LABEL,
  money,
  toEventAt,
} from './aqua-shared';
import { cycleDayNumber } from './aqua-feed-s02.validate';
import { printClosingReportPdf } from './print';

type CycleCtx = {
  id: string;
  code: string;
  state: string;
  startedAt?: string | null;
  closedAt?: string | null;
  pond?: { code: string; name: string } | null;
  speciesProfile?: { name: string } | null;
};

type FormulaSnapshot = {
  facts?: {
    harvestKg?: number;
    feedKg?: number;
    stockedPcs?: number;
    harvestedPcs?: number;
    revenue?: number;
  };
  bop?: { total?: number };
  hpp?: { hppPerKg?: number; defined?: boolean };
  fcr?: { fcr?: number; defined?: boolean };
  sr?: { srPct?: number; defined?: boolean };
  profit?: { grossProfit?: number; defined?: boolean };
  computedAt?: string;
};

function fmtNum(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('id-ID', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function AquaCloseS06({
  cycle,
  apiFetch,
  busy,
  onBusy,
  onNotify,
  onClosed,
  onBackToList,
  onCancel,
  manage,
}: {
  cycle: CycleCtx;
  apiFetch: ApiFetch;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onNotify?: (m: string) => void;
  /** After successful close — parent reloads cycle */
  onClosed: () => void | Promise<void>;
  onBackToList: () => void;
  onCancel: () => void;
  manage: boolean;
}) {
  const alreadyClosed = cycle.state === 'CLOSED';
  const [phase, setPhase] = useState<'confirm' | 'result'>(
    alreadyClosed ? 'result' : 'confirm',
  );
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState('');
  const [formula, setFormula] = useState<FormulaSnapshot | null>(null);
  const [formulaErr, setFormulaErr] = useState('');

  const ctxLabel = [
    cycle.pond?.code || cycle.pond?.name,
    cycle.speciesProfile?.name,
  ]
    .filter(Boolean)
    .join(' · ') || cycle.code;

  const dayN = cycleDayNumber(cycle.startedAt, cycle.closedAt ? new Date(cycle.closedAt) : new Date());

  const loadFormula = useCallback(async () => {
    setFormulaErr('');
    try {
      const f = await apiFetch<FormulaSnapshot>(
        `/budidaya/cycles/${cycle.id}/formula`,
      );
      setFormula(f);
    } catch (e) {
      setFormulaErr(e instanceof Error ? e.message : 'Gagal memuat KPI turunan.');
      setFormula(null);
    }
  }, [apiFetch, cycle.id]);

  useEffect(() => {
    if (phase === 'result' || alreadyClosed) {
      void loadFormula();
    }
  }, [phase, alreadyClosed, loadFormula]);

  const tryExitConfirm = () => {
    if (busy) return;
    if (notes.trim()) {
      const ok = window.confirm(
        'Ada catatan penutupan belum disimpan. Buang dan kembali tanpa menutup siklus?',
      );
      if (!ok) return;
    }
    onCancel();
  };

  const onConfirmClose = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!manage) {
      setLocalError('Hanya Owner/Admin yang dapat menutup siklus.');
      return;
    }
    if (cycle.state === 'CLOSED' || cycle.state === 'CANCELLED') {
      setLocalError('Siklus sudah terminal.');
      return;
    }
    if (
      !window.confirm(
        'Tutup siklus sekarang? Setelah ditutup, catat pakan/kematian/sampling/panen tidak dapat ditambah. KPI tetap dihitung ulang dari event (bukan disimpan sebagai kebenaran tetap).',
      )
    ) {
      return;
    }

    onBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycle.id}/events/close`, {
        method: 'POST',
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          eventAt: toEventAt(new Date().toISOString().slice(0, 16)) || undefined,
        }),
      });
      onNotify?.('Siklus ditutup secara eksplisit. Menampilkan hasil turunan…');
      await onClosed();
      setPhase('result');
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : 'Gagal menutup siklus.';
      setLocalError(msg);
      onNotify?.(msg);
    } finally {
      onBusy(false);
    }
  };

  if (phase === 'confirm' && !alreadyClosed) {
    return (
      <section className="panel aqua-s02 aqua-s06" data-screen="S06" data-journey="J5">
        <div className="aqua-s02-top">
          <div className="aqua-s02-who">Tutup & hasil</div>
          <div className="aqua-s02-sub">Momen penutupan — tindakan eksplisit Anda</div>
        </div>

        <div className="aqua-s02-context">
          <div className="aqua-s02-id">{ctxLabel}</div>
          <span className="badge">{CYCLE_STATE_LABEL[cycle.state] || cycle.state}</span>
          <div className="aqua-s02-meta">
            {dayN != null ? (
              <span>
                Hari ke-<b>{dayN}</b>
              </span>
            ) : null}
            <span>Belum ditutup — Close bukan efek samping panen</span>
          </div>
        </div>

        <h2 className="aqua-s02-title">Konfirmasi tutup siklus</h2>
        <p className="hint aqua-s02-lead">
          Setelah tutup, status menjadi <b>Selesai</b>. KPI di layar hasil dihitung dari catatan
          event (derived) — tidak disimpan sebagai state baru.
        </p>

        <form className="aqua-s02-form" onSubmit={(ev) => void onConfirmClose(ev)}>
          <label className="field">
            <span>
              Catatan penutupan <span className="opt">(opsional)</span>
            </span>
            <input
              type="text"
              placeholder="Mis. panen akhir selesai"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {localError ? <p className="aqua-s02-error">{localError}</p> : null}

          <div className="aqua-s02-actions">
            <button type="submit" className="aqua-s02-primary" disabled={busy || !manage}>
              {busy ? 'Menutup…' : 'Tutup siklus'}
            </button>
            <button type="button" className="aqua-s02-cancel" disabled={busy} onClick={tryExitConfirm}>
              Batal — kembali tanpa menutup
            </button>
          </div>
        </form>

        <p className="hint aqua-s02-safe">
          Safe Exit: jika ada catatan belum disimpan, konfirmasi sebelum keluar.
        </p>
      </section>
    );
  }

  const profitDefined = Boolean(formula?.profit?.defined);
  const profit = profitDefined ? formula?.profit?.grossProfit : undefined;
  const revenue = formula?.facts?.revenue;
  const harvestKg = formula?.facts?.harvestKg;
  const bop = formula?.bop?.total;
  const hpp = formula?.hpp?.defined ? formula.hpp.hppPerKg : undefined;
  const fcr = formula?.fcr?.defined ? formula.fcr.fcr : undefined;
  const sr = formula?.sr?.defined ? formula.sr.srPct : undefined;

  return (
    <section className="panel aqua-s02 aqua-s06" data-screen="S06" data-journey="J5">
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Tutup & hasil</div>
        <div className="aqua-s02-sub">Momen penutupan — bukan form harian</div>
      </div>

      <div className="aqua-s02-context">
        <div className="aqua-s02-id">{ctxLabel}</div>
        <span className="badge badge-lunas">Selesai</span>
        <div className="aqua-s02-meta">
          {dayN != null ? <span>{dayN} hari</span> : null}
          <span>Histori event tetap dapat dilihat</span>
        </div>
      </div>

      <div className="aqua-s06-status">
        <span className="badge badge-lunas">Selesai</span>
        <span className="aqua-s06-big">Siklus telah ditutup</span>
      </div>

      <h2 className="aqua-s02-title">Ringkasan hasil</h2>
      {formulaErr ? (
        <p className="aqua-s02-error">{formulaErr}</p>
      ) : (
        <>
          <p className="aqua-s06-verdict">
            {profit == null
              ? 'Laba/rugi belum dapat dihitung (perlu pendapatan & biaya di catatan).'
              : profit >= 0
                ? `Untung ${money(profit)}`
                : `Rugi ${money(Math.abs(profit))}`}
          </p>
          <p className="aqua-s06-harvest">
            Panen {fmtNum(harvestKg, 1)} kg · dihitung dari catatan Anda
          </p>
        </>
      )}

      <p className="aqua-s06-section">KPI utama</p>
      <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
        Derived dari event · dihitung ulang saat dibuka
        {formula?.computedAt
          ? ` · ${new Date(formula.computedAt).toLocaleString('id-ID')}`
          : ''}
      </p>
      <div className="aqua-s06-kpi">
        <div className="aqua-s06-metric">
          <div className="k">Total biaya (BOP)</div>
          <div className="v">{bop == null ? '—' : money(bop)}</div>
        </div>
        <div className="aqua-s06-metric">
          <div className="k">Biaya per kg (HPP)</div>
          <div className="v">{hpp == null ? '—' : money(hpp)}</div>
        </div>
        <div className="aqua-s06-metric">
          <div className="k">Efisiensi pakan (FCR)</div>
          <div className="v">{fcr == null ? '—' : fmtNum(fcr, 2)}</div>
        </div>
        <div className="aqua-s06-metric">
          <div className="k">Daya hidup (SR)</div>
          <div className="v">{sr == null ? '—' : `${fmtNum(sr, 1)}%`}</div>
        </div>
      </div>

      <p className="aqua-s06-section">Langkah berikutnya</p>
      <div className="aqua-s02-actions">
        <button
          type="button"
          className="aqua-s02-primary"
          onClick={() => {
            onNotify?.(
              'Kembali ke daftar untuk memulai siklus baru pada kolam yang tersedia.',
            );
            onBackToList();
          }}
        >
          Mulai siklus baru
        </button>
        <button
          type="button"
          className="aqua-s04-secondary"
          style={{ fontWeight: 'bold', color: '#0EA5E9', border: '1px solid #0EA5E9' }}
          onClick={() => {
            printClosingReportPdf({
              periodLabel: cycle.code,
              date: new Date().toLocaleDateString('id-ID'),
              workspaceName: ctxLabel,
              totalPenjualan: revenue || 0,
              totalPembelian: bop || 0,
              totalBiayaOperasional: 0,
              labaRugiBersih: profit || 0,
              notes: `Closing siklus ${cycle.code} (${ctxLabel}). ${notes || 'Semua variabel panen dan pakan terkunci.'}`
            });
            onNotify?.('PDF Laporan Tutup Buku siap.');
          }}
        >
          🖨️ Cetak Laporan Closing (PDF)
        </button>
        <button type="button" className="aqua-s04-secondary" onClick={onBackToList}>
          Kembali ke daftar siklus
        </button>
      </div>

      <p className="hint aqua-s02-safe">
        Pasca-tutup: Feed / Mortality / Sampling / Harvest ditolak oleh guard domain. Histori tetap
        terbaca di linimasa.
      </p>
    </section>
  );
}

'use client';

/**
 * S04 — Sampling (Validated Baseline).
 * Traceability: Doc 56 · Doc 62 · Screen S04 · Journey J3 (Doc 61)
 * API: POST /budidaya/cycles/:cycleId/events/sampling
 *
 * Insight = derived only — tidak disimpan ke DB / bukan keputusan sistem.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiFetch,
  CYCLE_STATE_LABEL,
  stateBadgeClass,
  toEventAt,
} from './aqua-shared';
import { cycleDayNumber } from './aqua-feed-s02.validate';
import {
  deriveSamplingInsight,
  isSamplingFormDirty,
  isTerminalCycleState,
  validateSamplingS04,
} from './aqua-sampling-s04.validate';
import {
  clearAquaDraft,
  isNetworkError,
  loadAquaDraft,
  networkDraftMessage,
  saveAquaDraft,
} from './aqua-form-draft';

type CycleCtx = {
  id: string;
  code: string;
  state: string;
  startedAt?: string | null;
  targetWeightGram?: number | string | null;
  pond?: { code: string; name: string } | null;
  speciesProfile?: { name: string } | null;
};

function toDatetimeLocalValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AquaSamplingS04({
  cycle,
  apiFetch,
  busy,
  onBusy,
  onNotify,
  onSaved,
  onCancel,
  onGoFeed,
}: {
  cycle: CycleCtx;
  apiFetch: ApiFetch;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onNotify?: (m: string) => void;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
  onGoFeed?: () => void;
}) {
  const defaultEventAt = useMemo(() => toDatetimeLocalValue(), []);
  const [averageWeightGram, setAverageWeightGram] = useState('');
  const [sampleCountPcs, setSampleCountPcs] = useState('');
  const [eventAtLocal, setEventAtLocal] = useState(defaultEventAt);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const [draftHint, setDraftHint] = useState('');

  useEffect(() => {
    const draft = loadAquaDraft<{
      averageWeightGram: string;
      sampleCountPcs: string;
      eventAtLocal: string;
      selectedChip: string | null;
    }>('S04', cycle.id);
    if (!draft) return;
    if (draft.averageWeightGram) setAverageWeightGram(draft.averageWeightGram);
    if (draft.sampleCountPcs) setSampleCountPcs(draft.sampleCountPcs);
    if (draft.eventAtLocal) setEventAtLocal(draft.eventAtLocal);
    if (draft.selectedChip) setSelectedChip(draft.selectedChip);
    setDraftHint('Draft lokal dipulihkan — periksa isian sebelum menyimpan.');
  }, [cycle.id]);

  const dayN = cycleDayNumber(cycle.startedAt);
  const bench =
    cycle.targetWeightGram != null && cycle.targetWeightGram !== ''
      ? Number(cycle.targetWeightGram)
      : null;

  const measuredNum = Number(String(averageWeightGram).trim().replace(',', '.'));
  const insight =
    averageWeightGram.trim() !== '' && Number.isFinite(measuredNum) && measuredNum > 0
      ? deriveSamplingInsight({
          averageWeightGram: measuredNum,
          targetWeightGram: bench,
          dayNumber: dayN,
        })
      : null;

  const ctxLabel = [
    cycle.pond?.code || cycle.pond?.name,
    cycle.speciesProfile?.name,
  ]
    .filter(Boolean)
    .join(' · ') || cycle.code;

  const dirty = isSamplingFormDirty({
    averageWeightGram,
    sampleCountPcs,
    eventAtLocal,
    defaultEventAtLocal: defaultEventAt,
  });

  useEffect(() => {
    if (!dirty) return;
    saveAquaDraft('S04', cycle.id, {
      averageWeightGram,
      sampleCountPcs,
      eventAtLocal,
      selectedChip,
    });
  }, [cycle.id, dirty, averageWeightGram, sampleCountPcs, eventAtLocal, selectedChip]);

  const tryExit = () => {
    if (busy) return;
    if (dirty) {
      const ok = window.confirm(
        'Ada isian yang belum disimpan. Buang perubahan dan kembali ke pusat siklus?',
      );
      if (!ok) return;
    }
    onCancel();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const err = validateSamplingS04({
      averageWeightGram,
      cycleState: cycle.state,
      sampleCountPcs,
    });
    if (err) {
      setLocalError(err);
      onNotify?.(err);
      return;
    }

    onBusy(true);
    try {
      const payload: Record<string, unknown> = {
        averageWeightGram: Number(String(averageWeightGram).trim().replace(',', '.')),
        eventAt: toEventAt(eventAtLocal) || undefined,
      };
      if (sampleCountPcs.trim() !== '') {
        payload.sampleCountPcs = Number(String(sampleCountPcs).trim().replace(',', '.'));
      }
      // Insight / chip selection intentionally NOT sent — derived only, not SoT
      await apiFetch(`/budidaya/cycles/${cycle.id}/events/sampling`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onNotify?.('Sampling tercatat. Insight tidak disimpan — dapat dihitung ulang kapan saja.');
      clearAquaDraft('S04', cycle.id);
      setDraftHint('');
      await onSaved();
    } catch (ex) {
      saveAquaDraft('S04', cycle.id, {
        averageWeightGram,
        sampleCountPcs,
        eventAtLocal,
        selectedChip,
      });
      const msg = isNetworkError(ex)
        ? networkDraftMessage()
        : ex instanceof Error
          ? ex.message
          : 'Gagal mencatat sampling.';
      setLocalError(msg);
      onNotify?.(msg);
    } finally {
      onBusy(false);
    }
  };

  if (isTerminalCycleState(cycle.state)) {
    return (
      <section className="panel aqua-s02 aqua-s04">
        <p className="empty-state">
          Tidak bisa mencatat sampling pada siklus yang sudah ditutup atau dibatalkan.
        </p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Kembali ke pusat siklus
        </button>
      </section>
    );
  }

  return (
    <section className="panel aqua-s02 aqua-s04" data-screen="S04" data-journey="J3">
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Sampling</div>
        <div className="aqua-s02-sub">Bantu berpikir — keputusan tetap di Anda</div>
      </div>

      <div className="aqua-s02-context" aria-label="Konteks siklus">
        <div className="aqua-s02-id">{ctxLabel}</div>
        <span className={`badge ${stateBadgeClass(cycle.state)}`}>
          {CYCLE_STATE_LABEL[cycle.state] || cycle.state}
        </span>
        <div className="aqua-s02-meta">
          {dayN != null ? (
            <span>
              Hari ke-<b>{dayN}</b>
            </span>
          ) : null}
          {bench != null && Number.isFinite(bench) ? (
            <span>
              Patokan ~<b>{bench}</b> g
            </span>
          ) : (
            <span>Patokan belum diisi di rencana</span>
          )}
        </div>
      </div>

      <h2 className="aqua-s02-title">Sampling</h2>
      <p className="hint aqua-s02-lead">Input → Ringkasan → Arti → Keputusan</p>

      <form className="aqua-s04-flow" onSubmit={(e) => void onSubmit(e)}>
        <div className="aqua-s04-step">
          <div className="aqua-s04-step-h">
            <span className="aqua-s04-n">1</span>
            <span>Input</span>
          </div>
          <div className="aqua-s04-step-b">
            <label className="field aqua-s02-hero">
              <span>Berat rata-rata sampel (gram)</span>
              <input
                name="averageWeightGram"
                type="text"
                inputMode="decimal"
                placeholder="Mis. 118"
                value={averageWeightGram}
                disabled={busy}
                autoFocus
                onChange={(e) => setAverageWeightGram(e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Jumlah sampel <span className="opt">(opsional)</span>
              </span>
              <input
                name="sampleCountPcs"
                type="text"
                inputMode="numeric"
                value={sampleCountPcs}
                disabled={busy}
                onChange={(e) => setSampleCountPcs(e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Waktu kejadian <span className="opt">(log harian)</span>
              </span>
              <input
                name="eventAt"
                type="datetime-local"
                value={eventAtLocal}
                disabled={busy}
                onChange={(e) => setEventAtLocal(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="aqua-s04-step">
          <div className="aqua-s04-step-h">
            <span className="aqua-s04-n">2</span>
            <span>Ringkasan</span>
          </div>
          <div className="aqua-s04-step-b">
            {insight ? (
              <p className={`aqua-s04-summary tone-${insight.tone}`}>{insight.summary}</p>
            ) : (
              <p className="hint">Isi berat sampel untuk melihat ringkasan.</p>
            )}
          </div>
        </div>

        <div className="aqua-s04-step">
          <div className="aqua-s04-step-h">
            <span className="aqua-s04-n">3</span>
            <span>Arti</span>
          </div>
          <div className="aqua-s04-step-b">
            {insight ? (
              <div className="aqua-s04-insight">
                <div className="aqua-s04-insight-h">Untuk dipertimbangkan</div>
                <div className="aqua-s04-insight-t">{insight.meaning}</div>
              </div>
            ) : (
              <p className="hint">Arti muncul setelah input valid — bukan perintah sistem.</p>
            )}
          </div>
        </div>

        <div className="aqua-s04-step">
          <div className="aqua-s04-step-h">
            <span className="aqua-s04-n">4</span>
            <span>Keputusan (Anda yang memilih)</span>
          </div>
          <div className="aqua-s04-step-b">
            <div className="aqua-s04-chips" role="group" aria-label="Bantuan berpikir">
              {(insight?.chips || [
                'Pertahankan pakan',
                'Perlu evaluasi pakan?',
                'Pertimbangkan panen',
              ]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`aqua-s04-chip${selectedChip === c ? ' on' : ''}`}
                  disabled={busy}
                  onClick={() => setSelectedChip(c === selectedChip ? null : c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="hint">Chip hanya membantu berpikir — tidak dijalankan otomatis.</p>
          </div>
        </div>

        {draftHint ? <p className="aqua-draft-hint">{draftHint}</p> : null}
        {localError ? <p className="aqua-s02-error" role="alert">{localError}</p> : null}

        <div className="aqua-s02-actions">
          <button type="submit" className="aqua-s02-primary" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan sampling'}
          </button>
          {onGoFeed ? (
            <button
              type="button"
              className="aqua-s04-secondary"
              disabled={busy}
              onClick={() => {
                if (dirty) {
                  const ok = window.confirm(
                    'Ada isian sampling belum disimpan. Pindah ke Catat pakan tanpa menyimpan?',
                  );
                  if (!ok) return;
                }
                onGoFeed();
              }}
            >
              Catat pakan
            </button>
          ) : null}
          <button type="button" className="aqua-s02-cancel" disabled={busy} onClick={tryExit}>
            Kembali ke pusat siklus
          </button>
        </div>
      </form>

      <p className="hint aqua-s02-safe">
        Safe Exit sama seperti Catat pakan. Insight tidak disimpan ke database.
      </p>
    </section>
  );
}

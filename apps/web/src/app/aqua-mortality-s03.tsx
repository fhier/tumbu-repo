'use client';

/**
 * S03 — Catat Kematian (Validated Baseline).
 * Traceability: Doc 56 · Doc 62 · Screen S03 · Journey J2
 * API: POST /budidaya/cycles/:cycleId/events/mortality (kontrak existing)
 *
 * "+ Catat pengobatan" = aksi lanjutan (bukan S11 penuh).
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
  isMortalityFormDirty,
  isTerminalCycleState,
  validateMortalityS03,
} from './aqua-mortality-s03.validate';
import { buildPopulationInsight } from './aqua-population-advisor';
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
  pond?: { code: string; name: string } | null;
  speciesProfile?: { name: string } | null;
};

function toDatetimeLocalValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AquaMortalityS03({
  cycle,
  activePcs,
  stockedPcs,
  deadPcs,
  harvestedPcs,
  avgWeightGram,
  targetFcr,
  targetSrPct,
  apiFetch,
  busy,
  onBusy,
  onNotify,
  onSaved,
  onCancel,
}: {
  cycle: CycleCtx;
  activePcs: number;
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
  avgWeightGram?: number | null;
  targetFcr?: number | null;
  targetSrPct?: number | null;
  apiFetch: ApiFetch;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onNotify?: (m: string) => void;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const defaultEventAt = useMemo(() => toDatetimeLocalValue(), []);
  const [deadCountPcs, setDeadCountPcs] = useState('');
  const [notes, setNotes] = useState('');
  const [eventAtLocal, setEventAtLocal] = useState(defaultEventAt);
  const [localError, setLocalError] = useState('');
  const [draftHint, setDraftHint] = useState('');

  useEffect(() => {
    const draft = loadAquaDraft<{
      deadCountPcs: string;
      notes: string;
      eventAtLocal: string;
    }>('S03', cycle.id);
    if (!draft) return;
    if (draft.deadCountPcs) setDeadCountPcs(draft.deadCountPcs);
    if (draft.notes) setNotes(draft.notes);
    if (draft.eventAtLocal) setEventAtLocal(draft.eventAtLocal);
    setDraftHint('Draft lokal dipulihkan — periksa isian sebelum menyimpan.');
  }, [cycle.id]);

  const dayN = cycleDayNumber(cycle.startedAt);
  const ctxLabel = [
    cycle.pond?.code || cycle.pond?.name,
    cycle.speciesProfile?.name,
  ]
    .filter(Boolean)
    .join(' · ') || cycle.code;

  const pendingDead = deadCountPcs.trim()
    ? Number(String(deadCountPcs).trim().replace(',', '.'))
    : 0;
  const insight = useMemo(
    () => buildPopulationInsight(
      {
        stockedPcs,
        deadPcs,
        harvestedPcs,
        pendingDeadPcs: Number.isFinite(pendingDead) && pendingDead > 0 ? pendingDead : 0,
      },
      { avgWeightGram, targetFcr, targetSrPct },
    ),
    [stockedPcs, deadPcs, harvestedPcs, pendingDead, avgWeightGram, targetFcr, targetSrPct],
  );

  const dirty = isMortalityFormDirty({
    deadCountPcs,
    notes,
    eventAtLocal,
    defaultEventAtLocal: defaultEventAt,
  });

  useEffect(() => {
    if (!dirty) return;
    saveAquaDraft('S03', cycle.id, { deadCountPcs, notes, eventAtLocal });
  }, [cycle.id, dirty, deadCountPcs, notes, eventAtLocal]);

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
    const eventAtIso = toEventAt(eventAtLocal) || undefined;
    const err = validateMortalityS03({
      deadCountPcs,
      cycleState: cycle.state,
      activePcs,
      eventAtIso,
    });
    if (err) {
      setLocalError(err);
      onNotify?.(err);
      return;
    }

    const qty = Number(String(deadCountPcs).trim().replace(',', '.'));
    if (activePcs > 0 && qty > activePcs * 0.5) {
      const ok = window.confirm(
        `Jumlah kematian (${qty.toLocaleString('id-ID')} ekor) cukup besar vs populasi aktif (${activePcs.toLocaleString('id-ID')}). Yakin lanjut simpan?`,
      );
      if (!ok) return;
    }

    onBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycle.id}/events/mortality`, {
        method: 'POST',
        body: JSON.stringify({
          deadCountPcs: Number(String(deadCountPcs).trim().replace(',', '.')),
          notes: notes.trim() || undefined,
          eventAt: eventAtIso,
        }),
      });
      onNotify?.('Kematian tercatat. Populasi aktif diperbarui dari jejak event.');
      clearAquaDraft('S03', cycle.id);
      setDraftHint('');
      await onSaved();
    } catch (ex) {
      saveAquaDraft('S03', cycle.id, { deadCountPcs, notes, eventAtLocal });
      const msg = isNetworkError(ex)
        ? networkDraftMessage()
        : ex instanceof Error
          ? ex.message
          : 'Gagal mencatat kematian.';
      setLocalError(msg);
      onNotify?.(msg);
    } finally {
      onBusy(false);
    }
  };

  const onMedicineHint = () => {
    if (dirty) {
      const ok = window.confirm(
        'Ada isian kematian belum disimpan. Tetap buka catatan pengobatan nanti tanpa menyimpan kematian?',
      );
      if (!ok) return;
    }
    onNotify?.(
      'Catat pengobatan tersedia sebagai aksi lanjutan — modul obat lengkap akan segera hadir.',
    );
  };

  if (isTerminalCycleState(cycle.state)) {
    return (
      <section className="panel aqua-s02 aqua-s03">
        <p className="empty-state">
          Tidak bisa mencatat kematian pada siklus yang sudah ditutup atau dibatalkan.
        </p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Kembali ke pusat siklus
        </button>
      </section>
    );
  }

  return (
    <section className="panel aqua-s02 aqua-s03" data-screen="S03" data-journey="J2">
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Catat kematian</div>
        <div className="aqua-s02-sub">Daya hidup tetap jujur</div>
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
          <span>Tertaut ke siklus ini</span>
          <span>
            Populasi aktif ≈ <b>{insight.activePcs.toLocaleString('id-ID')}</b> ekor
            {pendingDead > 0 ? ' (preview)' : ''}
          </span>
        </div>
      </div>

      <h2 className="aqua-s02-title">Catat kematian</h2>
      <p className="hint aqua-s02-lead">
        Budget: isi jumlah → Simpan. Bukan diagnosa penyakit.
      </p>

      <form className="aqua-s02-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="field aqua-s02-hero">
          <span>Jumlah ikan mati (ekor)</span>
          <input
            name="deadCountPcs"
            type="text"
            inputMode="numeric"
            placeholder="Masukkan jumlah ekor"
            value={deadCountPcs}
            disabled={busy}
            autoFocus
            onChange={(e) => setDeadCountPcs(e.target.value)}
            aria-required
          />
        </label>

        <div className="cycle-estimate-card mortality-insight">
          <h3>Prediksi real-time</h3>
          <div className="cycle-estimate-grid">
            <div>
              <span>SR berjalan</span>
              <strong>{insight.runningSrPct != null ? `${insight.runningSrPct}%` : '—'}</strong>
              <small>{insight.srNote}</small>
            </div>
            <div>
              <span>Sisa biomassa aktif</span>
              <strong>{insight.biomassKg != null ? `${insight.biomassKg} kg` : '—'}</strong>
              <small>{avgWeightGram ? `@ ${avgWeightGram} g/ekor` : 'Butuh berat rata sampling'}</small>
            </div>
            <div>
              <span>Rekomendasi pakan/hari</span>
              <strong>{insight.dailyFeedKg != null ? `${insight.dailyFeedKg} kg` : '—'}</strong>
              <small>{insight.feedNote}</small>
            </div>
          </div>
        </div>

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

        <label className="field">
          <span>
            Catatan <span className="opt">(opsional)</span>
          </span>
          <input
            name="notes"
            type="text"
            placeholder="Mis. ditemukan pagi"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {draftHint ? <p className="aqua-draft-hint">{draftHint}</p> : null}
        {localError ? <p className="aqua-s02-error" role="alert">{localError}</p> : null}

        <div className="aqua-s02-actions">
          <button type="submit" className="aqua-s02-primary" disabled={busy || activePcs <= 0}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button
            type="button"
            className="aqua-s02-add-cost"
            disabled={busy}
            onClick={onMedicineHint}
          >
            + Catat pengobatan
          </button>
          <button type="button" className="aqua-s02-cancel" disabled={busy} onClick={tryExit}>
            Batal
          </button>
        </div>
      </form>

      <p className="hint aqua-s02-safe">
        Safe Exit sama seperti Catat pakan. Setelah simpan → Pusat siklus.
        Gejala penyakit? Buka menu <b>P3K Ikan / Penyakit</b> di sidebar.
      </p>
    </section>
  );
}

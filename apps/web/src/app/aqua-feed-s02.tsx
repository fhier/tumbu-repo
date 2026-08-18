'use client';

/**
 * S02 — Catat Pakan (Validated Baseline alignment).
 * Traceability: Doc 56 · Doc 62 · Screen S02 · Journey J2
 * API: POST /budidaya/cycles/:cycleId/events/feed (kontrak existing)
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiFetch,
  CYCLE_STATE_LABEL,
  stateBadgeClass,
  toEventAt,
} from './aqua-shared';
import {
  buildFeedS02Payload,
  cycleDayNumber,
  isFeedFormDirty,
  isTerminalCycleState,
  validateFeedS02,
} from './aqua-feed-s02.validate';
import {
  clearAquaDraft,
  isNetworkError,
  loadAquaDraft,
  networkDraftMessage,
  saveAquaDraft,
} from './aqua-form-draft';

type FeedOpt = { id: string; name: string; unit: string; isActive: boolean };

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

function defaultFeedTypeId(
  feeds: FeedOpt[],
  recentFeedTypeId?: string | null,
): string {
  if (recentFeedTypeId && feeds.some((f) => f.id === recentFeedTypeId)) {
    return recentFeedTypeId;
  }
  return feeds[0]?.id || '';
}

export function AquaFeedS02({
  cycle,
  feeds,
  recentFeedTypeId,
  apiFetch,
  busy,
  onBusy,
  onNotify,
  onSaved,
  onCancel,
}: {
  cycle: CycleCtx;
  feeds: FeedOpt[];
  recentFeedTypeId?: string | null;
  apiFetch: ApiFetch;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onNotify?: (m: string) => void;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const defaultFt = useMemo(
    () => defaultFeedTypeId(feeds, recentFeedTypeId),
    [feeds, recentFeedTypeId],
  );
  const defaultEventAt = useMemo(() => toDatetimeLocalValue(), []);

  const [quantityKg, setQuantityKg] = useState('');
  const [feedTypeId, setFeedTypeId] = useState(defaultFt);
  const [eventAtLocal, setEventAtLocal] = useState(defaultEventAt);
  const [showCost, setShowCost] = useState(false);
  const [totalCost, setTotalCost] = useState('');
  const [localError, setLocalError] = useState('');
  const [draftHint, setDraftHint] = useState('');

  useEffect(() => {
    const draft = loadAquaDraft<{
      quantityKg: string;
      feedTypeId: string;
      eventAtLocal: string;
      showCost: boolean;
      totalCost: string;
    }>('S02', cycle.id);
    if (!draft) return;
    if (draft.quantityKg) setQuantityKg(draft.quantityKg);
    if (draft.feedTypeId) setFeedTypeId(draft.feedTypeId);
    if (draft.eventAtLocal) setEventAtLocal(draft.eventAtLocal);
    if (draft.showCost) setShowCost(true);
    if (draft.totalCost) setTotalCost(draft.totalCost);
    setDraftHint('Draft lokal dipulihkan — periksa isian sebelum menyimpan.');
  }, [cycle.id]);

  const dayN = cycleDayNumber(cycle.startedAt);
  const ctxLabel = [
    cycle.pond?.code || cycle.pond?.name,
    cycle.speciesProfile?.name,
  ]
    .filter(Boolean)
    .join(' · ') || cycle.code;

  const dirty = isFeedFormDirty({
    quantityKg,
    feedTypeId,
    defaultFeedTypeId: defaultFt,
    showCost,
    totalCost,
    eventAtLocal,
    defaultEventAtLocal: defaultEventAt,
  });

  useEffect(() => {
    if (!dirty) return;
    saveAquaDraft('S02', cycle.id, {
      quantityKg,
      feedTypeId,
      eventAtLocal,
      showCost,
      totalCost,
    });
  }, [cycle.id, dirty, quantityKg, feedTypeId, eventAtLocal, showCost, totalCost]);

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
    const built = buildFeedS02Payload({
      quantityKg,
      cycleState: cycle.state,
      eventAtIso,
      showCost,
      totalCost,
      feedTypeId: feedTypeId || defaultFt,
    });
    if (!built.ok) {
      setLocalError(built.error);
      onNotify?.(built.error);
      return;
    }

    onBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycle.id}/events/feed`, {
        method: 'POST',
        body: JSON.stringify(built.payload),
      });
      onNotify?.('Pakan tercatat.');
      clearAquaDraft('S02', cycle.id);
      setDraftHint('');
      await onSaved();
    } catch (ex) {
      saveAquaDraft('S02', cycle.id, {
        quantityKg,
        feedTypeId,
        eventAtLocal,
        showCost,
        totalCost,
      });
      const msg = isNetworkError(ex)
        ? networkDraftMessage()
        : ex instanceof Error
          ? ex.message
          : 'Gagal mencatat pakan.';
      setLocalError(msg);
      onNotify?.(msg);
    } finally {
      onBusy(false);
    }
  };

  if (isTerminalCycleState(cycle.state)) {
    return (
      <section className="panel aqua-s02">
        <p className="empty-state">
          Tidak bisa mencatat pakan pada siklus yang sudah ditutup atau dibatalkan.
        </p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Kembali ke pusat siklus
        </button>
      </section>
    );
  }

  return (
    <section className="panel aqua-s02" data-screen="S02" data-journey="J2">
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Catat pakan</div>
        <div className="aqua-s02-sub">Tanpa pilih ulang siklus</div>
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
        </div>
      </div>

      <h2 className="aqua-s02-title">Catat pakan</h2>
      <p className="hint aqua-s02-lead">
        Budget: isi jumlah → Simpan. Waktu default sekarang.
      </p>

      <form className="aqua-s02-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="field aqua-s02-hero">
          <span>Jumlah pakan (kg)</span>
          <input
            name="quantityKg"
            type="text"
            inputMode="decimal"
            placeholder="Masukkan kg pakan"
            value={quantityKg}
            disabled={busy}
            autoFocus
            onChange={(e) => setQuantityKg(e.target.value)}
            aria-required
          />
          <span className="hint">
            Wajib — satu-satunya keputusan utama selain Simpan. Contoh: 15
          </span>
        </label>

        <label className="field">
          <span>
            Tanggal &amp; waktu catat pakan <span className="opt">(default sekarang)</span>
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
            Jenis pakan <span className="opt">(opsional)</span>
          </span>
          <select
            name="feedTypeId"
            value={feedTypeId}
            disabled={busy || !feeds.length}
            onChange={(e) => setFeedTypeId(e.target.value)}
          >
            {!feeds.length ? <option value="">Belum ada jenis pakan</option> : null}
            {feeds.map((ft) => (
              <option key={ft.id} value={ft.id}>
                {ft.name}
                {ft.id === defaultFt && recentFeedTypeId === ft.id
                  ? ' (terakhir dipakai)'
                  : ft.id === defaultFt
                    ? ' (default)'
                    : ''}
              </option>
            ))}
          </select>
        </label>

        {!showCost ? (
          <button
            type="button"
            className="aqua-s02-add-cost"
            disabled={busy}
            onClick={() => setShowCost(true)}
          >
            + Tambahkan biaya
          </button>
        ) : (
          <label className="field">
            <span>
              Biaya <span className="opt">(opsional)</span>
            </span>
            <input
              name="totalCost"
              type="text"
              inputMode="decimal"
              placeholder="Nominal biaya pakan"
              value={totalCost}
              disabled={busy}
              onChange={(e) => setTotalCost(e.target.value)}
            />
          </label>
        )}

        {!feeds.length ? (
          <p className="hint">
            Belum ada jenis pakan. Tambahkan di menu Master → Jenis pakan sebelum menyimpan.
          </p>
        ) : null}

        {draftHint ? <p className="aqua-draft-hint">{draftHint}</p> : null}
        {localError ? <p className="aqua-s02-error" role="alert">{localError}</p> : null}

        <div className="aqua-s02-actions">
          <button type="submit" className="aqua-s02-primary" disabled={busy || !feeds.length}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button type="button" className="aqua-s02-cancel" disabled={busy} onClick={tryExit}>
            Batal — kembali ke pusat siklus
          </button>
        </div>
      </form>

      <p className="hint aqua-s02-safe">
        Safe Exit: jika ada isian belum disimpan, konfirmasi buang perubahan.
      </p>
    </section>
  );
}

/** Re-export for tests / callers */
export { validateFeedS02, buildFeedS02Payload };

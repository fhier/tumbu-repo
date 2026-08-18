'use client';

/**
 * S05 — Panen & penjualan (Validated Baseline).
 * Traceability: Doc 56 · Doc 62 · Screen S05 · Journey J4
 * API: POST /budidaya/cycles/:cycleId/events/harvest
 *
 * D1: "Siap ditutup" = UI only (panen akhir). Domain state tetap HARVESTING setelah panen.
 * Panen akhir TIDAK auto-close (S06 terpisah).
 * KL-003: quantityPcs wajib.
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
  HarvestMode,
  isHarvestFormDirty,
  isTerminalCycleState,
  validateHarvestS05,
} from './aqua-harvest-s05.validate';
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

export function AquaHarvestS05({
  cycle,
  activePcs,
  apiFetch,
  busy,
  onBusy,
  onNotify,
  onSavedPartial,
  onContinueToClose,
  onCancel,
}: {
  cycle: CycleCtx;
  activePcs: number;
  apiFetch: ApiFetch;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onNotify?: (m: string) => void;
  /** Panen sebagian → kembali ke pusat siklus */
  onSavedPartial: () => void | Promise<void>;
  /** Panen akhir → lanjut entry Tutup S06 (bukan auto-close) */
  onContinueToClose: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const defaultEventAt = useMemo(() => toDatetimeLocalValue(), []);
  const [mode, setMode] = useState<HarvestMode>('partial');
  const [quantityKg, setQuantityKg] = useState('');
  const [quantityPcs, setQuantityPcs] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [eventAtLocal, setEventAtLocal] = useState(defaultEventAt);
  const [localError, setLocalError] = useState('');
  const [draftHint, setDraftHint] = useState('');

  useEffect(() => {
    const draft = loadAquaDraft<{
      mode: HarvestMode;
      quantityKg: string;
      quantityPcs: string;
      saleValue: string;
      eventAtLocal: string;
    }>('S05', cycle.id);
    if (!draft) return;
    if (draft.mode) setMode(draft.mode);
    if (draft.quantityKg) setQuantityKg(draft.quantityKg);
    if (draft.quantityPcs) setQuantityPcs(draft.quantityPcs);
    if (draft.saleValue) setSaleValue(draft.saleValue);
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

  const dirty = isHarvestFormDirty({
    quantityKg,
    quantityPcs,
    saleValue,
    eventAtLocal,
    defaultEventAtLocal: defaultEventAt,
  });

  useEffect(() => {
    if (!dirty) return;
    saveAquaDraft('S05', cycle.id, {
      mode,
      quantityKg,
      quantityPcs,
      saleValue,
      eventAtLocal,
    });
  }, [cycle.id, dirty, mode, quantityKg, quantityPcs, saleValue, eventAtLocal]);

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
    const err = validateHarvestS05({
      quantityKg,
      quantityPcs,
      cycleState: cycle.state,
      activePcs,
      saleValue,
    });
    if (err) {
      setLocalError(err);
      onNotify?.(err);
      return;
    }

    const kg = Number(String(quantityKg).trim().replace(',', '.'));
    const pcs = Number(String(quantityPcs).trim().replace(',', '.'));
    let notes: string | undefined;
    if (saleValue.trim()) {
      notes = `Nilai penjualan (catatan): ${saleValue.trim()}`;
    }
    if (mode === 'final') {
      notes = [notes, 'Jenis UI: panen akhir (indikasi siap ditutup — bukan state domain)']
        .filter(Boolean)
        .join(' · ');
    } else {
      notes = [notes, 'Jenis UI: panen sebagian']
        .filter(Boolean)
        .join(' · ');
    }

    onBusy(true);
    try {
      await apiFetch(`/budidaya/cycles/${cycle.id}/events/harvest`, {
        method: 'POST',
        body: JSON.stringify({
          quantityKg: kg,
          quantityPcs: pcs,
          eventAt: toEventAt(eventAtLocal) || undefined,
          notes,
        }),
      });
      if (mode === 'partial') {
        onNotify?.(
          'Panen sebagian tercatat. Pemeliharaan masih berlanjut. Populasi aktif diperbarui.',
        );
        clearAquaDraft('S05', cycle.id);
        setDraftHint('');
        await onSavedPartial();
      } else {
        onNotify?.(
          'Panen akhir tercatat. Domain: Panen berlangsung — belum ditutup. Lanjut Tutup siklus secara sadar.',
        );
        clearAquaDraft('S05', cycle.id);
        setDraftHint('');
        await onContinueToClose();
      }
    } catch (ex) {
      saveAquaDraft('S05', cycle.id, {
        mode,
        quantityKg,
        quantityPcs,
        saleValue,
        eventAtLocal,
      });
      const msg = isNetworkError(ex)
        ? networkDraftMessage()
        : ex instanceof Error
          ? ex.message
          : 'Gagal mencatat panen.';
      setLocalError(msg);
      onNotify?.(msg);
    } finally {
      onBusy(false);
    }
  };

  if (isTerminalCycleState(cycle.state)) {
    return (
      <section className="panel aqua-s02 aqua-s05">
        <p className="empty-state">Tidak bisa mencatat panen pada siklus terminal.</p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Kembali
        </button>
      </section>
    );
  }

  const isFinal = mode === 'final';

  return (
    <section
      className={`panel aqua-s02 aqua-s05${isFinal ? ' shell-final' : ' shell-partial'}`}
      data-screen="S05"
      data-journey="J4"
      data-harvest-mode={mode}
    >
      <div className="aqua-s02-top">
        <div className="aqua-s02-who">Panen & penjualan</div>
        <div className="aqua-s02-sub">
          {isFinal ? 'Mengakhiri fase produksi' : 'Pemeliharaan masih berlanjut'}
        </div>
      </div>

      <div className={`aqua-s05-context${isFinal ? ' final' : ' partial'}`}>
        <div className="aqua-s02-id">{ctxLabel}</div>
        {isFinal ? (
          <span className="badge aqua-s05-ready-close">Siap ditutup</span>
        ) : (
          <span className={`badge ${stateBadgeClass(cycle.state)}`}>
            {CYCLE_STATE_LABEL[cycle.state] || cycle.state}
          </span>
        )}
        <div className="aqua-s02-meta">
          {dayN != null ? (
            <span>
              Hari ke-<b>{dayN}</b>
            </span>
          ) : null}
          <span>
            Populasi aktif ≈ <b>{activePcs.toLocaleString('id-ID')}</b> ekor
          </span>
          {!isFinal ? <span>Status tidak berubah setelah simpan (tetap rawat)</span> : (
            <span>Fase produksi berakhir — tutup sadar di langkah berikutnya</span>
          )}
        </div>
      </div>

      <h2 className="aqua-s02-title">Panen & penjualan</h2>
      <p className="hint aqua-s02-lead">Pilih jenis — kedua jalur terasa berbeda.</p>

      <div className="aqua-s05-types" role="group" aria-label="Jenis panen">
        <button
          type="button"
          className={`aqua-s05-type${mode === 'partial' ? ' on-partial' : ''}`}
          disabled={busy}
          onClick={() => setMode('partial')}
        >
          <div className="n">Panen sebagian</div>
          <div className="e">Siklus tetap Berjalan / Panen berlangsung. Kembali rawat.</div>
        </button>
        <button
          type="button"
          className={`aqua-s05-type${mode === 'final' ? ' on-final' : ''}`}
          disabled={busy}
          onClick={() => setMode('final')}
        >
          <div className="n">Panen akhir</div>
          <div className="e">Mengakhiri fase produksi → lanjut Tutup siklus (bukan auto-tutup).</div>
        </button>
      </div>

      <div className={`aqua-s05-banner${isFinal ? ' final' : ' partial'}`}>
        {isFinal ? (
          <>
            Ini mengakhiri fase produksi.
            <span className="path">
              Setelah simpan → Lanjut ke Tutup Siklus. Siklus tidak menghilang — Anda menutup dengan sadar.
            </span>
          </>
        ) : (
          <>
            Pemeliharaan masih berlanjut.
            <span className="path">Setelah simpan → Pusat siklus · domain tetap aktif / panen berlangsung.</span>
          </>
        )}
      </div>

      <form className="aqua-s02-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="field aqua-s02-hero">
          <span>Hasil panen (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Mis. 120"
            value={quantityKg}
            disabled={busy}
            onChange={(e) => setQuantityKg(e.target.value)}
          />
        </label>
        <label className="field aqua-s02-hero">
          <span>Jumlah ekor (wajib — KL-003)</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Masukkan jumlah ekor"
            value={quantityPcs}
            disabled={busy}
            onChange={(e) => setQuantityPcs(e.target.value)}
          />
          <span className="hint">Wajib agar populasi aktif berkurang konsisten dengan kematian.</span>
        </label>
        <label className="field">
          <span>
            Nilai penjualan (Rp) <span className="opt">(opsional · catatan)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Mis. 2.400.000"
            value={saleValue}
            disabled={busy}
            onChange={(e) => setSaleValue(e.target.value)}
          />
        </label>
        <label className="field">
          <span>
            Waktu <span className="opt">(default sekarang)</span>
          </span>
          <input
            type="datetime-local"
            value={eventAtLocal}
            disabled={busy}
            onChange={(e) => setEventAtLocal(e.target.value)}
          />
        </label>

        {draftHint ? <p className="aqua-draft-hint">{draftHint}</p> : null}
        {localError ? <p className="aqua-s02-error" role="alert">{localError}</p> : null}

        <div className="aqua-s02-actions">
          <button
            type="submit"
            className={`aqua-s02-primary${isFinal ? '' : ' aqua-s05-cta-ok'}`}
            disabled={busy || activePcs <= 0}
          >
            {busy
              ? 'Menyimpan…'
              : isFinal
                ? 'Lanjut ke Tutup Siklus'
                : 'Simpan & kembali ke Siklus'}
          </button>
          <button type="button" className="aqua-s02-cancel" disabled={busy} onClick={tryExit}>
            Batal
          </button>
        </div>
      </form>

      <p className="hint aqua-s02-safe">
        Safe Exit seperti layar operasional lain. “Siap ditutup” hanya indikator UI (D1) — bukan enum domain.
      </p>
    </section>
  );
}

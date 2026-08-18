/**
 * S02 Catat Pakan — client validation (Validated Baseline).
 * Trace: Doc 56 · 62 · Screen S02 · Journey J2
 *
 * Pure functions — no React. API contract unchanged.
 */

import {
  MAX_FEED_KG,
  MAX_MONEY_IDR,
  formatLimitHint,
  parseDecimalInput,
} from './aqua-input-limits';

export type FeedS02Input = {
  quantityKg: string | number | null | undefined;
  cycleState: string;
  eventAtIso?: string | null;
  totalCost?: string | number | null | undefined;
  showCost?: boolean;
};

export type FeedS02Payload = {
  quantityKg: number;
  eventAt?: string;
  totalCost?: number;
  unitCost?: number;
};

export function isTerminalCycleState(state: string): boolean {
  return state === 'CLOSED' || state === 'CANCELLED';
}

export function canRecordFeedOnState(state: string): boolean {
  return state === 'ACTIVE' || state === 'HARVESTING';
}

/** Returns error message or null if valid. */
export function validateFeedS02(input: FeedS02Input): string | null {
  if (isTerminalCycleState(input.cycleState)) {
    return 'Tidak bisa mencatat pakan pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (!canRecordFeedOnState(input.cycleState)) {
    return `Catat pakan hanya untuk siklus Berjalan / Panen berlangsung (sekarang: ${input.cycleState}).`;
  }

  const qty = parseDecimalInput(input.quantityKg);
  if (qty == null) return 'Jumlah pakan (kg) wajib diisi.';
  if (qty <= 0) return 'Jumlah pakan harus lebih dari 0.';
  if (qty > MAX_FEED_KG) return formatLimitHint(MAX_FEED_KG, 'kg');

  if (input.eventAtIso) {
    const d = new Date(input.eventAtIso);
    if (Number.isNaN(d.getTime())) return 'Waktu kejadian tidak valid.';
  }

  if (input.showCost && input.totalCost != null && String(input.totalCost).trim() !== '') {
    const cost = parseDecimalInput(input.totalCost);
    if (cost == null || cost < 0) return 'Biaya tidak valid.';
    if (cost > MAX_MONEY_IDR) return formatLimitHint(MAX_MONEY_IDR, 'IDR');
  }

  return null;
}

export function buildFeedS02Payload(
  input: FeedS02Input & { feedTypeId: string },
): { ok: true; payload: FeedS02Payload & { feedTypeId: string } } | { ok: false; error: string } {
  const err = validateFeedS02(input);
  if (err) return { ok: false, error: err };
  if (!input.feedTypeId) {
    return { ok: false, error: 'Jenis pakan belum tersedia. Tambahkan di Master terlebih dahulu.' };
  }

  const qty = Number(String(input.quantityKg).trim().replace(',', '.'));
  const payload: FeedS02Payload & { feedTypeId: string } = {
    feedTypeId: input.feedTypeId,
    quantityKg: qty,
  };
  if (input.eventAtIso) payload.eventAt = input.eventAtIso;

  if (input.showCost && input.totalCost != null && String(input.totalCost).trim() !== '') {
    const cost = Number(String(input.totalCost).trim().replace(',', '.'));
    payload.totalCost = cost;
  }

  return { ok: true, payload };
}

export function cycleDayNumber(startedAt?: string | null, now = new Date()): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const diff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

export function isFeedFormDirty(opts: {
  quantityKg: string;
  feedTypeId: string;
  defaultFeedTypeId: string;
  showCost: boolean;
  totalCost: string;
  eventAtLocal: string;
  defaultEventAtLocal: string;
}): boolean {
  if (opts.quantityKg.trim() !== '') return true;
  if (opts.showCost && opts.totalCost.trim() !== '') return true;
  if (opts.feedTypeId && opts.feedTypeId !== opts.defaultFeedTypeId) return true;
  if (opts.eventAtLocal && opts.eventAtLocal !== opts.defaultEventAtLocal) return true;
  return false;
}

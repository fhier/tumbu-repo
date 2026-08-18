/**
 * S03 Catat Kematian — client validation + population checks.
 * Trace: Doc 56 · 62 · Screen S03 · Journey J2
 * Mirrors BE domain/population.ts rules.
 */

import { formatLimitHint, parseDecimalInput } from './aqua-input-limits';

export type MortalityS03Input = {
  deadCountPcs: string | number | null | undefined;
  cycleState: string;
  activePcs: number;
  eventAtIso?: string | null;
};

export function isTerminalCycleState(state: string): boolean {
  return state === 'CLOSED' || state === 'CANCELLED';
}

export function canRecordMortalityOnState(state: string): boolean {
  return state === 'ACTIVE' || state === 'HARVESTING';
}

export function computeActivePcs(facts: {
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
}): number {
  const raw =
    Math.max(0, facts.stockedPcs) -
    Math.max(0, facts.deadPcs) -
    Math.max(0, facts.harvestedPcs);
  return raw < 0 ? 0 : raw;
}

export function validateMortalityS03(input: MortalityS03Input): string | null {
  if (isTerminalCycleState(input.cycleState)) {
    return 'Tidak bisa mencatat kematian pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (!canRecordMortalityOnState(input.cycleState)) {
    return `Catat kematian hanya untuk siklus Berjalan / Panen berlangsung (sekarang: ${input.cycleState}).`;
  }

  const qty = parseDecimalInput(input.deadCountPcs);
  if (qty == null) return 'Jumlah ikan mati (ekor) wajib diisi.';
  if (qty <= 0) return 'Jumlah kematian harus lebih dari 0.';
  if (!Number.isInteger(qty)) return 'Jumlah kematian harus bilangan bulat (ekor).';

  if (input.activePcs <= 0) {
    return 'Populasi aktif sudah 0 — tidak dapat mencatat kematian.';
  }
  if (qty > input.activePcs) {
    return `Jumlah kematian tidak boleh melebihi populasi aktif (${input.activePcs} ekor).`;
  }

  if (input.eventAtIso) {
    const d = new Date(input.eventAtIso);
    if (Number.isNaN(d.getTime())) return 'Waktu kejadian tidak valid.';
  }

  return null;
}

export function isMortalityFormDirty(opts: {
  deadCountPcs: string;
  notes: string;
  eventAtLocal: string;
  defaultEventAtLocal: string;
}): boolean {
  if (opts.deadCountPcs.trim() !== '') return true;
  if (opts.notes.trim() !== '') return true;
  if (opts.eventAtLocal && opts.eventAtLocal !== opts.defaultEventAtLocal) return true;
  return false;
}

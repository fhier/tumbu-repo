/**
 * S05 Harvest — client validation (KL-003: quantityPcs wajib).
 * Trace: Doc 56 · 62 · Screen S05 · Journey J4
 */

import {
  MAX_HARVEST_KG,
  MAX_MONEY_IDR,
  formatLimitHint,
  parseDecimalInput,
} from './aqua-input-limits';

export type HarvestMode = 'partial' | 'final';

export type HarvestS05Input = {
  quantityKg: string | number | null | undefined;
  quantityPcs: string | number | null | undefined;
  cycleState: string;
  activePcs: number;
  saleValue?: string | number | null | undefined;
};

export function isTerminalCycleState(state: string): boolean {
  return state === 'CLOSED' || state === 'CANCELLED';
}

export function canRecordHarvestOnState(state: string): boolean {
  return state === 'ACTIVE' || state === 'HARVESTING';
}

export function validateHarvestS05(input: HarvestS05Input): string | null {
  if (isTerminalCycleState(input.cycleState)) {
    return 'Tidak bisa mencatat panen pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (!canRecordHarvestOnState(input.cycleState)) {
    return `Panen hanya untuk siklus Berjalan / Panen berlangsung (sekarang: ${input.cycleState}).`;
  }

  const kg = parseDecimalInput(input.quantityKg);
  if (kg == null) return 'Hasil panen (kg) wajib diisi.';
  if (kg <= 0) return 'Hasil panen (kg) harus lebih dari 0.';
  if (kg > MAX_HARVEST_KG) return formatLimitHint(MAX_HARVEST_KG, 'kg');

  const pcs = parseDecimalInput(input.quantityPcs);
  if (pcs == null) {
    return 'Jumlah ekor (quantityPcs) wajib — agar populasi aktif tetap konsisten (KL-003).';
  }
  if (pcs <= 0) return 'Jumlah ekor harus lebih dari 0.';
  if (!Number.isInteger(pcs)) return 'Jumlah ekor harus bilangan bulat.';
  if (pcs > input.activePcs) {
    return `Jumlah ekor tidak boleh melebihi populasi aktif (${input.activePcs}).`;
  }

  if (input.saleValue != null && String(input.saleValue).trim() !== '') {
    const v = parseDecimalInput(String(input.saleValue).trim().replace(/\./g, ''));
    if (v == null || v < 0) return 'Nilai penjualan tidak valid.';
    if (v > MAX_MONEY_IDR) return formatLimitHint(MAX_MONEY_IDR, 'IDR');
  }

  return null;
}

export function isHarvestFormDirty(opts: {
  quantityKg: string;
  quantityPcs: string;
  saleValue: string;
  eventAtLocal: string;
  defaultEventAtLocal: string;
}): boolean {
  if (opts.quantityKg.trim() !== '') return true;
  if (opts.quantityPcs.trim() !== '') return true;
  if (opts.saleValue.trim() !== '') return true;
  if (opts.eventAtLocal && opts.eventAtLocal !== opts.defaultEventAtLocal) return true;
  return false;
}

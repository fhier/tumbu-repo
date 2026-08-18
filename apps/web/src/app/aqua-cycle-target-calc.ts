/** Kalkulasi target panen & BOP — panduan UX (bukan Formula SSOT). */

export function estimateTargetHarvestKg(input: {
  seedCount: number;
  targetSrPct: number;
  targetWeightGram: number;
}): number | null {
  const n = Number(input.seedCount);
  const sr = Number(input.targetSrPct);
  const wg = Number(input.targetWeightGram);
  if (!(n > 0) || !(sr > 0) || !(wg > 0)) return null;
  return Math.round((n * (sr / 100) * wg) / 1000 * 100) / 100;
}

export function estimateTargetBopRp(input: {
  seedCount: number;
  seedUnitCost: number;
  feedKg: number;
  feedPricePerKg: number;
  operasionalCost: number;
}): number | null {
  const n = Number(input.seedCount);
  if (!(n > 0)) return null;
  const biayaBenih = n * (Number(input.seedUnitCost) || 0);
  const biayaPakan = (Number(input.feedKg) || 0) * (Number(input.feedPricePerKg) || 0);
  const operasional = Number(input.operasionalCost) || 0;
  return Math.round(biayaBenih + biayaPakan + operasional);
}

export type TargetCalcBreakdown = {
  harvestKg: number | null;
  bopRp: number | null;
  survivePcs: number | null;
  feedKg: number | null;
  biayaBenih: number;
  biayaPakan: number;
  operasional: number;
};

export function targetCalcBreakdown(input: {
  seedCount: number;
  targetSrPct: number;
  targetWeightGram: number;
  targetFcr: number;
  seedUnitCost: number;
  feedPricePerKg: number;
  operasionalCost: number;
}): TargetCalcBreakdown {
  const n = Number(input.seedCount) || 0;
  const sr = Number(input.targetSrPct) || 0;
  const wg = Number(input.targetWeightGram) || 0;
  const fcr = Number(input.targetFcr) || 0;
  const survivePcs = n > 0 && sr > 0 ? Math.round(n * (sr / 100)) : null;
  const harvestKg = estimateTargetHarvestKg({ seedCount: n, targetSrPct: sr, targetWeightGram: wg });
  const feedKg = n > 0 && fcr > 0 && wg > 0
    ? Math.round(n * fcr * (wg / 1000) * 100) / 100
    : null;
  const biayaBenih = Math.round(n * (Number(input.seedUnitCost) || 0));
  const biayaPakan = Math.round((feedKg || 0) * (Number(input.feedPricePerKg) || 0));
  const operasional = Math.round(Number(input.operasionalCost) || 0);
  const bopRp = n > 0 ? biayaBenih + biayaPakan + operasional : null;
  return { harvestKg, bopRp, survivePcs, feedKg, biayaBenih, biayaPakan, operasional };
}

/** Filter pill grup status siklus */
export type CycleStatusFilter = '' | 'rencana' | 'berjalan' | 'selesai';

export const CYCLE_STATUS_FILTERS: Array<{ id: CycleStatusFilter; label: string }> = [
  { id: '', label: 'Semua' },
  { id: 'rencana', label: 'Perencanaan' },
  { id: 'berjalan', label: 'Berjalan' },
  { id: 'selesai', label: 'Selesai' },
];

export const CYCLE_STATUS_GROUPS: Record<Exclude<CycleStatusFilter, ''>, string[]> = {
  rencana: ['PLANNED', 'READY'],
  berjalan: ['ACTIVE', 'HARVESTING'],
  selesai: ['CLOSED'],
};

export function cycleMatchesStatusFilter(state: string, filter: CycleStatusFilter): boolean {
  if (!filter) return true;
  return (CYCLE_STATUS_GROUPS[filter] || []).includes(state);
}

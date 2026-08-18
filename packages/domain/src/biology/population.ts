import { PopulationFacts } from '../types';

export function computeActivePopulation(facts: PopulationFacts): {
  activePcs: number;
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
} {
  const stockedPcs = Math.max(0, Number(facts.stockedPcs) || 0);
  const deadPcs = Math.max(0, Number(facts.deadPcs) || 0);
  const harvestedPcs = Math.max(0, Number(facts.harvestedPcs) || 0);
  const raw = stockedPcs - deadPcs - harvestedPcs;
  return {
    stockedPcs,
    deadPcs,
    harvestedPcs,
    activePcs: raw < 0 ? 0 : raw,
  };
}

/** True if recording `deadCountPcs` would keep active ≥ 0. */
export function canRecordMortality(
  facts: PopulationFacts,
  deadCountPcs: number,
): { ok: true; activeBefore: number; activeAfter: number } | { ok: false; reason: string; activeBefore: number } {
  const dead = Number(deadCountPcs);
  const before = computeActivePopulation(facts);
  if (!Number.isFinite(dead) || dead <= 0) {
    return { ok: false, reason: 'deadCountPcs harus > 0.', activeBefore: before.activePcs };
  }
  if (before.activePcs <= 0) {
    return {
      ok: false,
      reason: 'Populasi aktif sudah 0 — tidak dapat mencatat kematian.',
      activeBefore: before.activePcs,
    };
  }
  if (dead > before.activePcs) {
    return {
      ok: false,
      reason: `Jumlah kematian (${dead}) melebihi populasi aktif (${before.activePcs}).`,
      activeBefore: before.activePcs,
    };
  }
  return {
    ok: true,
    activeBefore: before.activePcs,
    activeAfter: before.activePcs - dead,
  };
}

/** True if recording harvest `quantityPcs` would keep active ≥ 0.
 * KL-003: quantityPcs wajib untuk integritas populasi.
 */
export function canRecordHarvestPcs(
  facts: PopulationFacts,
  quantityPcs: number,
): { ok: true; activeBefore: number; activeAfter: number } | { ok: false; reason: string; activeBefore: number } {
  const pcs = Number(quantityPcs);
  const before = computeActivePopulation(facts);
  if (!Number.isFinite(pcs) || pcs <= 0) {
    return {
      ok: false,
      reason: 'quantityPcs wajib dan harus > 0 (integritas populasi aktif).',
      activeBefore: before.activePcs,
    };
  }
  if (before.activePcs <= 0) {
    return {
      ok: false,
      reason: 'Populasi aktif sudah 0 — tidak dapat mencatat panen ekor.',
      activeBefore: before.activePcs,
    };
  }
  if (pcs > before.activePcs) {
    return {
      ok: false,
      reason: `Jumlah panen (${pcs} ekor) melebihi populasi aktif (${before.activePcs}).`,
      activeBefore: before.activePcs,
    };
  }
  return {
    ok: true,
    activeBefore: before.activePcs,
    activeAfter: before.activePcs - pcs,
  };
}

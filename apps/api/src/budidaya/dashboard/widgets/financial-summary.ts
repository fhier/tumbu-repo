/**
 * Widget: Financial Summary — angka dari FormulaSnapshot saja.
 * Tidak menghitung BOP/HPP/laba ulang.
 */

import type { CycleListRow, FormulaSnapshot } from '../types';

export type FinancialSummaryWidget = {
  widget: 'financialSummary';
  totalBop: number;
  /** Aggregat workspace: totalBop / totalHarvestKg — dari fakta Formula, bukan rumus baru */
  estimatedHpp: number | null;
  estimatedProfit: number;
  byCycle: Array<{
    cycleId: string;
    code: string;
    bop: number;
    hppPerKg: number | null;
    grossProfit: number;
    bopSource: string;
    bopDeviationColor: FormulaSnapshot['colors']['bopDeviation'];
  }>;
  /** Kolam BOP tertinggi / terendah (dari Formula.bop.total) */
  pondHighestBop: { pondName: string; pondCode: string; bop: number } | null;
  pondLowestBop: { pondName: string; pondCode: string; bop: number } | null;
};

export function buildFinancialSummary(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): FinancialSummaryWidget {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  let totalBop = 0;
  let totalHarvestKg = 0;
  let estimatedProfit = 0;

  const byCycle = input.formulas.map((f) => {
    totalBop += f.bop.total;
    totalHarvestKg += f.facts.harvestKg;
    estimatedProfit += f.profit.grossProfit;
    const meta = byId.get(f.cycleId);
    return {
      cycleId: f.cycleId,
      code: meta?.code ?? f.cycleId,
      bop: f.bop.total,
      hppPerKg: f.hpp.defined && f.hpp.hppPerKg != null ? f.hpp.hppPerKg : null,
      grossProfit: f.profit.grossProfit,
      bopSource: f.facts.bopSource,
      bopDeviationColor: f.colors.bopDeviation,
    };
  });

  const estimatedHpp =
    totalHarvestKg > 0 ? totalBop / totalHarvestKg : null;

  // pond BOP = sum formula.bop per pond (komposisi, bukan rumus bisnis baru)
  const pondBop = new Map<string, { pondName: string; pondCode: string; bop: number }>();
  for (const f of input.formulas) {
    const meta = byId.get(f.cycleId);
    if (!meta) continue;
    const cur = pondBop.get(meta.pondId) ?? {
      pondName: meta.pondName,
      pondCode: meta.pondCode,
      bop: 0,
    };
    cur.bop += f.bop.total;
    pondBop.set(meta.pondId, cur);
  }
  const pondList = [...pondBop.values()].sort((a, b) => b.bop - a.bop);

  return {
    widget: 'financialSummary',
    totalBop,
    estimatedHpp,
    estimatedProfit,
    byCycle,
    pondHighestBop: pondList[0] ?? null,
    pondLowestBop: pondList.length ? pondList[pondList.length - 1]! : null,
  };
}

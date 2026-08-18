/**
 * Widget: Production Summary — FCR/SR/pakan/panen dari Formula.
 */

import type { CycleListRow, FormulaSnapshot } from '../types';

export type ProductionSummaryWidget = {
  widget: 'productionSummary';
  totalFeedKg: number;
  totalHarvestKg: number;
  byCycle: Array<{
    cycleId: string;
    code: string;
    feedKg: number;
    harvestKg: number;
    fcr: number | null;
    srPct: number | null;
    fcrColor: FormulaSnapshot['colors']['fcr'];
    srColor: FormulaSnapshot['colors']['sr'];
  }>;
};

export function buildProductionSummary(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): ProductionSummaryWidget {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  let totalFeedKg = 0;
  let totalHarvestKg = 0;

  const byCycle = input.formulas.map((f) => {
    totalFeedKg += f.facts.feedKg;
    totalHarvestKg += f.facts.harvestKg;
    const meta = byId.get(f.cycleId);
    return {
      cycleId: f.cycleId,
      code: meta?.code ?? f.cycleId,
      feedKg: f.facts.feedKg,
      harvestKg: f.facts.harvestKg,
      fcr: f.fcr.defined && f.fcr.fcr != null ? f.fcr.fcr : null,
      srPct: f.sr.defined && f.sr.srPct != null ? f.sr.srPct : null,
      fcrColor: f.colors.fcr,
      srColor: f.colors.sr,
    };
  });

  return {
    widget: 'productionSummary',
    totalFeedKg,
    totalHarvestKg,
    byCycle,
  };
}

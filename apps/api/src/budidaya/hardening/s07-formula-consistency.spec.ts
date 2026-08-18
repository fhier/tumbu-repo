/**
 * Sprint 7 — Formula Layer consistency (Dashboard · Analysis · S06).
 * Semua konsumen membaca FormulaSnapshot; tidak boleh menghitung ulang BOP/HPP/FCR/SR.
 */

import { buildFinancialSummary } from '../dashboard/widgets/financial-summary';
import { buildProductionSummary } from '../dashboard/widgets/production-summary';
import { buildCostAnalysis } from '../analysis/views/cost-analysis';
import { buildProductionAnalysis } from '../analysis/views/production-analysis';
import { buildProfitAnalysis } from '../analysis/views/profit-analysis';
import type { CycleListRow, FormulaSnapshot } from '../dashboard/types';

const cycle: CycleListRow = {
  id: 'c1',
  code: 'C-1',
  state: 'ACTIVE',
  pondId: 'p1',
  pondName: 'Kolam 2',
  pondCode: 'K2',
  speciesName: 'Lele',
};

const snap: FormulaSnapshot = {
  cycleId: 'c1',
  state: 'ACTIVE',
  facts: {
    feedKg: 100,
    harvestKg: 80,
    stockedPcs: 1000,
    harvestedPcs: 900,
    revenue: 2_000_000,
    expenseCount: 2,
    bopSource: 'EXPENSE',
  },
  bop: { total: 1_500_000, direct: 1_200_000, indirect: 300_000, bySource: { FEED: 800_000 } },
  hpp: { hppPerKg: 18_750, defined: true },
  fcr: { fcr: 1.25, defined: true },
  sr: { srPct: 90, defined: true },
  profit: {
    revenue: 2_000_000,
    grossProfit: 500_000,
    marginPct: 25,
    defined: true,
  },
  targets: { bop: null, fcr: 1.2, srPct: 92, harvestKg: null },
  colors: { fcr: 'YELLOW', sr: 'YELLOW', bopDeviation: 'NEUTRAL' },
  deviations: {
    bop: { deviationPct: undefined, defined: false },
    fcr: { deviationPct: (1.25 - 1.2) / 1.2 * 100, defined: true },
    sr: { deviationPct: undefined, defined: false },
    harvestKg: { deviationPct: undefined, defined: false },
  },
};

describe('S07 Formula consistency (Dashboard · Analysis · S06 path)', () => {
  it('R7.2/R7.5 — dashboard widgets echo FormulaSnapshot numbers (no recompute)', () => {
    const fin = buildFinancialSummary({ cycles: [cycle], formulas: [snap] });
    const prod = buildProductionSummary({ cycles: [cycle], formulas: [snap] });
    expect(fin.totalBop).toBe(snap.bop.total);
    expect(fin.estimatedHpp).toBe(snap.hpp.hppPerKg!);
    expect(fin.estimatedProfit).toBe(snap.profit.grossProfit);
    expect(prod.byCycle[0].fcr).toBe(snap.fcr.fcr!);
    expect(prod.byCycle[0].srPct).toBe(snap.sr.srPct!);
    expect(prod.byCycle[0].fcrColor).toBe(snap.colors.fcr);
  });

  it('R7.3/R7.5 — analysis views echo same FormulaSnapshot for same cycle', () => {
    const cost = buildCostAnalysis({ cycles: [cycle], formulas: [snap] });
    const prod = buildProductionAnalysis({ cycles: [cycle], formulas: [snap] });
    const profit = buildProfitAnalysis({ cycles: [cycle], formulas: [snap] });
    expect(cost.byCycle[0].bop).toBe(snap.bop.total);
    expect(prod.byCycle[0].fcr).toBe(snap.fcr.fcr!);
    expect(prod.byCycle[0].srPct).toBe(snap.sr.srPct!);
    expect(profit.byCycle[0].grossProfit).toBe(snap.profit.grossProfit);
    expect(profit.byCycle[0].hppPerKg).toBe(snap.hpp.hppPerKg!);
  });

  it('R7.5 — Dashboard BOP === Analysis BOP === Formula.bop for same snap', () => {
    const fin = buildFinancialSummary({ cycles: [cycle], formulas: [snap] });
    const cost = buildCostAnalysis({ cycles: [cycle], formulas: [snap] });
    expect(fin.totalBop).toBe(cost.workspace.totalBop);
    expect(fin.totalBop).toBe(snap.bop.total);
  });
});

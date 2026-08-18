import {
  buildCostAnalysis,
  buildDeviationAnalysis,
  buildProductionAnalysis,
  buildProfitAnalysis,
} from '../views';
import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';

const cycle: CycleListRow = {
  id: 'c1',
  code: 'SK-1',
  state: 'CLOSED',
  pondId: 'p1',
  pondName: 'Kolam A',
  pondCode: 'K-01',
  speciesName: 'Lele',
};

const formula: FormulaSnapshot = {
  cycleId: 'c1',
  state: 'CLOSED',
  facts: {
    feedKg: 120,
    harvestKg: 100,
    stockedPcs: 1000,
    harvestedPcs: 900,
    revenue: 8000,
    expenseCount: 2,
    bopSource: 'EXPENSE',
  },
  bop: {
    total: 5000,
    direct: 4000,
    indirect: 1000,
    bySource: { EXPENSE: 3000, PAKAN: 2000 },
  },
  hpp: { hppPerKg: 50, defined: true },
  fcr: { fcr: 1.2, defined: true },
  sr: { srPct: 90, defined: true },
  profit: { revenue: 8000, grossProfit: 3000, marginPct: 37.5, defined: true },
  targets: { bop: 4500, fcr: 1.1, srPct: 95, harvestKg: 110 },
  colors: { fcr: 'YELLOW', sr: 'YELLOW', bopDeviation: 'YELLOW' },
  deviations: {
    bop: { deviationPct: 11.1, defined: true },
    fcr: { deviationPct: 9.1, defined: true },
    sr: { deviationPct: -5.3, defined: true },
    harvestKg: { deviationPct: -9.1, defined: true },
  },
};

describe('Analysis views (8.7)', () => {
  it('cost analysis explains largest source from Formula bySource', () => {
    const v = buildCostAnalysis({ cycles: [cycle], formulas: [formula] });
    expect(v.view).toBe('costAnalysis');
    expect(v.workspace.totalBop).toBe(5000);
    expect(v.workspace.largestSources[0]?.source).toBe('EXPENSE');
    expect(v.byCycle[0]?.insight).toMatch(/Komponen terbesar/);
  });

  it('production analysis ranks FCR from Formula values only', () => {
    const v = buildProductionAnalysis({ cycles: [cycle], formulas: [formula] });
    expect(v.workspace.bestFcr?.fcr).toBe(1.2);
    expect(v.byCycle[0]?.fcrColor).toBe('YELLOW');
  });

  it('deviation analysis uses Formula deviations and colors', () => {
    const v = buildDeviationAnalysis({ cycles: [cycle], formulas: [formula] });
    const bop = v.byCycle[0]?.items.find((i) => i.metric === 'BOP');
    expect(bop?.deviationPct).toBeCloseTo(11.1);
    expect(bop?.color).toBe('YELLOW');
    expect(bop?.insight).toMatch(/indikator YELLOW/);
  });

  it('profit analysis is a View not an entity', () => {
    const v = buildProfitAnalysis({ cycles: [cycle], formulas: [formula] });
    expect(v.view).toBe('profitAnalysis');
    expect(v.workspace.totalGrossProfit).toBe(3000);
    expect(v.byCycle[0]?.marginPct).toBeCloseTo(37.5);
  });
});

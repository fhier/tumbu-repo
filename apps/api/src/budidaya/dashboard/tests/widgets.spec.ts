import {
  buildAlertSummary,
  buildCycleSummary,
  buildFinancialSummary,
  buildProductionSummary,
} from '../widgets';
import type { CycleListRow, FormulaSnapshot } from '../types';

const cycle: CycleListRow = {
  id: 'c1',
  code: 'SK-1',
  state: 'ACTIVE',
  pondId: 'p1',
  pondName: 'Kolam A',
  pondCode: 'K-01',
  speciesName: 'Lele',
};

function snap(partial: Partial<FormulaSnapshot> & Pick<FormulaSnapshot, 'colors'>): FormulaSnapshot {
  return {
    cycleId: 'c1',
    state: 'ACTIVE',
    facts: {
      feedKg: 100,
      harvestKg: 80,
      stockedPcs: 1000,
      harvestedPcs: 900,
      revenue: 5000,
      expenseCount: 0,
      bopSource: 'PROVISIONAL_EVENT_COSTS',
    },
    bop: { total: 2000, direct: 2000, indirect: 0, bySource: { PROVISIONAL_FEED: 2000 } },
    hpp: { hppPerKg: 25, defined: true },
    fcr: { fcr: 1.25, defined: true },
    sr: { srPct: 90, defined: true },
    profit: { revenue: 5000, grossProfit: 3000, marginPct: 60, defined: true },
    targets: { bop: 1800, fcr: 1.1, srPct: 95, harvestKg: 100 },
    deviations: {
      bop: { deviationPct: 5, defined: true },
      fcr: { deviationPct: 13.6, defined: true },
      sr: { deviationPct: -5.3, defined: true },
      harvestKg: { deviationPct: -20, defined: true },
    },
    ...partial,
  };
}

describe('Dashboard widgets (8.6)', () => {
  it('cycle summary counts without formulas', () => {
    const w = buildCycleSummary({ pondsActive: 2, cycles: [cycle] });
    expect(w.widget).toBe('cycleSummary');
    expect(w.cyclesRunning).toBe(1);
    expect(w.pondsActive).toBe(2);
  });

  it('financial summary aggregates Formula numbers only', () => {
    const w = buildFinancialSummary({
      cycles: [cycle],
      formulas: [snap({ colors: { fcr: 'YELLOW', sr: 'YELLOW', bopDeviation: 'GREEN' } })],
    });
    expect(w.totalBop).toBe(2000);
    expect(w.estimatedHpp).toBeCloseTo(25);
    expect(w.estimatedProfit).toBe(3000);
    expect(w.byCycle[0]?.bopDeviationColor).toBe('GREEN');
    expect(w.pondHighestBop?.pondCode).toBe('K-01');
  });

  it('production summary passes FCR/SR colors from Formula', () => {
    const w = buildProductionSummary({
      cycles: [cycle],
      formulas: [snap({ colors: { fcr: 'RED', sr: 'GREEN', bopDeviation: 'NEUTRAL' } })],
    });
    expect(w.byCycle[0]?.fcrColor).toBe('RED');
    expect(w.byCycle[0]?.srColor).toBe('GREEN');
    expect(w.totalFeedKg).toBe(100);
  });

  it('alert summary only includes YELLOW/RED from Formula colors', () => {
    const w = buildAlertSummary({
      cycles: [cycle],
      formulas: [
        snap({ colors: { fcr: 'RED', sr: 'GREEN', bopDeviation: 'YELLOW' } }),
      ],
    });
    expect(w.redCount).toBe(1);
    expect(w.yellowCount).toBe(1);
    expect(w.alerts.map((a) => a.metric).sort()).toEqual(['BOP_DEV', 'FCR']);
  });
});

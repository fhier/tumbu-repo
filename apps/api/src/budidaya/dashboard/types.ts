/**
 * Formula snapshot shape yang dikonsumsi Dashboard widgets.
 * Widgets tidak memanggil calculator — hanya membaca field ini.
 */

import type { FormulaColor } from '@tumbu/domain';
export type { FormulaColor };

export type FormulaSnapshot = {
  cycleId: string;
  state: string;
  facts: {
    feedKg: number;
    harvestKg: number;
    stockedPcs: number;
    harvestedPcs: number;
    revenue: number;
    expenseCount: number;
    bopSource: string;
  };
  bop: {
    total: number;
    direct: number;
    indirect: number;
    bySource: Record<string, number>;
  };
  hpp: { hppPerKg: number | undefined; defined: boolean };
  fcr: { fcr: number | undefined; defined: boolean };
  sr: { srPct: number | undefined; defined: boolean };
  profit: {
    revenue: number;
    grossProfit: number;
    marginPct: number | undefined;
    defined: boolean;
  };
  targets: {
    bop: number | null;
    fcr: number | null;
    srPct: number | null;
    harvestKg: number | null;
  };
  colors: {
    fcr: FormulaColor;
    sr: FormulaColor;
    bopDeviation: FormulaColor;
  };
  deviations: {
    bop: { deviationPct: number | undefined; defined: boolean };
    fcr: { deviationPct: number | undefined; defined: boolean };
    sr: { deviationPct: number | undefined; defined: boolean };
    harvestKg: { deviationPct: number | undefined; defined: boolean };
  };
};

export type CycleListRow = {
  id: string;
  code: string;
  state: string;
  pondId: string;
  pondName: string;
  pondCode: string;
  speciesName: string;
};

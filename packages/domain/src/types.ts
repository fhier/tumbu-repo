/**
 * Shared Type Definitions for @tumbu/domain
 */

export type CostClass = 'DIRECT' | 'INDIRECT';

export type FormulaColor = 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL';

/** Satu baris biaya untuk agregasi BOP (sudah difilter RECORDED di assembler). */
export type CostLine = {
  amount: number;
  costClass: CostClass;
  /** EXPENSE | PROVISIONAL_STOCKING | PROVISIONAL_FEED | … */
  source: string;
  categoryCode?: string;
};

export type BopResult = {
  total: number;
  direct: number;
  indirect: number;
  bySource: Record<string, number>;
};

export type HppResult = {
  /** undefined jika kg panen = 0 (jangan angka palsu) */
  hppPerKg: number | undefined;
  bop: number;
  harvestKg: number;
  defined: boolean;
};

export type FcrResult = {
  fcr: number | undefined;
  feedKg: number;
  harvestKg: number;
  defined: boolean;
};

export type SrResult = {
  /** persen 0–100+ */
  srPct: number | undefined;
  stockedPcs: number;
  harvestedPcs: number;
  defined: boolean;
};

export type ProfitResult = {
  revenue: number;
  bop: number;
  grossProfit: number;
  /** undefined jika pendapatan = 0 */
  marginPct: number | undefined;
  defined: boolean;
};

export type DeviationResult = {
  /** (realisasi − target) / target × 100; undefined jika target ≤ 0 */
  deviationPct: number | undefined;
  target: number;
  actual: number;
  defined: boolean;
};

export type IndicatorInput = {
  direction: 'LOWER_BETTER' | 'HIGHER_BETTER';
  greenBound: number;
  yellowBound: number;
  /** nilai metrik absolut ATAU |deviation| tergantung pemakaian rule */
  value: number;
};

export type PopulationFacts = {
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
};


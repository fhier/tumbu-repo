import type { SrResult } from '../types';

export function computeSr(stockedPcs: number, harvestedPcs: number): SrResult {
  const stocked = Number(stockedPcs) || 0;
  const harvested = Number(harvestedPcs) || 0;
  if (stocked <= 0) {
    return {
      srPct: undefined,
      stockedPcs: stocked,
      harvestedPcs: harvested,
      defined: false,
    };
  }
  return {
    srPct: (harvested / stocked) * 100,
    stockedPcs: stocked,
    harvestedPcs: harvested,
    defined: true,
  };
}

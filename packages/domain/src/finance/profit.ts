import type { ProfitResult } from '../types';

export function computeProfit(revenue: number, bop: number): ProfitResult {
  const rev = Number(revenue) || 0;
  const cost = Number(bop) || 0;
  const grossProfit = rev - cost;
  if (rev <= 0) {
    return {
      revenue: rev,
      bop: cost,
      grossProfit,
      marginPct: undefined,
      defined: false,
    };
  }
  return {
    revenue: rev,
    bop: cost,
    grossProfit,
    marginPct: (grossProfit / rev) * 100,
    defined: true,
  };
}

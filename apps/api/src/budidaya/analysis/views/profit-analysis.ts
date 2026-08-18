/**
 * ProfitAnalysis View — laba/margin dari Formula.profit (bukan entity SoT).
 */

import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';

export type ProfitAnalysisView = {
  view: 'profitAnalysis';
  question: 'Bagaimana keuntungan siklus?';
  workspace: {
    totalRevenue: number;
    totalGrossProfit: number;
    /** Kolam/siklus margin terbaik dari Formula (bukan rumus baru) */
    bestMargin: { code: string; marginPct: number } | null;
    worstMargin: { code: string; marginPct: number } | null;
  };
  byCycle: Array<{
    cycleId: string;
    code: string;
    pondCode: string;
    revenue: number;
    bop: number;
    grossProfit: number;
    marginPct: number | null;
    hppPerKg: number | null;
    insight: string;
  }>;
};

export function buildProfitAnalysis(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): ProfitAnalysisView {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  let totalRevenue = 0;
  let totalGrossProfit = 0;
  const withMargin: Array<{ code: string; marginPct: number }> = [];

  const byCycle = input.formulas.map((f) => {
    totalRevenue += f.profit.revenue;
    totalGrossProfit += f.profit.grossProfit;
    const meta = byId.get(f.cycleId);
    const code = meta?.code ?? f.cycleId;
    if (f.profit.defined && f.profit.marginPct != null) {
      withMargin.push({ code, marginPct: f.profit.marginPct });
    }

    let insight: string;
    if (!f.profit.defined || f.profit.revenue <= 0) {
      insight =
        'Pendapatan belum tercatat (RevenueEvent) — margin belum terdefinisi. BOP tetap dari Formula.';
    } else if (f.profit.grossProfit < 0) {
      insight = `Laba kotor negatif (${f.profit.grossProfit.toFixed(0)}): pendapatan di bawah BOP.`;
    } else {
      insight = `Margin ${f.profit.marginPct!.toFixed(1)}% · HPP ${
        f.hpp.defined && f.hpp.hppPerKg != null
          ? f.hpp.hppPerKg.toFixed(0)
          : '—'
      }/kg.`;
    }

    return {
      cycleId: f.cycleId,
      code,
      pondCode: meta?.pondCode ?? '',
      revenue: f.profit.revenue,
      bop: f.bop.total,
      grossProfit: f.profit.grossProfit,
      marginPct:
        f.profit.defined && f.profit.marginPct != null ? f.profit.marginPct : null,
      hppPerKg: f.hpp.defined && f.hpp.hppPerKg != null ? f.hpp.hppPerKg : null,
      insight,
    };
  });

  const marginDesc = [...withMargin].sort((a, b) => b.marginPct - a.marginPct);

  return {
    view: 'profitAnalysis',
    question: 'Bagaimana keuntungan siklus?',
    workspace: {
      totalRevenue,
      totalGrossProfit,
      bestMargin: marginDesc[0] ?? null,
      worstMargin: marginDesc.length ? marginDesc[marginDesc.length - 1]! : null,
    },
    byCycle,
  };
}

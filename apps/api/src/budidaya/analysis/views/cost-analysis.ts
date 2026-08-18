/**
 * CostAnalysis View — "Mengapa biaya seperti ini?"
 * Hanya menyusun FormulaSnapshot; tidak menghitung ulang BOP.
 */

import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';

export type CostAnalysisView = {
  view: 'costAnalysis';
  question: 'Mengapa biaya seperti ini?';
  workspace: {
    totalBop: number;
    totalDirect: number;
    totalIndirect: number;
    /** Komposisi sumber biaya (dari formula.bop.bySource) */
    largestSources: Array<{ source: string; amount: number; sharePct: number }>;
  };
  byCycle: Array<{
    cycleId: string;
    code: string;
    pondCode: string;
    bop: number;
    direct: number;
    indirect: number;
    bopSource: string;
    largestSource: string | null;
    insight: string;
  }>;
};

function rankSources(bySource: Record<string, number>) {
  const total = Object.values(bySource).reduce((s, n) => s + n, 0);
  return Object.entries(bySource)
    .map(([source, amount]) => ({
      source,
      amount,
      sharePct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function buildCostAnalysis(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): CostAnalysisView {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  let totalBop = 0;
  let totalDirect = 0;
  let totalIndirect = 0;
  const merged: Record<string, number> = {};

  const byCycle = input.formulas.map((f) => {
    totalBop += f.bop.total;
    totalDirect += f.bop.direct;
    totalIndirect += f.bop.indirect;
    for (const [k, v] of Object.entries(f.bop.bySource || {})) {
      merged[k] = (merged[k] ?? 0) + v;
    }
    const meta = byId.get(f.cycleId);
    const ranked = rankSources(f.bop.bySource || {});
    const top = ranked[0];
    let insight = 'Belum ada biaya tercatat pada Formula.';
    if (f.bop.total > 0 && top) {
      insight = `Komponen terbesar: ${top.source} (${top.sharePct.toFixed(0)}% dari BOP siklus). Sumber BOP: ${f.facts.bopSource}.`;
    } else if (f.facts.bopSource === 'PROVISIONAL_EVENT_COSTS') {
      insight =
        'BOP masih interim dari totalCost Stocking/Feed — ExpenseEvent belum menjadi sumber kanonik.';
    }
    return {
      cycleId: f.cycleId,
      code: meta?.code ?? f.cycleId,
      pondCode: meta?.pondCode ?? '',
      bop: f.bop.total,
      direct: f.bop.direct,
      indirect: f.bop.indirect,
      bopSource: f.facts.bopSource,
      largestSource: top?.source ?? null,
      insight,
    };
  });

  return {
    view: 'costAnalysis',
    question: 'Mengapa biaya seperti ini?',
    workspace: {
      totalBop,
      totalDirect,
      totalIndirect,
      largestSources: rankSources(merged).slice(0, 5),
    },
    byCycle,
  };
}

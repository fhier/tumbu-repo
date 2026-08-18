/**
 * DeviationAnalysis View — realisasi vs rencana (dari Formula.deviations + colors).
 */

import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';

export type DeviationAnalysisView = {
  view: 'deviationAnalysis';
  question: 'Seberapa jauh dari rencana?';
  byCycle: Array<{
    cycleId: string;
    code: string;
    pondCode: string;
    items: Array<{
      metric: 'BOP' | 'FCR' | 'SR' | 'HARVEST_KG';
      deviationPct: number | null;
      color: FormulaSnapshot['colors']['bopDeviation'] | FormulaSnapshot['colors']['fcr'];
      target: number | null;
      insight: string;
    }>;
  }>;
};

function fmtDev(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct)) {
    return 'tidak terdefinisi (target kosong atau data kurang)';
  }
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs target`;
}

export function buildDeviationAnalysis(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): DeviationAnalysisView {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));

  const byCycle = input.formulas.map((f) => {
    const meta = byId.get(f.cycleId);
    const items: DeviationAnalysisView['byCycle'][0]['items'] = [
      {
        metric: 'BOP',
        deviationPct: f.deviations.bop.defined
          ? f.deviations.bop.deviationPct ?? null
          : null,
        color: f.colors.bopDeviation,
        target: f.targets.bop,
        insight: `Biaya: ${fmtDev(f.deviations.bop.deviationPct)} · indikator ${f.colors.bopDeviation}`,
      },
      {
        metric: 'FCR',
        deviationPct: f.deviations.fcr.defined
          ? f.deviations.fcr.deviationPct ?? null
          : null,
        color: f.colors.fcr,
        target: f.targets.fcr,
        insight: `FCR: ${fmtDev(f.deviations.fcr.deviationPct)} · indikator ${f.colors.fcr}`,
      },
      {
        metric: 'SR',
        deviationPct: f.deviations.sr.defined
          ? f.deviations.sr.deviationPct ?? null
          : null,
        color: f.colors.sr,
        target: f.targets.srPct,
        insight: `SR: ${fmtDev(f.deviations.sr.deviationPct)} · indikator ${f.colors.sr}`,
      },
      {
        metric: 'HARVEST_KG',
        deviationPct: f.deviations.harvestKg.defined
          ? f.deviations.harvestKg.deviationPct ?? null
          : null,
        color: 'NEUTRAL',
        target: f.targets.harvestKg,
        insight: `Panen kg: ${fmtDev(f.deviations.harvestKg.deviationPct)}`,
      },
    ];

    return {
      cycleId: f.cycleId,
      code: meta?.code ?? f.cycleId,
      pondCode: meta?.pondCode ?? '',
      items,
    };
  });

  return {
    view: 'deviationAnalysis',
    question: 'Seberapa jauh dari rencana?',
    byCycle,
  };
}

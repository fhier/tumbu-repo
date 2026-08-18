/**
 * ProductionAnalysis View — efisiensi pakan & kelangsungan hidup.
 */

import type { CycleListRow, FormulaSnapshot } from '../../dashboard/types';

export type ProductionAnalysisView = {
  view: 'productionAnalysis';
  question: 'Bagaimana efisiensi produksi?';
  workspace: {
    totalFeedKg: number;
    totalHarvestKg: number;
    /** Siklus FCR terbaik/terburuk dari nilai Formula (bukan hitung ulang) */
    bestFcr: { code: string; fcr: number } | null;
    worstFcr: { code: string; fcr: number } | null;
    bestSr: { code: string; srPct: number } | null;
    worstSr: { code: string; srPct: number } | null;
  };
  byCycle: Array<{
    cycleId: string;
    code: string;
    pondCode: string;
    feedKg: number;
    harvestKg: number;
    fcr: number | null;
    srPct: number | null;
    fcrColor: FormulaSnapshot['colors']['fcr'];
    srColor: FormulaSnapshot['colors']['sr'];
    insight: string;
  }>;
};

export function buildProductionAnalysis(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): ProductionAnalysisView {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  let totalFeedKg = 0;
  let totalHarvestKg = 0;

  const withFcr: Array<{ code: string; fcr: number }> = [];
  const withSr: Array<{ code: string; srPct: number }> = [];

  const byCycle = input.formulas.map((f) => {
    totalFeedKg += f.facts.feedKg;
    totalHarvestKg += f.facts.harvestKg;
    const meta = byId.get(f.cycleId);
    const code = meta?.code ?? f.cycleId;
    if (f.fcr.defined && f.fcr.fcr != null) withFcr.push({ code, fcr: f.fcr.fcr });
    if (f.sr.defined && f.sr.srPct != null) withSr.push({ code, srPct: f.sr.srPct });

    const parts: string[] = [];
    if (f.fcr.defined && f.fcr.fcr != null) {
      parts.push(`FCR ${f.fcr.fcr.toFixed(2)} (${f.colors.fcr})`);
    } else {
      parts.push('FCR belum terdefinisi (butuh panen kg).');
    }
    if (f.sr.defined && f.sr.srPct != null) {
      parts.push(`SR ${f.sr.srPct.toFixed(0)}% (${f.colors.sr})`);
    } else {
      parts.push('SR belum terdefinisi (butuh tebar & pcs panen).');
    }

    return {
      cycleId: f.cycleId,
      code,
      pondCode: meta?.pondCode ?? '',
      feedKg: f.facts.feedKg,
      harvestKg: f.facts.harvestKg,
      fcr: f.fcr.defined && f.fcr.fcr != null ? f.fcr.fcr : null,
      srPct: f.sr.defined && f.sr.srPct != null ? f.sr.srPct : null,
      fcrColor: f.colors.fcr,
      srColor: f.colors.sr,
      insight: parts.join(' '),
    };
  });

  const fcrAsc = [...withFcr].sort((a, b) => a.fcr - b.fcr);
  const srDesc = [...withSr].sort((a, b) => b.srPct - a.srPct);

  return {
    view: 'productionAnalysis',
    question: 'Bagaimana efisiensi produksi?',
    workspace: {
      totalFeedKg,
      totalHarvestKg,
      bestFcr: fcrAsc[0] ?? null,
      worstFcr: fcrAsc.length ? fcrAsc[fcrAsc.length - 1]! : null,
      bestSr: srDesc[0] ?? null,
      worstSr: srDesc.length ? srDesc[srDesc.length - 1]! : null,
    },
    byCycle,
  };
}

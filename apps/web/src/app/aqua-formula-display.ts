/**
 * S01 helpers — fakta operasional & tampilan Formula.
 * Traceability: Doc 56 · 62 · Screen S01 · Journey J2
 *
 * Pakan hari ini = agregat event Feed (fakta), bukan rumus Formula.
 * SR / FCR / BOP / HPP / Profit = hanya dari GET .../formula (sama S06).
 */

export type FormulaSnapshotFe = {
  cycleId: string;
  state: string;
  facts?: {
    feedKg?: number;
    harvestKg?: number;
    stockedPcs?: number;
    harvestedPcs?: number;
    revenue?: number;
    expenseCount?: number;
  };
  bop?: { total?: number };
  hpp?: { hppPerKg?: number; defined?: boolean };
  fcr?: { fcr?: number; defined?: boolean };
  sr?: { srPct?: number; defined?: boolean };
  profit?: {
    grossProfit?: number;
    defined?: boolean;
  };
  targets?: {
    fcr?: number | null;
    srPct?: number | null;
  };
  colors?: {
    fcr?: 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL';
    sr?: 'GREEN' | 'YELLOW' | 'RED' | 'NEUTRAL';
  };
  deviations?: {
    fcr?: { deviationPct?: number; defined?: boolean };
  };
  computedAt?: string;
};

/** Sum quantityKg Feed RECORDED dengan eventAt di hari lokal `now`. Bukan Formula KPI. */
export function sumFeedKgToday(
  feeds: Array<{ quantityKg?: unknown; eventAt?: unknown; recordStatus?: unknown }>,
  now = new Date(),
): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let total = 0;
  for (const f of feeds) {
    if (String(f.recordStatus || 'RECORDED') === 'VOIDED') continue;
    const at = f.eventAt ? new Date(String(f.eventAt)) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (at.getFullYear() !== y || at.getMonth() !== m || at.getDate() !== d) continue;
    const kg = Number(f.quantityKg);
    if (Number.isFinite(kg) && kg > 0) total += kg;
  }
  return total;
}

export function fmtPct(n: number | undefined | null, digits = 0): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString('id-ID', { maximumFractionDigits: digits })}%`;
}

export function fmtFcr(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('id-ID', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function formatFcrPlanDeviation(formula: FormulaSnapshotFe | null): {
  value: string;
  note: string;
} {
  const d = formula?.deviations?.fcr;
  if (!d?.defined || d.deviationPct == null) {
    return {
      value: '—',
      note: formula?.targets?.fcr != null ? 'Menunggu data panen' : 'Belum ada target FCR',
    };
  }
  const pct = d.deviationPct;
  const sign = pct > 0 ? '+' : '';
  return {
    value: `${sign}${pct.toLocaleString('id-ID', { maximumFractionDigits: 0 })}% kumulatif`,
    note: 'FCR vs target (Formula)',
  };
}

export function srSignalNote(
  color: FormulaSnapshotFe['colors'] extends infer C
    ? C extends { sr?: infer S }
      ? S
      : never
    : never,
): string {
  if (color === 'RED') return 'Perlu perhatian';
  if (color === 'YELLOW') return 'Pantau kematian';
  if (color === 'GREEN') return 'Stabil';
  return '';
}

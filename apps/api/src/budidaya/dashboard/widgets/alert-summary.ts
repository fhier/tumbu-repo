/**
 * Widget: Alert Summary — hanya meneruskan warna dari Formula.
 * Dilarang: if (fcr > 1.3) → merah di sini.
 */

import type { CycleListRow, FormulaColor, FormulaSnapshot } from '../types';

export type AlertItem = {
  cycleId: string;
  code: string;
  metric: 'FCR' | 'SR' | 'BOP_DEV';
  color: Extract<FormulaColor, 'YELLOW' | 'RED'>;
};

export type AlertSummaryWidget = {
  widget: 'alertSummary';
  alerts: AlertItem[];
  yellowCount: number;
  redCount: number;
};

const ALERT_COLORS = new Set(['YELLOW', 'RED']);

export function buildAlertSummary(input: {
  cycles: CycleListRow[];
  formulas: FormulaSnapshot[];
}): AlertSummaryWidget {
  const byId = new Map(input.cycles.map((c) => [c.id, c]));
  const alerts: AlertItem[] = [];

  for (const f of input.formulas) {
    const code = byId.get(f.cycleId)?.code ?? f.cycleId;
    const push = (
      metric: AlertItem['metric'],
      color: FormulaColor,
    ) => {
      if (!ALERT_COLORS.has(color)) return;
      alerts.push({
        cycleId: f.cycleId,
        code,
        metric,
        color: color as AlertItem['color'],
      });
    };
    push('FCR', f.colors.fcr);
    push('SR', f.colors.sr);
    push('BOP_DEV', f.colors.bopDeviation);
  }

  return {
    widget: 'alertSummary',
    alerts,
    yellowCount: alerts.filter((a) => a.color === 'YELLOW').length,
    redCount: alerts.filter((a) => a.color === 'RED').length,
  };
}

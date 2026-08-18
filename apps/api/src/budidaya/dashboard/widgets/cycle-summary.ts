/**
 * Widget: Cycle Summary — presentasi daftar/status siklus.
 * Tidak menghitung KPI.
 */

import type { CycleListRow } from '../types';

export type CycleSummaryWidget = {
  widget: 'cycleSummary';
  pondsActive: number;
  cyclesRunning: number;
  cycles: Array<{
    id: string;
    code: string;
    state: string;
    pondName: string;
    pondCode: string;
    speciesName: string;
  }>;
};

export function buildCycleSummary(input: {
  pondsActive: number;
  cycles: CycleListRow[];
}): CycleSummaryWidget {
  return {
    widget: 'cycleSummary',
    pondsActive: input.pondsActive,
    cyclesRunning: input.cycles.length,
    cycles: input.cycles.map((c) => ({
      id: c.id,
      code: c.code,
      state: c.state,
      pondName: c.pondName,
      pondCode: c.pondCode,
      speciesName: c.speciesName,
    })),
  };
}

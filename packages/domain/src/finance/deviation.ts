import type { DeviationResult } from '../types';

export function computeDeviation(actual: number, target: number): DeviationResult {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  if (t <= 0) {
    return { deviationPct: undefined, target: t, actual: a, defined: false };
  }
  return {
    deviationPct: ((a - t) / t) * 100,
    target: t,
    actual: a,
    defined: true,
  };
}

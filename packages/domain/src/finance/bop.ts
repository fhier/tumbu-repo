import type { BopResult, CostLine } from '../types';

export function computeBop(lines: readonly CostLine[]): BopResult {
  let total = 0;
  let direct = 0;
  let indirect = 0;
  const bySource: Record<string, number> = {};

  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    total += amount;
    if (line.costClass === 'INDIRECT') indirect += amount;
    else direct += amount;
    bySource[line.source] = (bySource[line.source] ?? 0) + amount;
  }

  return { total, direct, indirect, bySource };
}

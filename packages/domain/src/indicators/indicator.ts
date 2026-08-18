import type { FormulaColor, IndicatorInput } from '../types';

export function colorFromRule(input: IndicatorInput): FormulaColor {
  const { direction, greenBound, yellowBound, value } = input;
  if (!Number.isFinite(value)) return 'NEUTRAL';

  if (direction === 'LOWER_BETTER') {
    if (value < greenBound) return 'GREEN';
    if (value < yellowBound) return 'YELLOW';
    return 'RED';
  }

  // HIGHER_BETTER
  if (value >= greenBound) return 'GREEN';
  if (value >= yellowBound) return 'YELLOW';
  return 'RED';
}

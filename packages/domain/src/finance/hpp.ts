import type { HppResult } from '../types';

export function computeHpp(bop: number, harvestKg: number): HppResult {
  const b = Number(bop) || 0;
  const kg = Number(harvestKg) || 0;
  if (kg <= 0) {
    return { hppPerKg: undefined, bop: b, harvestKg: kg, defined: false };
  }
  return { hppPerKg: b / kg, bop: b, harvestKg: kg, defined: true };
}

import type { FcrResult } from '../types';

export function computeFcr(feedKg: number, harvestKg: number): FcrResult {
  const feed = Number(feedKg) || 0;
  const harvest = Number(harvestKg) || 0;
  if (harvest <= 0) {
    return { fcr: undefined, feedKg: feed, harvestKg: harvest, defined: false };
  }
  return { fcr: feed / harvest, feedKg: feed, harvestKg: harvest, defined: true };
}

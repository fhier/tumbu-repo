/**
 * Sanity bounds for Budidaya field forms (S02–S05).
 * Catches typos / absurd values before API submit — not business rules.
 */

/** Max kg per single feed event (typical pond daily feed << this). */
export const MAX_FEED_KG = 50_000;

/** Max kg per single harvest event. */
export const MAX_HARVEST_KG = 100_000;

/** Max average sample weight in grams (50 kg/fish — absurd upper guard). */
export const MAX_SAMPLING_GRAM = 50_000;

/** Max sample count per sampling event. */
export const MAX_SAMPLE_COUNT_PCS = 10_000;

/** Max IDR cost / sale value per event. */
export const MAX_MONEY_IDR = 999_999_999_999;

export function parseDecimalInput(raw: string | number | null | undefined): number | null {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatLimitHint(value: number, unit: string): string {
  return `Nilai melebihi batas wajar (maks. ${value.toLocaleString('id-ID')} ${unit}). Periksa kembali input.`;
}

/** Tumbu Profit Advisor — estimasi margin pre-tebar (UX advisory). */

export const DEFAULT_SELL_PRICE_PER_KG = 26000;

export type ProfitAdvisorResult = {
  harvestKg: number;
  sellPricePerKg: number;
  estimatedRevenue: number;
  bopRp: number;
  margin: number;
  healthy: boolean;
};

export function computeProfitAdvisor(input: {
  harvestKg: number | null;
  bopRp: number | null;
  sellPricePerKg: number;
}): ProfitAdvisorResult | null {
  const harvestKg = input.harvestKg;
  const bopRp = input.bopRp;
  const sell = Number(input.sellPricePerKg) || 0;
  if (harvestKg == null || !(harvestKg > 0) || bopRp == null || !(sell > 0)) return null;
  const estimatedRevenue = Math.round(harvestKg * sell);
  const margin = estimatedRevenue - bopRp;
  return {
    harvestKg,
    sellPricePerKg: sell,
    estimatedRevenue,
    bopRp,
    margin,
    healthy: margin >= 0,
  };
}

export const PROFIT_WARNING_TEXT =
  'Potensi Margin Riskan: Estimasi biaya lebih tinggi dari penjualan. Rekomendasi Tumbu: Naikkan populasi tebar untuk efisiensi operasional, tekan FCR ke <1.0 dengan probiotik, atau atur target harga jual langsung konsumen.';

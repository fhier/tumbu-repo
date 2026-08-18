/**
 * Kalkulator populasi & rekomendasi pakan — derived UX (bukan Formula Engine SSOT).
 * Dipakai saat catat kematian harian untuk SR running, biomassa, feeding adjustment.
 */

export type PopulationFacts = {
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
  /** Kematian yang sedang diinput (preview) */
  pendingDeadPcs?: number;
};

export type PopulationInsight = {
  activePcs: number;
  runningSrPct: number | null;
  biomassKg: number | null;
  dailyFeedKg: number | null;
  feedingRatePct: number | null;
  feedNote: string;
  srNote: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** SR berjalan = ekor hidup ÷ tebar × 100 (sebelum panen penuh). */
export function computeRunningSr(facts: PopulationFacts): number | null {
  const stocked = Math.max(0, facts.stockedPcs);
  if (stocked <= 0) return null;
  const dead = Math.max(0, facts.deadPcs) + Math.max(0, facts.pendingDeadPcs || 0);
  const harvested = Math.max(0, facts.harvestedPcs);
  const active = Math.max(0, stocked - dead - harvested);
  return Math.round((active / stocked) * 1000) / 10;
}

export function computeActivePcsFromFacts(facts: PopulationFacts): number {
  const stocked = Math.max(0, facts.stockedPcs);
  const dead = Math.max(0, facts.deadPcs) + Math.max(0, facts.pendingDeadPcs || 0);
  const harvested = Math.max(0, facts.harvestedPcs);
  return Math.max(0, stocked - dead - harvested);
}

/** Biomassa aktif (kg) ≈ ekor hidup × berat rata (g) / 1000 */
export function computeBiomassKg(activePcs: number, avgWeightGram: number): number | null {
  if (!(activePcs > 0) || !(avgWeightGram > 0)) return null;
  return Math.round((activePcs * avgWeightGram) / 1000 * 100) / 100;
}

/**
 * Rekomendasi pakan harian — % body weight disesuaikan mortalitas & FCR target.
 * Urban / kolam: 2–4% BB standar grow-out.
 */
export function recommendDailyFeed(input: {
  activePcs: number;
  avgWeightGram: number;
  targetFcr?: number | null;
  mortalityTodayPcs?: number;
  stockedPcs?: number;
}): { kg: number; ratePct: number; note: string } | null {
  const { activePcs, avgWeightGram } = input;
  if (!(activePcs > 0) || !(avgWeightGram > 0)) return null;

  let ratePct = avgWeightGram < 20 ? 4 : avgWeightGram < 80 ? 3 : 2.5;

  const deadToday = Number(input.mortalityTodayPcs) || 0;
  const stocked = Number(input.stockedPcs) || 0;
  if (deadToday > 0 && stocked > 0) {
    const spike = deadToday / stocked;
    if (spike >= 0.05) {
      ratePct *= 0.7;
    } else if (spike >= 0.02) {
      ratePct *= 0.85;
    }
  }

  if (input.targetFcr != null && input.targetFcr > 0 && input.targetFcr < 1.1) {
    ratePct = Math.min(ratePct, 2.8);
  }

  ratePct = clamp(Math.round(ratePct * 10) / 10, 1.5, 5);
  const biomass = (activePcs * avgWeightGram) / 1000;
  const kg = Math.round(biomass * (ratePct / 100) * 100) / 100;

  let note = `Pakan ${ratePct}% biomassa aktif (~${kg} kg/hari).`;
  if (deadToday > 0) {
    note += ' Dosis dikurangi karena ada kematian — pantau sisa pakan 30 menit.';
  } else {
    note += ' Sesuaikan jika pakan tersisa >30 menit atau ikan kurang nafsu.';
  }

  return { kg, ratePct, note };
}

export function buildPopulationInsight(
  facts: PopulationFacts,
  opts: {
    avgWeightGram?: number | null;
    targetFcr?: number | null;
    targetSrPct?: number | null;
  } = {},
): PopulationInsight {
  const activePcs = computeActivePcsFromFacts(facts);
  const runningSrPct = computeRunningSr(facts);
  const avgW = opts.avgWeightGram && opts.avgWeightGram > 0 ? opts.avgWeightGram : null;
  const biomassKg = avgW ? computeBiomassKg(activePcs, avgW) : null;

  const feed = avgW
    ? recommendDailyFeed({
      activePcs,
      avgWeightGram: avgW,
      targetFcr: opts.targetFcr,
      mortalityTodayPcs: facts.pendingDeadPcs,
      stockedPcs: facts.stockedPcs,
    })
    : null;

  let srNote = 'SR berjalan dihitung dari tebar − mortalitas − panen parsial.';
  if (runningSrPct != null && opts.targetSrPct != null && runningSrPct < opts.targetSrPct - 5) {
    srNote = `SR berjalan ${runningSrPct}% — di bawah target ${opts.targetSrPct}%. Evaluasi kualitas air & kepadatan.`;
  }

  return {
    activePcs,
    runningSrPct,
    biomassKg,
    dailyFeedKg: feed?.kg ?? null,
    feedingRatePct: feed?.ratePct ?? null,
    feedNote: feed?.note ?? 'Isi berat rata (sampling) untuk rekomendasi pakan harian.',
    srNote,
  };
}

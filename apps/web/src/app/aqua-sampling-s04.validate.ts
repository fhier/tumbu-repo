/**
 * S04 Sampling — validation + derived insight (not persisted).
 * Trace: Doc 56 · 62 · Screen S04 · Journey J3 (Doc 61 sampling day)
 *
 * Insight = interpretasi sementara dari data operasional + target siklus.
 * Bukan source of truth · tidak disimpan ke DB.
 */

import {
  MAX_SAMPLE_COUNT_PCS,
  MAX_SAMPLING_GRAM,
  formatLimitHint,
  parseDecimalInput,
} from './aqua-input-limits';

export type SamplingS04Input = {
  averageWeightGram: string | number | null | undefined;
  cycleState: string;
  sampleCountPcs?: string | number | null | undefined;
};

export type SamplingInsightTone = 'ok' | 'warn' | 'over' | 'neutral';

export type SamplingInsight = {
  summary: string;
  tone: SamplingInsightTone;
  meaning: string;
  chips: string[];
  /** For display only */
  measuredGram: number;
  benchmarkGram: number | null;
  dayNumber: number | null;
};

export function isTerminalCycleState(state: string): boolean {
  return state === 'CLOSED' || state === 'CANCELLED';
}

export function canRecordSamplingOnState(state: string): boolean {
  return state === 'ACTIVE' || state === 'HARVESTING';
}

export function validateSamplingS04(input: SamplingS04Input): string | null {
  if (isTerminalCycleState(input.cycleState)) {
    return 'Tidak bisa mencatat sampling pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (!canRecordSamplingOnState(input.cycleState)) {
    return `Sampling hanya untuk siklus aktif / panen berlangsung (sekarang: ${input.cycleState}).`;
  }

  const g = parseDecimalInput(input.averageWeightGram);
  if (g == null) return 'Berat rata-rata sampel (gram) wajib diisi.';
  if (g <= 0) return 'Berat sampel harus lebih dari 0.';
  if (g > MAX_SAMPLING_GRAM) return formatLimitHint(MAX_SAMPLING_GRAM, 'gram');

  if (input.sampleCountPcs != null && String(input.sampleCountPcs).trim() !== '') {
    const n = parseDecimalInput(input.sampleCountPcs);
    if (n == null || n < 0) return 'Jumlah sampel tidak valid.';
    if (!Number.isInteger(n)) return 'Jumlah sampel harus bilangan bulat.';
    if (n > MAX_SAMPLE_COUNT_PCS) return formatLimitHint(MAX_SAMPLE_COUNT_PCS, 'ekor sampel');
  }

  return null;
}

/**
 * Derived only — recomputable anytime from ops data + cycle targets.
 * Band ±5% vs patokan = "sesuai rencana".
 */
export function deriveSamplingInsight(opts: {
  averageWeightGram: number;
  targetWeightGram?: number | null;
  dayNumber?: number | null;
}): SamplingInsight {
  const measured = opts.averageWeightGram;
  const bench =
    opts.targetWeightGram != null && Number(opts.targetWeightGram) > 0
      ? Number(opts.targetWeightGram)
      : null;
  const day = opts.dayNumber ?? null;

  const chips = [
    'Pertahankan pakan',
    'Perlu evaluasi pakan?',
    'Pertimbangkan panen',
  ];

  if (bench == null) {
    return {
      summary: 'Sampling tercatat.',
      tone: 'neutral',
      meaning: `${measured} g${day != null ? ` pada hari ke-${day}` : ''}. Belum ada patokan berat di rencana siklus — bandingkan dengan kebiasaan Anda. Sistem tidak memutuskan tindakan.`,
      chips,
      measuredGram: measured,
      benchmarkGram: null,
      dayNumber: day,
    };
  }

  const ratio = measured / bench;
  const dayPart = day != null ? ` pada hari ke-${day}` : '';
  if (ratio < 0.95) {
    return {
      summary: 'Di bawah target.',
      tone: 'warn',
      meaning: `${measured} g${dayPart} sedikit di bawah patokan ${bench} g. Pertumbuhan masih berjalan. Anda bisa mengevaluasi pakan — sistem tidak memutuskan tindakan.`,
      chips,
      measuredGram: measured,
      benchmarkGram: bench,
      dayNumber: day,
    };
  }
  if (ratio > 1.05) {
    return {
      summary: 'Di atas patokan.',
      tone: 'over',
      meaning: `${measured} g${dayPart} di atas patokan ${bench} g. Pertimbangkan apakah jadwal panen atau pakan perlu ditinjau — keputusan tetap di Anda.`,
      chips,
      measuredGram: measured,
      benchmarkGram: bench,
      dayNumber: day,
    };
  }
  return {
    summary: 'Pertumbuhan sesuai rencana.',
    tone: 'ok',
    meaning: `${measured} g${dayPart} mendekati patokan ${bench} g. Pertumbuhan sesuai rencana. Chip di bawah hanya membantu berpikir — tidak dijalankan otomatis.`,
    chips,
    measuredGram: measured,
    benchmarkGram: bench,
    dayNumber: day,
  };
}

export function isSamplingFormDirty(opts: {
  averageWeightGram: string;
  sampleCountPcs: string;
  eventAtLocal: string;
  defaultEventAtLocal: string;
}): boolean {
  if (opts.averageWeightGram.trim() !== '') return true;
  if (opts.sampleCountPcs.trim() !== '') return true;
  if (opts.eventAtLocal && opts.eventAtLocal !== opts.defaultEventAtLocal) return true;
  return false;
}

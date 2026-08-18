/**
 * S04 sampling validation + derived insight (mirrors FE aqua-sampling-s04.validate.ts).
 * Insight must NOT be treated as persisted business state.
 */

function validateSamplingS04(input: {
  averageWeightGram: string;
  cycleState: string;
}): string | null {
  if (input.cycleState === 'CLOSED' || input.cycleState === 'CANCELLED') {
    return 'Tidak bisa mencatat sampling pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (input.cycleState !== 'ACTIVE' && input.cycleState !== 'HARVESTING') {
    return 'Sampling hanya untuk siklus aktif.';
  }
  const raw = String(input.averageWeightGram ?? '').trim().replace(',', '.');
  if (!raw) return 'Berat rata-rata sampel (gram) wajib diisi.';
  const g = Number(raw);
  if (!Number.isFinite(g) || g < 0) return 'Berat sampel tidak valid.';
  if (g === 0) return 'Berat sampel harus lebih dari 0.';
  return null;
}

function deriveSamplingInsight(opts: {
  averageWeightGram: number;
  targetWeightGram?: number | null;
  dayNumber?: number | null;
}): { summary: string; tone: string } {
  const measured = opts.averageWeightGram;
  const bench = opts.targetWeightGram != null && opts.targetWeightGram > 0 ? opts.targetWeightGram : null;
  if (bench == null) return { summary: 'Sampling tercatat.', tone: 'neutral' };
  const ratio = measured / bench;
  if (ratio < 0.95) return { summary: 'Di bawah target.', tone: 'warn' };
  if (ratio > 1.05) return { summary: 'Di atas patokan.', tone: 'over' };
  return { summary: 'Pertumbuhan sesuai rencana.', tone: 'ok' };
}

describe('S04 Sampling validation & derived insight (Sprint 4)', () => {
  it('validates numeric weight and active cycle', () => {
    expect(
      validateSamplingS04({ averageWeightGram: '', cycleState: 'ACTIVE' }),
    ).toMatch(/wajib/i);
    expect(
      validateSamplingS04({ averageWeightGram: '-1', cycleState: 'ACTIVE' }),
    ).toMatch(/valid|negatif/i);
    expect(
      validateSamplingS04({ averageWeightGram: '118', cycleState: 'CLOSED' }),
    ).toMatch(/ditutup/i);
    expect(
      validateSamplingS04({ averageWeightGram: '118', cycleState: 'ACTIVE' }),
    ).toBeNull();
  });

  it('derives summary without persisting state', () => {
    expect(
      deriveSamplingInsight({ averageWeightGram: 118, targetWeightGram: 125 }).summary,
    ).toBe('Di bawah target.');
    expect(
      deriveSamplingInsight({ averageWeightGram: 125, targetWeightGram: 125 }).summary,
    ).toBe('Pertumbuhan sesuai rencana.');
    expect(
      deriveSamplingInsight({ averageWeightGram: 140, targetWeightGram: 125 }).summary,
    ).toBe('Di atas patokan.');
  });
});

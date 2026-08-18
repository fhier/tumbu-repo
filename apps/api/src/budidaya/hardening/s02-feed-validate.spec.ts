/**
 * S02 Catat Pakan — validation contract tests (Sprint 2).
 * Mirrors apps/web/app/aqua-feed-s02.validate.ts (keep in sync).
 */

function isTerminalCycleState(state: string): boolean {
  return state === 'CLOSED' || state === 'CANCELLED';
}

function canRecordFeedOnState(state: string): boolean {
  return state === 'ACTIVE' || state === 'HARVESTING';
}

function validateFeedS02(input: {
  quantityKg: string | number | null | undefined;
  cycleState: string;
}): string | null {
  if (isTerminalCycleState(input.cycleState)) {
    return 'Tidak bisa mencatat pakan pada siklus yang sudah ditutup atau dibatalkan.';
  }
  if (!canRecordFeedOnState(input.cycleState)) {
    return `Catat pakan hanya untuk siklus Berjalan / Panen berlangsung (sekarang: ${input.cycleState}).`;
  }
  const raw = String(input.quantityKg ?? '').trim().replace(',', '.');
  if (!raw) return 'Jumlah pakan (kg) wajib diisi.';
  const qty = Number(raw);
  if (!Number.isFinite(qty)) return 'Jumlah pakan tidak valid.';
  if (qty <= 0) return 'Jumlah pakan harus lebih dari 0.';
  return null;
}

function isFeedFormDirty(opts: {
  quantityKg: string;
  showCost: boolean;
  totalCost: string;
}): boolean {
  if (opts.quantityKg.trim() !== '') return true;
  if (opts.showCost && opts.totalCost.trim() !== '') return true;
  return false;
}

describe('S02 Catat Pakan validation (Sprint 2)', () => {
  it('requires quantity > 0', () => {
    expect(validateFeedS02({ quantityKg: '', cycleState: 'ACTIVE' })).toMatch(/wajib/i);
    expect(validateFeedS02({ quantityKg: '0', cycleState: 'ACTIVE' })).toMatch(/lebih dari 0/i);
    expect(validateFeedS02({ quantityKg: '15', cycleState: 'ACTIVE' })).toBeNull();
  });

  it('rejects closed cycles', () => {
    expect(isTerminalCycleState('CLOSED')).toBe(true);
    expect(validateFeedS02({ quantityKg: '10', cycleState: 'CLOSED' })).toMatch(/ditutup/i);
    expect(canRecordFeedOnState('ACTIVE')).toBe(true);
    expect(canRecordFeedOnState('READY')).toBe(false);
  });

  it('detects dirty form for Safe Exit', () => {
    expect(
      isFeedFormDirty({ quantityKg: '', showCost: false, totalCost: '' }),
    ).toBe(false);
    expect(
      isFeedFormDirty({ quantityKg: '1', showCost: false, totalCost: '' }),
    ).toBe(true);
  });
});

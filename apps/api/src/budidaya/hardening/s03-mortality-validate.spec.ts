/**
 * S03 mortality validation contract (mirrors FE aqua-mortality-s03.validate.ts).
 */

function computeActivePcs(facts: {
  stockedPcs: number;
  deadPcs: number;
  harvestedPcs: number;
}): number {
  const raw =
    Math.max(0, facts.stockedPcs) -
    Math.max(0, facts.deadPcs) -
    Math.max(0, facts.harvestedPcs);
  return raw < 0 ? 0 : raw;
}

function validateMortalityS03(input: {
  deadCountPcs: string;
  cycleState: string;
  activePcs: number;
}): string | null {
  if (input.cycleState === 'CLOSED' || input.cycleState === 'CANCELLED') {
    return 'Tidak bisa mencatat kematian pada siklus yang sudah ditutup atau dibatalkan.';
  }
  const raw = String(input.deadCountPcs ?? '').trim().replace(',', '.');
  if (!raw) return 'Jumlah ikan mati (ekor) wajib diisi.';
  const qty = Number(raw);
  if (!Number.isFinite(qty) || qty <= 0) return 'Jumlah kematian harus lebih dari 0.';
  if (qty > input.activePcs) {
    return `Jumlah kematian tidak boleh melebihi populasi aktif (${input.activePcs} ekor).`;
  }
  return null;
}

describe('S03 Catat Kematian validation (Sprint 3)', () => {
  it('requires count > 0 and not over active population', () => {
    expect(
      validateMortalityS03({ deadCountPcs: '', cycleState: 'ACTIVE', activePcs: 100 }),
    ).toMatch(/wajib/i);
    expect(
      validateMortalityS03({ deadCountPcs: '0', cycleState: 'ACTIVE', activePcs: 100 }),
    ).toMatch(/lebih dari 0/i);
    expect(
      validateMortalityS03({ deadCountPcs: '101', cycleState: 'ACTIVE', activePcs: 100 }),
    ).toMatch(/populasi aktif/i);
    expect(
      validateMortalityS03({ deadCountPcs: '10', cycleState: 'ACTIVE', activePcs: 100 }),
    ).toBeNull();
  });

  it('rejects closed cycles', () => {
    expect(
      validateMortalityS03({ deadCountPcs: '1', cycleState: 'CLOSED', activePcs: 50 }),
    ).toMatch(/ditutup/i);
  });

  it('computes active pcs without going negative', () => {
    expect(computeActivePcs({ stockedPcs: 100, deadPcs: 40, harvestedPcs: 20 })).toBe(40);
    expect(computeActivePcs({ stockedPcs: 10, deadPcs: 8, harvestedPcs: 5 })).toBe(0);
  });
});

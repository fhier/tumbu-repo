/**
 * S05 harvest validation contract (KL-003).
 */
function validateHarvestS05(input: {
  quantityKg: string;
  quantityPcs: string;
  cycleState: string;
  activePcs: number;
}): string | null {
  if (input.cycleState === 'CLOSED') return 'ditutup';
  const kg = Number(String(input.quantityKg).replace(',', '.'));
  if (!Number.isFinite(kg) || kg <= 0) return 'kg';
  if (!String(input.quantityPcs).trim()) return 'quantityPcs wajib';
  const pcs = Number(String(input.quantityPcs).replace(',', '.'));
  if (!Number.isFinite(pcs) || pcs <= 0) return 'pcs';
  if (pcs > input.activePcs) return 'populasi aktif';
  return null;
}

describe('S05 Harvest + KL-003 (Sprint 5)', () => {
  it('requires quantityPcs and respects active population', () => {
    expect(
      validateHarvestS05({
        quantityKg: '10',
        quantityPcs: '',
        cycleState: 'ACTIVE',
        activePcs: 100,
      }),
    ).toMatch(/quantityPcs/i);
    expect(
      validateHarvestS05({
        quantityKg: '10',
        quantityPcs: '101',
        cycleState: 'ACTIVE',
        activePcs: 100,
      }),
    ).toMatch(/populasi/i);
    expect(
      validateHarvestS05({
        quantityKg: '10',
        quantityPcs: '50',
        cycleState: 'ACTIVE',
        activePcs: 100,
      }),
    ).toBeNull();
  });
});

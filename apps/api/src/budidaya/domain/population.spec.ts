import {
  canRecordHarvestPcs,
  canRecordMortality,
  computeActivePopulation,
} from '@tumbu/domain';

describe('Active population integrity (Sprint 3)', () => {
  it('derives active = stocked − dead − harvested', () => {
    expect(
      computeActivePopulation({
        stockedPcs: 1000,
        deadPcs: 50,
        harvestedPcs: 100,
      }).activePcs,
    ).toBe(850);
  });

  it('clamps display active at 0 (no negative stock)', () => {
    expect(
      computeActivePopulation({
        stockedPcs: 100,
        deadPcs: 80,
        harvestedPcs: 40,
      }).activePcs,
    ).toBe(0);
  });

  it('rejects mortality that would exceed active population', () => {
    const facts = { stockedPcs: 500, deadPcs: 0, harvestedPcs: 0 };
    expect(canRecordMortality(facts, 500).ok).toBe(true);
    expect(canRecordMortality(facts, 501).ok).toBe(false);
    expect(canRecordMortality({ stockedPcs: 0, deadPcs: 0, harvestedPcs: 0 }, 1).ok).toBe(
      false,
    );
  });

  it('accounts for prior mortality and harvest pcs', () => {
    const facts = { stockedPcs: 1000, deadPcs: 200, harvestedPcs: 300 };
    const r = canRecordMortality(facts, 500);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.activeAfter).toBe(0);
    expect(canRecordMortality(facts, 501).ok).toBe(false);
  });

  it('KL-003: harvest pcs required and reduces active population', () => {
    const facts = { stockedPcs: 1000, deadPcs: 100, harvestedPcs: 200 };
    expect(canRecordHarvestPcs(facts, 0).ok).toBe(false);
    expect(canRecordHarvestPcs(facts, 700).ok).toBe(true);
    expect(canRecordHarvestPcs(facts, 701).ok).toBe(false);
    const ok = canRecordHarvestPcs(facts, 700);
    if (ok.ok) expect(ok.activeAfter).toBe(0);
  });
});

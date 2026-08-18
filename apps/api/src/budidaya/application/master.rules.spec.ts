import {
  assertCostClass,
  assertMetricDirection,
  assertPondStatus,
  MASTER_NO_SIDE_EFFECT,
} from './master.rules';

describe('Budidaya Master 8.2 rules', () => {
  it('keeps master no-side-effect contract flag', () => {
    expect(MASTER_NO_SIDE_EFFECT).toBe(true);
  });

  it('validates pond statuses', () => {
    expect(assertPondStatus('IDLE')).toBe(true);
    expect(assertPondStatus('RETIRED')).toBe(true);
    expect(assertPondStatus('ACTIVE')).toBe(false);
  });

  it('validates cost class DIRECT/INDIRECT', () => {
    expect(assertCostClass('DIRECT')).toBe(true);
    expect(assertCostClass('INDIRECT')).toBe(true);
    expect(assertCostClass('VARIABLE')).toBe(false);
  });

  it('validates indicator directions', () => {
    expect(assertMetricDirection('LOWER_BETTER')).toBe(true);
    expect(assertMetricDirection('HIGHER_BETTER')).toBe(true);
    expect(assertMetricDirection('UP')).toBe(false);
  });
});

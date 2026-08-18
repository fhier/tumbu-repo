import {
  computeBop,
  computeDeviation,
  computeFcr,
  computeHpp,
  computeProfit,
  computeSr,
  colorFromRule,
} from '@tumbu/domain';

describe('Formula calculators (8.5)', () => {
  describe('computeBop', () => {
    it('sums Direct/Indirect and bySource', () => {
      const r = computeBop([
        { amount: 100, costClass: 'DIRECT', source: 'EXPENSE' },
        { amount: 40, costClass: 'INDIRECT', source: 'EXPENSE' },
        { amount: 10, costClass: 'DIRECT', source: 'PROVISIONAL_FEED' },
      ]);
      expect(r.total).toBe(150);
      expect(r.direct).toBe(110);
      expect(r.indirect).toBe(40);
      expect(r.bySource.EXPENSE).toBe(140);
      expect(r.bySource.PROVISIONAL_FEED).toBe(10);
    });
  });

  describe('computeHpp', () => {
    it('divides BOP by harvest kg', () => {
      expect(computeHpp(1000, 50).hppPerKg).toBe(20);
      expect(computeHpp(1000, 50).defined).toBe(true);
    });
    it('is undefined when harvest kg is 0', () => {
      const r = computeHpp(500, 0);
      expect(r.defined).toBe(false);
      expect(r.hppPerKg).toBeUndefined();
    });
  });

  describe('computeFcr', () => {
    it('feed / harvest', () => {
      expect(computeFcr(120, 100).fcr).toBeCloseTo(1.2);
    });
    it('undefined without harvest', () => {
      expect(computeFcr(10, 0).defined).toBe(false);
    });
  });

  describe('computeSr', () => {
    it('harvested / stocked × 100', () => {
      expect(computeSr(1000, 850).srPct).toBeCloseTo(85);
    });
    it('undefined without stocking', () => {
      expect(computeSr(0, 10).defined).toBe(false);
    });
  });

  describe('computeProfit', () => {
    it('gross profit and margin', () => {
      const r = computeProfit(2000, 1500);
      expect(r.grossProfit).toBe(500);
      expect(r.marginPct).toBeCloseTo(25);
    });
    it('margin undefined when revenue is 0', () => {
      expect(computeProfit(0, 100).marginPct).toBeUndefined();
    });
  });

  describe('computeDeviation', () => {
    it('computes percent over target', () => {
      expect(computeDeviation(5600, 5000).deviationPct).toBeCloseTo(12);
    });
  });

  describe('colorFromRule', () => {
    it('LOWER_BETTER for FCR-like values', () => {
      expect(
        colorFromRule({
          direction: 'LOWER_BETTER',
          greenBound: 1.1,
          yellowBound: 1.3,
          value: 1.0,
        }),
      ).toBe('GREEN');
      expect(
        colorFromRule({
          direction: 'LOWER_BETTER',
          greenBound: 1.1,
          yellowBound: 1.3,
          value: 1.2,
        }),
      ).toBe('YELLOW');
      expect(
        colorFromRule({
          direction: 'LOWER_BETTER',
          greenBound: 1.1,
          yellowBound: 1.3,
          value: 1.5,
        }),
      ).toBe('RED');
    });

    it('HIGHER_BETTER for SR-like values', () => {
      expect(
        colorFromRule({
          direction: 'HIGHER_BETTER',
          greenBound: 95,
          yellowBound: 85,
          value: 96,
        }),
      ).toBe('GREEN');
      expect(
        colorFromRule({
          direction: 'HIGHER_BETTER',
          greenBound: 95,
          yellowBound: 85,
          value: 90,
        }),
      ).toBe('YELLOW');
      expect(
        colorFromRule({
          direction: 'HIGHER_BETTER',
          greenBound: 95,
          yellowBound: 85,
          value: 80,
        }),
      ).toBe('RED');
    });
  });
});

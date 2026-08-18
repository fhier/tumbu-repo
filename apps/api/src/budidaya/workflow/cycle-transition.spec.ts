import {
  assertCycleTransition,
  canUpdateCyclePlan,
  isTerminalCycleState,
  listAllowedTargets,
} from './cycle-transition';

describe('CultureCycle transitions (WORKFLOW)', () => {
  it('allows PLANNED → READY via MARK_READY', () => {
    expect(assertCycleTransition('PLANNED', 'READY', 'MARK_READY')).toEqual({
      from: 'PLANNED',
      to: 'READY',
    });
  });

  it('rejects PLANNED → ACTIVE without STOCKING_EVENT', () => {
    expect(() => assertCycleTransition('PLANNED', 'ACTIVE', 'MARK_READY')).toThrow(
      /tidak diizinkan/,
    );
  });

  it('allows READY → ACTIVE only via STOCKING_EVENT', () => {
    expect(assertCycleTransition('READY', 'ACTIVE', 'STOCKING_EVENT').to).toBe('ACTIVE');
    expect(() => assertCycleTransition('READY', 'ACTIVE', 'MARK_READY')).toThrow();
  });

  it('allows ACTIVE → HARVESTING via HARVEST_EVENT', () => {
    expect(assertCycleTransition('ACTIVE', 'HARVESTING', 'HARVEST_EVENT').to).toBe(
      'HARVESTING',
    );
  });

  it('allows close from ACTIVE or HARVESTING via CLOSE_EVENT', () => {
    expect(assertCycleTransition('ACTIVE', 'CLOSED', 'CLOSE_EVENT').to).toBe('CLOSED');
    expect(assertCycleTransition('HARVESTING', 'CLOSED', 'CLOSE_EVENT').to).toBe('CLOSED');
  });

  it('rejects transitions from CLOSED/CANCELLED', () => {
    expect(() => assertCycleTransition('CLOSED', 'ACTIVE', 'STOCKING_EVENT')).toThrow(
      /terminal/,
    );
    expect(() => assertCycleTransition('CANCELLED', 'READY', 'MARK_READY')).toThrow(
      /terminal/,
    );
  });

  it('lists public cancel targets from PLANNED', () => {
    expect(listAllowedTargets('PLANNED', 'CANCEL')).toContain('CANCELLED');
    expect(listAllowedTargets('PLANNED', 'MARK_READY')).toEqual(['READY']);
  });

  it('allows plan update only in PLANNED/READY', () => {
    expect(canUpdateCyclePlan('PLANNED')).toBe(true);
    expect(canUpdateCyclePlan('READY')).toBe(true);
    expect(canUpdateCyclePlan('ACTIVE')).toBe(false);
    expect(isTerminalCycleState('CLOSED')).toBe(true);
  });

  it('rejects illegal READY → CLOSED and PLANNED → HARVESTING', () => {
    expect(() => assertCycleTransition('READY', 'CLOSED', 'CLOSE_EVENT')).toThrow(
      /tidak diizinkan/,
    );
    expect(() =>
      assertCycleTransition('PLANNED', 'HARVESTING', 'HARVEST_EVENT'),
    ).toThrow(/tidak diizinkan/);
  });

  it('rejects inventing non-domain states', () => {
    expect(() =>
      assertCycleTransition('ACTIVE', 'READY_TO_CLOSE' as never, 'CLOSE_EVENT'),
    ).toThrow(/tidak dikenal|tidak diizinkan/);
    expect(() =>
      assertCycleTransition('SIAP_DITUTUP' as never, 'CLOSED', 'CLOSE_EVENT'),
    ).toThrow(/tidak dikenal|tidak diizinkan/);
  });

  it('allows HARVESTING → HARVESTING via HARVEST_EVENT (partial harvest)', () => {
    expect(
      assertCycleTransition('HARVESTING', 'HARVESTING', 'HARVEST_EVENT').to,
    ).toBe('HARVESTING');
  });
});

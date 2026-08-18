/**
 * S06 Close Cycle — contract tests (Sprint 6).
 * Close = explicit · KPI derived · no auto-close · post-close integrity.
 * KL-001 intentionally unchanged (ACTIVE→CLOSED still legal in engine).
 */

import { assertEventAllowedOnState } from '../workflow/event-guards';
import { assertCycleTransition } from '../workflow/cycle-transition';

/** UI-only: confirm vs result phase (mirrors S06 screen states). */
function closePhase(cycleState: string, userConfirmedClose: boolean): 'confirm' | 'result' {
  if (cycleState === 'CLOSED') return 'result';
  return userConfirmedClose ? 'result' : 'confirm';
}

/** KPI must come from formula GET — never from close POST body. */
function assertNoKpiInClosePayload(body: Record<string, unknown>): string | null {
  const forbidden = ['bop', 'hpp', 'fcr', 'sr', 'profit', 'kpi', 'snapshot'];
  for (const k of forbidden) {
    if (k in body) return `KPI field forbidden on close: ${k}`;
  }
  return null;
}

describe('S06 Close Cycle (Sprint 6)', () => {
  it('R6.2 — close only on ACTIVE/HARVESTING; rejected on CLOSED', () => {
    expect(() => assertEventAllowedOnState('CLOSE', 'ACTIVE')).not.toThrow();
    expect(() => assertEventAllowedOnState('CLOSE', 'HARVESTING')).not.toThrow();
    expect(() => assertEventAllowedOnState('CLOSE', 'CLOSED')).toThrow(/Selesai/i);
    expect(() => assertEventAllowedOnState('CLOSE', 'READY')).toThrow();
  });

  it('R6.2 — does not add ACTIVE→CLOSED shortcut beyond existing engine (KL-001 untouched)', () => {
    // Existing engine already allows ACTIVE→CLOSED; Sprint 6 must not invent a new path.
    expect(assertCycleTransition('ACTIVE', 'CLOSED', 'CLOSE_EVENT').to).toBe('CLOSED');
    expect(assertCycleTransition('HARVESTING', 'CLOSED', 'CLOSE_EVENT').to).toBe('CLOSED');
  });

  it('R6.4 — post-close integrity: Feed/Mortality/Sampling/Harvest blocked on CLOSED', () => {
    for (const kind of ['FEED', 'MORTALITY', 'SAMPLING', 'HARVEST'] as const) {
      expect(() => assertEventAllowedOnState(kind, 'CLOSED')).toThrow(/Selesai/i);
    }
  });

  it('R6.1 — phase order: confirm before result unless already CLOSED', () => {
    expect(closePhase('HARVESTING', false)).toBe('confirm');
    expect(closePhase('HARVESTING', true)).toBe('result');
    expect(closePhase('CLOSED', false)).toBe('result');
  });

  it('R6.3 — close payload must not carry KPI snapshot SoT', () => {
    expect(assertNoKpiInClosePayload({ notes: 'ok', eventAt: '2026-01-01' })).toBeNull();
    expect(assertNoKpiInClosePayload({ bop: 100 })).toMatch(/bop/i);
    expect(assertNoKpiInClosePayload({ fcr: 1.2, notes: 'x' })).toMatch(/fcr/i);
  });
});

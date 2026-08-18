import { evaluateReady, rulePasses, shouldForceOnboarding } from './ready.engine';
import type { ReadyConfig } from './extension.types';

describe('Ready engine (P1 capability)', () => {
  const aquaReady: ReadyConfig = {
    forceUntilReady: true,
    facts: ['activePonds', 'activeSpecies'],
    rules: [
      { type: 'min_count', fact: 'activePonds', min: 1 },
      { type: 'min_count', fact: 'activeSpecies', min: 1 },
    ],
  };

  it('is not ready until both counts satisfied', () => {
    expect(evaluateReady(aquaReady, { activePonds: 0, activeSpecies: 0 })).toBe(false);
    expect(evaluateReady(aquaReady, { activePonds: 1, activeSpecies: 0 })).toBe(false);
    expect(evaluateReady(aquaReady, { activePonds: 1, activeSpecies: 1 })).toBe(true);
  });

  it('forces onboarding only when configured and not ready', () => {
    expect(shouldForceOnboarding(aquaReady, false)).toBe(true);
    expect(shouldForceOnboarding(aquaReady, true)).toBe(false);
    expect(shouldForceOnboarding({ forceUntilReady: false, facts: [], rules: [{ type: 'always_ready' }] }, false)).toBe(false);
  });

  it('always_ready rule passes', () => {
    expect(rulePasses({ type: 'always_ready' }, {})).toBe(true);
  });
});

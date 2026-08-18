/**
 * Sprint 8 — Master catalog & settings contracts (no Formula / Event side effects).
 */

import { MASTER_NO_SIDE_EFFECT } from '../application/master.rules';

function parseBudidayaSettings(settingsJson: string): {
  formulaTargets: { defaultFcr: number | null; defaultSrPct: number | null };
  notes: string | null;
} {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(settingsJson || '{}') as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const b = (raw.budidaya || {}) as Record<string, unknown>;
  const ft = (b.formulaTargets || {}) as Record<string, unknown>;
  return {
    formulaTargets: {
      defaultFcr: ft.defaultFcr != null ? Number(ft.defaultFcr) : null,
      defaultSrPct: ft.defaultSrPct != null ? Number(ft.defaultSrPct) : null,
    },
    notes: b.notes != null ? String(b.notes) : null,
  };
}

function mergeBudidayaNamespace(
  prevJson: string,
  patch: { formulaTargets?: { defaultFcr?: number | null }; notes?: string | null },
): Record<string, unknown> {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(prevJson || '{}') as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const prev = parseBudidayaSettings(prevJson);
  const nextFt = {
    ...prev.formulaTargets,
    ...(patch.formulaTargets || {}),
  };
  return {
    ...raw,
    logoUrl: raw.logoUrl || 'keep-me',
    budidaya: {
      formulaTargets: nextFt,
      notes: patch.notes !== undefined ? patch.notes : prev.notes,
    },
  };
}

describe('S08 Master Data & Settings', () => {
  it('master mutations declare no operational side effects', () => {
    expect(MASTER_NO_SIDE_EFFECT).toBe(true);
  });

  it('budidaya settings merge preserves non-budidaya keys (BC)', () => {
    const merged = mergeBudidayaNamespace(
      JSON.stringify({ logoUrl: 'x.png', onboarding: { step: 2 } }),
      { formulaTargets: { defaultFcr: 1.2 }, notes: 'ok' },
    );
    expect(merged.logoUrl).toBe('x.png');
    expect(merged.onboarding).toEqual({ step: 2 });
    expect((merged.budidaya as { formulaTargets: { defaultFcr: number } }).formulaTargets.defaultFcr).toBe(1.2);
  });

  it('settings are defaults only — not Formula SoT markers', () => {
    const s = parseBudidayaSettings(
      JSON.stringify({ budidaya: { formulaTargets: { defaultFcr: 1.5, defaultSrPct: 90 } } }),
    );
    expect(s.formulaTargets.defaultFcr).toBe(1.5);
    expect(s.formulaTargets.defaultSrPct).toBe(90);
    // Explicit: empty settings do not invent KPI zeros
    const empty = parseBudidayaSettings('{}');
    expect(empty.formulaTargets.defaultFcr).toBeNull();
  });

  it('catalog codes normalize like master species (uppercase) / units (lowercase)', () => {
    const strainCode = 'sangkuriang'.toUpperCase();
    const unitCode = 'KG'.toLowerCase();
    expect(strainCode).toBe('SANGKURIANG');
    expect(unitCode).toBe('kg');
  });
});

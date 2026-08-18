/**
 * Platform Onboarding helpers — progress in Tenant.settingsJson.onboarding.
 * Step definitions SSOT = BlueprintExtension.onboarding on catalog registration.
 * Does not alter Formula / Workflow / Event / Access / domain business rules.
 */

import { extensionForBlueprint } from './catalog';
import type { OnboardingBlueprintMeta, OnboardingStepDto } from './extension.types';

/**
 * Demo mode — Founder toggles `settingsJson.demoMode=true` on a workspace to grant
 * full blueprint module access and bypass trial expiry for demonstration purposes.
 * Read-only flag; does not affect billing or approval gate.
 */
export function isDemoMode(settingsJson: string | null | undefined): boolean {
  try {
    const s = JSON.parse(settingsJson || '{}') as { demoMode?: unknown };
    return s.demoMode === true;
  } catch {
    return false;
  }
}

export type { OnboardingStepDto, OnboardingBlueprintMeta } from './extension.types';

export type OnboardingProgressDto = {
  version: number;
  currentStepId: string | null;
  skippedStepIds: string[];
  completedAt: string | null;
  lastVisitedAt: string | null;
};

export function defaultProgress(firstStepId: string | null = null): OnboardingProgressDto {
  return {
    version: 1,
    currentStepId: firstStepId,
    skippedStepIds: [],
    completedAt: null,
    lastVisitedAt: null,
  };
}

export function parseOnboardingProgress(settingsJson: string | null | undefined): OnboardingProgressDto {
  try {
    const s = JSON.parse(settingsJson || '{}') as { onboarding?: Partial<OnboardingProgressDto> };
    const o = s.onboarding || {};
    return {
      version: typeof o.version === 'number' ? o.version : 1,
      currentStepId: o.currentStepId ?? null,
      skippedStepIds: Array.isArray(o.skippedStepIds) ? o.skippedStepIds.map(String) : [],
      completedAt: o.completedAt ?? null,
      lastVisitedAt: o.lastVisitedAt ?? null,
    };
  } catch {
    return defaultProgress();
  }
}

/** Resolve onboarding meta from catalog extension (no ID branching). */
export function onboardingForBlueprint(blueprintId: string): OnboardingBlueprintMeta {
  return extensionForBlueprint(blueprintId).onboarding;
}

export function stepsForBlueprint(blueprintId: string): OnboardingStepDto[] {
  return onboardingForBlueprint(blueprintId).steps;
}

/** Whether Setup is forced until Ready — from extension.ready.forceUntilReady. */
export function forceOnboarding(blueprintId: string): boolean {
  return extensionForBlueprint(blueprintId).ready.forceUntilReady;
}

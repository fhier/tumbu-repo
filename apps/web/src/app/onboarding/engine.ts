import type { OnboardingProgress, OnboardingStateResponse, OnboardingStepDef } from './types';

export function emptyProgress(firstStepId?: string | null): OnboardingProgress {
  return {
    version: 1,
    currentStepId: firstStepId ?? null,
    skippedStepIds: [],
    completedAt: null,
    lastVisitedAt: null,
  };
}

/**
 * Resolve which step to show from API steps + domain facts + stored cursor.
 * No blueprint-ID branching — fact-driven for step kinds that declare domain prerequisites.
 */
export function resolveCurrentStep(
  steps: OnboardingStepDef[],
  progress: OnboardingProgress,
  facts: { activePonds?: number; activeSpecies?: number },
): OnboardingStepDef | null {
  if (!steps.length) return null;

  const ponds = facts.activePonds;
  const species = facts.activeSpecies;
  const hasPondFact = typeof ponds === 'number';
  const hasSpeciesFact = typeof species === 'number';

  if (hasPondFact || hasSpeciesFact) {
    const pondStep = steps.find((s) => s.kind === 'form_pond');
    const speciesStep = steps.find((s) => s.kind === 'form_species');
    const readyStep = steps.find((s) => s.kind === 'ready');
    if (pondStep && hasPondFact && (ponds ?? 0) < 1) return pondStep;
    if (speciesStep && hasSpeciesFact && (species ?? 0) < 1) return speciesStep;
    if (readyStep && (!pondStep || (ponds ?? 0) >= 1) && (!speciesStep || (species ?? 0) >= 1)) {
      return readyStep;
    }
  }

  const byId = progress.currentStepId
    ? steps.find((s) => s.id === progress.currentStepId)
    : null;
  if (byId) return byId;

  const skipped = new Set(progress.skippedStepIds || []);
  const next = steps.find((s) => !skipped.has(s.id) && s.id !== 'ready');
  return next ?? steps.find((s) => s.id === 'ready') ?? steps[0];
}

export function stepIndex(steps: OnboardingStepDef[], stepId: string | null | undefined) {
  if (!stepId) return 0;
  const i = steps.findIndex((s) => s.id === stepId);
  return i < 0 ? 0 : i;
}

export function progressPercent(steps: OnboardingStepDef[], currentId: string | null | undefined) {
  if (!steps.length) return 100;
  const i = stepIndex(steps, currentId);
  return Math.round(((i + 1) / steps.length) * 100);
}

export function firstRoutePage(state: OnboardingStateResponse | null | undefined): 'onboarding' | 'dashboard' {
  if (!state) return 'dashboard';
  if (state.preferOnboarding) return 'onboarding';
  return 'dashboard';
}

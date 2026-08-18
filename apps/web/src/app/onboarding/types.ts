/** Platform Onboarding Framework — types (UX layer only). */

export type OnboardingStepKind =
  | 'info'
  | 'form_pond'
  | 'form_species'
  | 'excel_import'
  | 'ready';

export type OnboardingStepDef = {
  id: string;
  title: string;
  description: string;
  kind: OnboardingStepKind | string;
  /** Required steps block Workspace Ready until satisfied by domain facts. */
  required: boolean;
  /** Optional steps may be skipped without blocking Ready. */
  skipLabel?: string;
};

export type OnboardingProgress = {
  version: number;
  currentStepId: string | null;
  skippedStepIds: string[];
  completedAt: string | null;
  lastVisitedAt: string | null;
};

/** Response from GET /platform/onboarding — SSOT for steps lives on API. */
export type OnboardingStateResponse = {
  blueprintId: string;
  title: string;
  readyWithoutSteps: boolean;
  ready: boolean;
  /** Belum Ready → wajib onboarding (Budidaya). */
  forceOnboarding: boolean;
  /** Buka onboarding dulu (termasuk langkah opsional Distributor yang belum selesai). */
  preferOnboarding: boolean;
  progress: OnboardingProgress;
  steps: OnboardingStepDef[];
  facts?: {
    activePonds?: number;
    activeSpecies?: number;
  };
  /** Spesies dari registrasi (Filter Context). */
  allowedSpecies?: string[];
  speciesTier?: 'single' | 'multi';
  speciesOptions?: { code: string; label: string }[];
};

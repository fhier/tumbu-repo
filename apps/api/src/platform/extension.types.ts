/**
 * Platform Extension types — metadata a blueprint registers with the Platform.
 * Platform core reads these; it must not branch on blueprint ID strings.
 */

export type OnboardingStepDto = {
  id: string;
  title: string;
  description: string;
  kind: string;
  required: boolean;
  skipLabel?: string;
};

export type OnboardingBlueprintMeta = {
  title: string;
  /** If true, Dashboard may open before optional steps finish. */
  readyWithoutSteps: boolean;
  steps: OnboardingStepDto[];
};

/** Capability fact keys the Ready engine can collect (not blueprint IDs). */
export type ReadyFactKey = 'activePonds' | 'activeSpecies';

export type ReadyRule =
  | { type: 'always_ready' }
  | { type: 'min_count'; fact: ReadyFactKey; min: number };

export type ReadyConfig = {
  /** Force Setup until all ready rules pass. */
  forceUntilReady: boolean;
  /** Facts to collect for UI resume + rule evaluation. */
  facts: ReadyFactKey[];
  rules: ReadyRule[];
};

export type BootstrapProfile =
  | { strategy: 'none' }
  | { strategy: 'seed_sizes'; labels: string[] }
  | {
      strategy: 'seed_service_items';
      items: Array<{ name: string; category: string; unit: string; price: number }>;
    };

export type BlueprintExtension = {
  onboarding: OnboardingBlueprintMeta;
  ready: ReadyConfig;
  bootstrap: BootstrapProfile;
};

export const EMPTY_ONBOARDING: OnboardingBlueprintMeta = {
  title: 'Setup usaha',
  readyWithoutSteps: true,
  steps: [],
};

export const ALWAYS_READY: ReadyConfig = {
  forceUntilReady: false,
  facts: [],
  rules: [{ type: 'always_ready' }],
};

/** Default commercial plans — single source of truth for catalog seed metadata. */

export type PlanSeed = {
  code: string;
  name: string;
  description: string;
  monthlyAmount: number;
  workspaceQuota: number;
  trialDays: number;
  modules: string[];
  sortOrder: number;
};

/** Stable plan codes — use these instead of string literals elsewhere. */
export const PLAN_CODES = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  /** @deprecated alias → pro */
  GROWTH: 'growth',
  /** @deprecated alias → enterprise */
  BUSINESS: 'business',
} as const;

export type PlanCode = (typeof PLAN_CODES)[keyof typeof PLAN_CODES];

/** Default for new self-serve / unspecified create. */
export const DEFAULT_PLAN_CODE: PlanCode = PLAN_CODES.STARTER;

/** Demo / backfill workspaces (seed). */
export const DEMO_PLAN_CODE: PlanCode = PLAN_CODES.PRO;

const STARTER_MODULES = [
  'dashboard', 'purchase', 'sales', 'inventory', 'expense', 'cash', 'master', 'settings',
];

const PRO_MODULES = [
  ...STARTER_MODULES, 'payable', 'receivable', 'finance', 'backup', 'users',
];

const ENTERPRISE_MODULES = [
  ...PRO_MODULES,
  'customers', 'services', 'orders', 'schedule', 'technicians', 'assets', 'invoice', 'quotations',
];

/**
 * Catalog seed. Runtime source of truth after seed is `PlatformPlan` in DB.
 * Legacy growth/business kept active for existing tenants (limits alias to pro/enterprise).
 */
export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    description: 'Gratis · maks 2 kolam · 1 siklus aktif · Profit Advisor terkunci',
    monthlyAmount: 0,
    workspaceQuota: 1,
    trialDays: 14,
    modules: STARTER_MODULES,
    sortOrder: 10,
  },
  {
    code: PLAN_CODES.PRO,
    name: 'Pro',
    description: 'Rp 49.000/bln · kolam & siklus tanpa batas · Profit Advisor & laporan BOP',
    monthlyAmount: 49000,
    workspaceQuota: 1,
    trialDays: 14,
    modules: PRO_MODULES,
    sortOrder: 20,
  },
  {
    code: PLAN_CODES.ENTERPRISE,
    name: 'Enterprise / Koperasi',
    description: 'Rp 499.000/bln · semua fitur Pro · hingga 10 workspace',
    monthlyAmount: 499000,
    workspaceQuota: 10,
    trialDays: 30,
    modules: ENTERPRISE_MODULES,
    sortOrder: 30,
  },
  // Legacy aliases — tetap di katalog agar tenant lama tidak orphan
  {
    code: PLAN_CODES.GROWTH,
    name: 'Growth (lama → Pro)',
    description: 'Alias paket lama — setara Pro',
    monthlyAmount: 49000,
    workspaceQuota: 1,
    trialDays: 14,
    modules: PRO_MODULES,
    sortOrder: 90,
  },
  {
    code: PLAN_CODES.BUSINESS,
    name: 'Business (lama → Enterprise)',
    description: 'Alias paket lama — setara Enterprise',
    monthlyAmount: 499000,
    workspaceQuota: 10,
    trialDays: 30,
    modules: ENTERPRISE_MODULES,
    sortOrder: 91,
  },
];

export function planSeedByCode(code: string): PlanSeed | undefined {
  return DEFAULT_PLANS.find((p) => p.code === code);
}

export function parsePlanModules(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (Array.isArray(arr)) return arr.map((x) => String(x));
  } catch { /* ignore */ }
  return [];
}

export function intersectModules(enabled: string[], planAllowed: string[]): string[] {
  if (!planAllowed.length) return enabled;
  const allow = new Set(planAllowed);
  return enabled.filter((id) => allow.has(id));
}

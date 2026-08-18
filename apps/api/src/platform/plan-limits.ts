/**
 * Runtime feature/quota limits per commercial plan.
 * Codes: starter · pro · enterprise (+ legacy growth/business aliases).
 */

export type PlanFeatureLimits = {
  code: string;
  tier: 'starter' | 'pro' | 'enterprise';
  /** null = unlimited */
  maxPonds: number | null;
  /** null = unlimited — counts PLANNED/READY/ACTIVE/HARVESTING */
  maxActiveCycles: number | null;
  workspaceQuota: number;
  profitAdvisor: boolean;
  financeReports: boolean;
  exportReports: boolean;
  multiWorkspace: boolean;
  /** Max members when multi-workspace / users module */
  maxWorkspaces: number;
};

const STARTER_LIMITS: PlanFeatureLimits = {
  code: 'starter',
  tier: 'starter',
  maxPonds: 2,
  maxActiveCycles: 1,
  workspaceQuota: 1,
  profitAdvisor: false,
  financeReports: false,
  exportReports: false,
  multiWorkspace: false,
  maxWorkspaces: 1,
};

const PRO_LIMITS: PlanFeatureLimits = {
  code: 'pro',
  tier: 'pro',
  maxPonds: null,
  maxActiveCycles: null,
  workspaceQuota: 1,
  profitAdvisor: true,
  financeReports: true,
  exportReports: true,
  multiWorkspace: false,
  maxWorkspaces: 1,
};

const ENTERPRISE_LIMITS: PlanFeatureLimits = {
  code: 'enterprise',
  tier: 'enterprise',
  maxPonds: null,
  maxActiveCycles: null,
  workspaceQuota: 10,
  profitAdvisor: true,
  financeReports: true,
  exportReports: true,
  multiWorkspace: true,
  maxWorkspaces: 10,
};

/** Normalize legacy catalog codes → commercial tier. */
export function normalizePlanCode(code: string | null | undefined): string {
  const c = String(code || 'starter').toLowerCase().trim();
  if (c === 'growth') return 'pro';
  if (c === 'business') return 'enterprise';
  return c || 'starter';
}

export function resolvePlanLimits(code: string | null | undefined): PlanFeatureLimits {
  const c = normalizePlanCode(code);
  if (c === 'pro') return { ...PRO_LIMITS, code: c };
  if (c === 'enterprise') return { ...ENTERPRISE_LIMITS, code: c };
  return { ...STARTER_LIMITS, code: c === 'starter' ? 'starter' : c };
}

export const PLAN_UPGRADE_MESSAGES = {
  pondQuota:
    'Batas Paket Gratis (Maks 2 Kolam) tercapai. Upgrade ke Paket Pro untuk tambah kolam tanpa batas.',
  cycleQuota:
    'Batas Paket Gratis (Maks 1 Siklus aktif) tercapai. Tutup siklus berjalan atau upgrade ke Paket Pro.',
  profitAdvisor: 'Fitur ini membutuhkan Paket Pro atau lebih tinggi.',
  financeReports: 'Laporan keuangan BOP membutuhkan Paket Pro atau lebih tinggi.',
  exportReports: 'Export PDF/Excel laporan panen membutuhkan Paket Pro atau lebih tinggi.',
  multiWorkspace: 'Multi-workspace membutuhkan Paket Enterprise / Koperasi.',
  genericPro: 'Fitur ini membutuhkan Paket Pro atau lebih tinggi.',
} as const;

export const ACTIVE_CYCLE_STATES = ['PLANNED', 'READY', 'ACTIVE', 'HARVESTING'] as const;

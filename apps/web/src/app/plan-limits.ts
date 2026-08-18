/** Mirror of API plan-limits — SSOT values must match apps/api/src/platform/plan-limits.ts */

export type PlanFeatureLimits = {
  code: string;
  tier: 'starter' | 'pro' | 'enterprise';
  maxPonds: number | null;
  maxActiveCycles: number | null;
  workspaceQuota: number;
  profitAdvisor: boolean;
  financeReports: boolean;
  exportReports: boolean;
  multiWorkspace: boolean;
  maxWorkspaces: number;
};

export type WorkspacePlanContext = {
  id: string | null;
  code: string;
  name: string;
  limits: PlanFeatureLimits;
};

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

const STARTER: PlanFeatureLimits = {
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

const PRO: PlanFeatureLimits = {
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

const ENTERPRISE: PlanFeatureLimits = {
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

export function resolvePlanLimits(code: string | null | undefined): PlanFeatureLimits {
  const c = String(code || 'starter').toLowerCase().trim();
  if (c === 'pro' || c === 'growth') return { ...PRO, code: c === 'growth' ? 'growth' : 'pro' };
  if (c === 'enterprise' || c === 'business') {
    return { ...ENTERPRISE, code: c === 'business' ? 'business' : 'enterprise' };
  }
  return { ...STARTER, code: c || 'starter' };
}

export function canCreatePond(limits: PlanFeatureLimits, activePondCount: number): boolean {
  if (limits.maxPonds == null) return true;
  return activePondCount < limits.maxPonds;
}

export function canCreateCycle(limits: PlanFeatureLimits, activeCycleCount: number): boolean {
  if (limits.maxActiveCycles == null) return true;
  return activeCycleCount < limits.maxActiveCycles;
}

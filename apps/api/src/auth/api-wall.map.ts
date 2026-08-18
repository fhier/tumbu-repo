/**
 * API Wall — explicit route → module (+ optional role) map.
 * Single source of truth for Module Wall (and Role Wall defaults on domain routes).
 *
 * Rules:
 * - Paths under /erp, /service, and /budidaya MUST match a rule or they are denied (403).
 * - /platform, /auth, /health, /leads are skipped (auth/roles handled elsewhere).
 * - Longest prefix wins.
 * - Do not put module checks inside ERP/Service handlers.
 */

export type ApiWallResolve = 'erp-transactions' | 'erp-kwitansi';

export type ApiWallRule = {
  /** Path after global prefix, always starts with / — e.g. /erp/products */
  prefix: string;
  /** Required module id (AND with others if combined) */
  module?: string;
  /** At least one of these modules must be enabled */
  anyModules?: string[];
  /** Dynamic module resolution from query/body */
  resolve?: ApiWallResolve;
  /**
   * If set, membershipRole must be one of these (PLATFORM_ADMIN always allowed for roles).
   * Complements @Roles on controllers — fills GETs that previously had no role check.
   */
  roles?: string[];
};

const OPS = ['OWNER', 'ADMIN', 'STAFF'] as const;
const OPS_TECH = ['OWNER', 'ADMIN', 'STAFF', 'TECHNICIAN'] as const;
const OWNERS = ['OWNER', 'ADMIN'] as const;

/**
 * Explicit inventory. Keep sorted by prefix length descending at runtime via matcher.
 * Every /erp/* and /service/* handler in controllers must appear here.
 */
export const API_WALL_RULES: ApiWallRule[] = [
  // —— Budidaya master (8.2) — referensi saja; module master ——
  { prefix: '/budidaya/master', module: 'master', roles: [...OPS] },
  // —— Budidaya cycles (8.3) ——
  { prefix: '/budidaya/cycles', module: 'master', roles: [...OPS] },
  // —— Budidaya events (8.4) ——
  { prefix: '/budidaya/events', module: 'master', roles: [...OPS] },
  // —— Budidaya dashboard (8.6) ——
  { prefix: '/budidaya/dashboard', module: 'dashboard', roles: [...OPS] },
  // —— Budidaya analysis (8.7) ——
  { prefix: '/budidaya/analysis', module: 'dashboard', roles: [...OPS] },
  // —— Budidaya settings (Sprint 8) ——
  { prefix: '/budidaya/settings', module: 'settings', roles: [...OWNERS] },

  // —— ERP purchase ——
  { prefix: '/erp/berita-acara/import-po', module: 'purchase', roles: [...OPS] },
  { prefix: '/erp/berita-acara/preview-po', module: 'purchase', roles: [...OPS] },
  { prefix: '/erp/berita-acara/sisa-notes', module: 'purchase', roles: [...OPS] },
  { prefix: '/erp/documents/berita-acara', module: 'purchase', roles: [...OPS] },
  { prefix: '/erp/documents/nota-pembelian', module: 'purchase', roles: [...OPS] },
  { prefix: '/erp/berita-acara', module: 'purchase', roles: [...OPS] },

  // —— ERP sales ——
  { prefix: '/erp/documents/surat-jalan', module: 'sales', roles: [...OPS] },
  { prefix: '/erp/documents/invoice', module: 'sales', roles: [...OPS] },
  { prefix: '/erp/surat-jalan', module: 'sales', roles: [...OPS] },

  // —— ERP transactions (purchase | sales by type) ——
  { prefix: '/erp/transactions', resolve: 'erp-transactions', roles: [...OPS] },

  // —— ERP inventory / master ——
  { prefix: '/erp/products/adjust-stock', module: 'inventory', roles: [...OPS] },
  { prefix: '/erp/products', module: 'inventory', roles: [...OPS] },
  { prefix: '/erp/fishery-commodity-options', module: 'inventory', roles: [...OPS] },
  { prefix: '/erp/sizes', module: 'inventory', roles: [...OPS] },
  { prefix: '/erp/partners', module: 'master', roles: [...OPS] },

  // —— ERP cash / expense ——
  { prefix: '/erp/cash/kategori', module: 'expense', roles: [...OPS] },
  { prefix: '/erp/cash/rekap', module: 'expense', roles: [...OPS] },
  { prefix: '/erp/documents/rekap-pengeluaran', module: 'expense', roles: [...OPS] },
  { prefix: '/erp/cash', module: 'cash', roles: [...OPS] },
  { prefix: '/erp/documents/kwitansi', resolve: 'erp-kwitansi', roles: [...OPS] },

  // —— ERP finance / reports / closings ——
  { prefix: '/erp/documents/tutup-buku', module: 'finance', roles: [...OPS] },
  { prefix: '/erp/documents/laporan', module: 'finance', roles: [...OPS] },
  { prefix: '/erp/closings', module: 'finance', roles: [...OPS] },
  { prefix: '/erp/finance', module: 'finance', roles: [...OPS] },
  { prefix: '/erp/reports', module: 'finance', roles: [...OPS] },
  { prefix: '/erp/document-gaps', anyModules: ['purchase', 'sales', 'finance'], roles: [...OPS] },

  // —— ERP settings / backup / import ——
  // Import Excel = migrasi (Starter+); Backup = operasional (Growth+). Owner 2026-07-21 C1.
  { prefix: '/erp/documents/kop-preview', module: 'settings', roles: [...OWNERS] },
  { prefix: '/erp/settings', module: 'settings', roles: [...OWNERS] },
  { prefix: '/erp/backup', module: 'backup', roles: [...OWNERS] },
  { prefix: '/erp/import', module: 'settings', roles: [...OWNERS] },

  // —— ERP dashboard ——
  { prefix: '/erp/dashboard', module: 'dashboard', roles: [...OPS] },

  // —— Service ——
  { prefix: '/service/documents/work-order', module: 'orders', roles: [...OPS_TECH] },
  { prefix: '/service/documents/quotation', module: 'quotations', roles: [...OPS] },
  { prefix: '/service/documents/invoice', module: 'invoice', roles: [...OPS] },
  { prefix: '/service/documents/receipt', module: 'invoice', roles: [...OPS] },
  { prefix: '/service/orders', module: 'orders', roles: [...OPS_TECH] },
  { prefix: '/service/quotations', module: 'quotations', roles: [...OPS] },
  { prefix: '/service/customers', module: 'customers', roles: [...OPS_TECH] },
  { prefix: '/service/services', module: 'services', roles: [...OPS] },
  { prefix: '/service/assets', module: 'assets', roles: [...OPS_TECH] },
  { prefix: '/service/members', module: 'users', roles: [...OPS] },
  { prefix: '/service/finance', module: 'finance', roles: [...OPS] },
  { prefix: '/service/reports', module: 'finance', roles: [...OPS] },
  { prefix: '/service/dashboard', module: 'dashboard', roles: [...OPS_TECH] },
];

/** Domains that must be explicitly mapped (deny if missing). */
export const API_WALL_WALLED_PREFIXES = ['/erp', '/service', '/budidaya'] as const;

/** Paths that skip Module/Role map entirely (Auth + RolesGuard / public still apply). */
export function isApiWallSkipped(path: string): boolean {
  if (path === '/' || path === '') return true;
  if (path.startsWith('/health')) return true;
  if (path.startsWith('/auth')) return true;
  if (path.startsWith('/leads')) return true;
  if (path.startsWith('/platform')) return true;
  return false;
}

function normalizePath(raw: string): string {
  let p = String(raw || '');
  // strip query
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  // strip global prefix /api
  if (p.startsWith('/api/')) p = p.slice(4);
  else if (p === '/api') p = '/';
  if (!p.startsWith('/')) p = `/${p}`;
  // strip trailing slash (except root)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

let sortedRules: ApiWallRule[] | null = null;

function rulesByLongestPrefix(): ApiWallRule[] {
  if (!sortedRules) {
    sortedRules = [...API_WALL_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  }
  return sortedRules;
}

export function matchApiWallRule(rawPath: string): {
  path: string;
  rule: ApiWallRule | null;
  walled: boolean;
} {
  const path = normalizePath(rawPath);
  if (isApiWallSkipped(path)) {
    return { path, rule: null, walled: false };
  }
  const walled = API_WALL_WALLED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (!walled) {
    return { path, rule: null, walled: false };
  }
  for (const rule of rulesByLongestPrefix()) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return { path, rule, walled: true };
    }
  }
  return { path, rule: null, walled: true };
}

/** Resolve module requirement for a matched rule (may depend on query/body). */
export function resolveRequiredModules(
  rule: ApiWallRule,
  ctx: { method: string; query?: Record<string, unknown>; body?: Record<string, unknown> },
): { module?: string; anyModules?: string[] } {
  if (!rule.resolve) {
    return { module: rule.module, anyModules: rule.anyModules };
  }

  if (rule.resolve === 'erp-transactions') {
    const type = String(
      ctx.query?.type || ctx.body?.type || ctx.body?.forceType || '',
    ).toUpperCase();
    if (type === 'PURCHASE') return { module: 'purchase' };
    if (type === 'SALE') return { module: 'sales' };
    return { anyModules: ['purchase', 'sales'] };
  }

  if (rule.resolve === 'erp-kwitansi') {
    const source = String(ctx.query?.source || ctx.body?.source || '').toLowerCase();
    if (source === 'cash' || source === 'kas') return { module: 'cash' };
    if (source === 'ba' || source === 'berita-acara') return { module: 'purchase' };
    if (source === 'sale' || source === 'invoice') return { module: 'sales' };
    if (source === 'purchase' || source === 'nota') return { module: 'purchase' };
    return { anyModules: ['cash', 'sales', 'purchase', 'expense'] };
  }

  return { module: rule.module, anyModules: rule.anyModules };
}

/** Flat list for sprint report / audits. */
export function listApiWallInventory(): Array<{
  prefix: string;
  module: string;
  roles: string;
}> {
  return API_WALL_RULES.map((r) => ({
    prefix: r.prefix,
    module: r.module
      || (r.anyModules ? `any(${r.anyModules.join('|')})` : '')
      || (r.resolve ? `resolve:${r.resolve}` : ''),
    roles: (r.roles || []).join('|') || '(decorator only)',
  }));
}

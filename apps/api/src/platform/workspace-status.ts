/** Workspace approval + billing lifecycle (Platform). */

export const WORKSPACE_STATUSES = ['PENDING', 'ACTIVE', 'GRACE', 'REJECTED', 'SUSPENDED'] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

/** Invoice statuses for Billing Enforcement (narrow). */
export const INVOICE_STATUSES = ['UNPAID', 'PAID', 'OVERDUE'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return typeof value === 'string' && (WORKSPACE_STATUSES as readonly string[]).includes(value);
}

/** Keep legacy `isActive` in sync — usable operationally (ACTIVE or GRACE). */
export function isActiveForStatus(status: WorkspaceStatus): boolean {
  return status === 'ACTIVE' || status === 'GRACE';
}

export function labelWorkspaceStatus(status: string): string {
  switch (status) {
    case 'PENDING': return 'Menunggu persetujuan';
    case 'ACTIVE': return 'Aktif';
    case 'GRACE': return 'Masa tenggang';
    case 'REJECTED': return 'Ditolak';
    case 'SUSPENDED': return 'Ditangguhkan';
    default: return status || 'Tidak diketahui';
  }
}

/**
 * Non-platform-admin may enter ACTIVE, GRACE, or PENDING.
 * SUSPENDED / REJECTED -> blocked (Approval Gate + Billing).
 */
export function canMemberEnterWorkspace(status: string, isPlatformAdmin: boolean): boolean {
  if (isPlatformAdmin) return true;
  return status === 'ACTIVE' || status === 'GRACE' || status === 'PENDING';
}

/** Normalize legacy ISSUED/DRAFT → UNPAID for API surface. */
export function normalizeInvoiceStatus(status: string, dueAt?: Date | null, now = new Date()): InvoiceStatus | string {
  let s = String(status || '').toUpperCase();
  if (s === 'ISSUED' || s === 'DRAFT') s = 'UNPAID';
  if ((s === 'UNPAID') && dueAt && dueAt < now) return 'OVERDUE';
  if (s === 'OVERDUE' || s === 'PAID' || s === 'UNPAID') return s;
  return s;
}

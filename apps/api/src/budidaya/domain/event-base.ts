/**
 * EventBase — kontrak bersama seluruh event Budidaya (DATA-MODEL §6.1).
 *
 * 8.1: kontrak TypeScript saja. Bukan inheritance Prisma / class hierarchy.
 * Setiap tabel event menyalin field ini secara eksplisit di schema.
 *
 * workspaceId ≡ tenantId (Tenant platform = Workspace).
 */

export type BudidayaRecordStatus = 'RECORDED' | 'VOIDED';

export type BudidayaEventBase = {
  id: string;
  /** Alias bisnis untuk tenantId / Workspace */
  workspaceId: string;
  cycleId: string;
  /** Timestamp penuh kejadian bisnis */
  eventAt: Date;
  createdBy: string;
  notes?: string | null;
  recordStatus: BudidayaRecordStatus;
  voidedAt?: Date | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  /** Event koreksi menunjuk event sejenis yang digantikan */
  correctsEventId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Nama field Prisma untuk workspace (= Tenant.id) */
export const BUDIDAYA_WORKSPACE_FK = 'tenantId' as const;

export const BUDIDAYA_EVENT_BASE_FIELDS = [
  'id',
  'tenantId', // workspaceId
  'cycleId',
  'eventAt',
  'createdBy',
  'notes',
  'recordStatus',
  'voidedAt',
  'voidedBy',
  'voidReason',
  'correctsEventId',
  'createdAt',
  'updatedAt',
] as const;

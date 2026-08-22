// packages/core/src/index.ts
// TUMBU Core Shared Types — digunakan oleh outbox & sync engine

export { resolvePlanLimits, canCreatePond, canCreateCycle, PLAN_UPGRADE_MESSAGES } from './plan-limits';
export * from './plan-limits';

export interface OutboxItem {
  id: string;
  aggregate: string;
  aggregateId?: string;
  operation?: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  version: number;
  payload?: Record<string, unknown>;
  attempt?: number;
  status?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  createdAt?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SyncPushRequest {
  tenantId?: string;
  deviceId?: string;
  items: OutboxItem[];
}

export interface SyncPushResponseItem {
  id: string;
  status: 'SUCCESS' | 'FAILED_NEEDS_REVIEW' | 'SYNCED' | 'FAILED' | string;
  error?: string;
  [key: string]: unknown;
}

export interface SyncPushResponse {
  success: boolean;
  processed?: number;
  processedCount: number;
  timestamp: string;
  results: SyncPushResponseItem[];
  syncedCount?: number;
}

export interface SyncPullRequest {
  cursor?: string;
  since?: number;
  [key: string]: unknown;
}

export interface SyncPullResponse {
  changes?: unknown[];
  cursor?: string;
  [key: string]: unknown;
}

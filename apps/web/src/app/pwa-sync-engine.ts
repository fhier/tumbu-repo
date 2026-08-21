/**
 * TUMBU PWA Sync Engine — Frontend IndexedDB & Outbox Sync Manager
 *
 * ════════════════════════════════════════════════════════════════
 * INTEGRATION NOTE (v3):
 * Engine ini menggunakan unified IndexedDB (lib/offline/indexeddb.ts)
 * Semua data tersimpan dalam satu database 'tumbu_offline' (DB_VERSION=3).
 * ════════════════════════════════════════════════════════════════
 */

import { localDb, STORES } from '../lib/offline/indexeddb';

// ── Re-export types for backward compatibility ────────────────
export interface OutboxItem<T = Record<string, unknown>> {
  id: string;
  aggregate: 'cycle' | 'transaction' | 'partner' | 'expense' | string;
  aggregateId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  payload: T;
  timestamp?: number;
  version?: number;
  createdAt?: string;
  attempt: number;
  status?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  error?: string;
}

export interface SyncPushResponse {
  success: boolean;
  syncedCount: number;
  failedItems?: Array<{ id: string; error: string }>;
  results?: Array<{ id: string; status: 'SYNCED' | 'FAILED' | string; error?: string }>;
}

export interface LocalFormDraft {
  key: string;
  screen: string;
  scopeId: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export { localDb as db } from '../lib/offline/indexeddb';

// ── FORM DRAFTS ────────────────────────────────────────────────
export async function saveFormDraft(draft: LocalFormDraft): Promise<void> {
  await localDb.put(STORES.FORM_DRAFTS, draft);
}

export async function getFormDraft(key: string): Promise<LocalFormDraft | null> {
  return localDb.get<LocalFormDraft>(STORES.FORM_DRAFTS, key);
}

export async function removeFormDraft(key: string): Promise<void> {
  await localDb.delete(STORES.FORM_DRAFTS, key);
}

export async function getAllFormDrafts(): Promise<LocalFormDraft[]> {
  return localDb.getAll<LocalFormDraft>(STORES.FORM_DRAFTS);
}

// ── MASTER DATA ────────────────────────────────────────────────
export async function saveMasterData(key: string, data: unknown): Promise<void> {
  await localDb.put(STORES.MASTER_DATA, { key, data, updatedAt: Date.now() });
}

export async function getMasterData<T>(key: string): Promise<{ key: string; data: T; updatedAt: number } | null> {
  return localDb.get(STORES.MASTER_DATA, key) as Promise<{ key: string; data: T; updatedAt: number } | null>;
}

export async function getOfflineMasterData(): Promise<any | null> {
  try {
    const record = await localDb.get<{ key: string; data: any }>(STORES.MASTER_DATA, 'latest');
    return record?.data || null;
  } catch { return null; }
}
// ── OUTBOX OPERATIONS ──────────────────────────────────────

/** Enqueue a new outbox item */
export async function enqueueOutboxItem<T = Record<string, unknown>>(
  aggregate: OutboxItem['aggregate'],
  aggregateId: string,
  operation: OutboxItem['operation'],
  payload: T,
): Promise<OutboxItem<T>> {
  const item: OutboxItem<T> = {
    id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    aggregate,
    aggregateId,
    operation,
    payload,
    version: 1,
    attempt: 0,
    createdAt: new Date().toISOString(),
  };
  await localDb.put(STORES.OUTBOX, item);
  if (typeof window !== 'undefined' && navigator.onLine) void triggerOutboxSync();
  return item;
}

/** Fetch all pending outbox items from unified store */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  try {
    const all = await localDb.getAll<OutboxItem>(STORES.OUTBOX);
    return (all || []).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch { return []; }
}

/** Remove synced item from unified outbox */
export async function removeOutboxItem(id: string): Promise<void> {
  try { await localDb.delete(STORES.OUTBOX, id); } catch { /* ignore */ }
}

function resolveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  if (typeof window !== 'undefined') {
    if (!window.location.hostname.includes('localhost') && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '/api';
    }
  }
  return envUrl.replace(/\/$/, '');
}

/** Pull master data from backend and save to unified IndexedDB */
export async function triggerMasterDataPull(apiBaseUrl?: string): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const baseUrl = apiBaseUrl || resolveApiBase();
  try {
    const token = localStorage.getItem('tumbu-token') || localStorage.getItem('tumbu_token');
    const res = await fetch(`${baseUrl}/v1/sync/pull?tenantId=current&since=0`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) {
      const data = await res.json();
      await localDb.put(STORES.MASTER_DATA, { key: 'latest', data: data.changes, updatedAt: Date.now() });
    }
  } catch { /* silent */ }
}

let isSyncing = false;
/** Synchronize queued outbox items with NestJS Backend */
export async function triggerOutboxSync(apiBaseUrl?: string): Promise<{ syncedCount: number; remainingCount: number }> {
  if (isSyncing || (typeof window !== 'undefined' && !navigator.onLine)) {
    const pending = await getPendingOutboxItems();
    return { syncedCount: 0, remainingCount: pending.length };
  }
  isSyncing = true;
  const baseUrl = apiBaseUrl || resolveApiBase();
  let synced = 0;
  try {
    const pendingItems = await getPendingOutboxItems();
    if (!pendingItems.length) return { syncedCount: 0, remainingCount: 0 };
    const token = typeof window !== 'undefined' ? (localStorage.getItem('tumbu-token') || localStorage.getItem('tumbu_token')) : null;
    const res = await fetch(`${baseUrl}/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        tenantId: 'current',
        deviceId: typeof window !== 'undefined' ? (localStorage.getItem('tumbu_device_id') || 'web-pwa') : 'web-pwa',
        items: pendingItems,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as SyncPushResponse;
      for (const result of data.results || []) {
        if (result.status === 'SYNCED') { await removeOutboxItem(result.id); synced++; }
      }
    }
    const remaining = await getPendingOutboxItems();
    return { syncedCount: synced, remainingCount: remaining.length };
  } catch {
    const remaining = await getPendingOutboxItems();
    return { syncedCount: 0, remainingCount: remaining.length };
  } finally { isSyncing = false; }
}

/** Get pending offline leads from localStorage */
export function getOfflineLeads(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('tumbu_offline_leads');
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

/** Enqueue a registration lead when offline */
export function enqueueOfflineLead(lead: { name: string; businessName: string; phone: string; email: string; notes?: string }) {
  if (typeof window === 'undefined') return;
  const leads = getOfflineLeads();
  leads.push({ id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...lead });
  localStorage.setItem('tumbu_offline_leads', JSON.stringify(leads));
  if (navigator.onLine) void triggerLeadsSync();
}

/** Sync pending leads to the backend */
export async function triggerLeadsSync(): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) return 0;
  const leads = getOfflineLeads();
  if (!leads.length) return 0;
  let synced = 0;
  const remaining: any[] = [];
  const baseUrl = resolveApiBase();
  for (const lead of leads) {
    try {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
      if (res.ok) synced++;
      else remaining.push(lead);
    } catch { remaining.push(lead); }
  }
  localStorage.setItem('tumbu_offline_leads', JSON.stringify(remaining));
  return synced;
}

/** Initialize online listener for auto-sync */
export function initPwaSyncListener(onStatusChange?: (online: boolean, pendingCount: number) => void) {
  if (typeof window === 'undefined') return;
  const check = async () => {
    const pending = await getPendingOutboxItems();
    const leads = getOfflineLeads();
    if (onStatusChange) onStatusChange(navigator.onLine, pending.length + leads.length);
  };
  window.addEventListener('online', () => {
    void triggerLeadsSync().then(() => {
      void triggerOutboxSync().then(() => { void triggerMasterDataPull().then(() => check()); });
    });
  });
  window.addEventListener('offline', () => void check());
  window.setInterval(() => {
    if (navigator.onLine) {
      void triggerLeadsSync().then(() => {
        void triggerOutboxSync().then(() => { void triggerMasterDataPull().then(() => check()); });
      });
    }
  }, 30000);
  void check();
}
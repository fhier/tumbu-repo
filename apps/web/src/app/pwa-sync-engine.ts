/**
 * TUMBU PWA Sync Engine — Frontend IndexedDB & Outbox Sync Manager
 * Sesuai Dokumen OFFLINE-FIRST.md & CTX-SYNC.md.
 */

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

const DB_NAME = 'tumbu_offline_v2';
const DB_VERSION = 2; // Incremented for master_data store
const STORE_OUTBOX = 'sync_outbox';
const STORE_DRAFTS = 'form_drafts';
const STORE_MASTER = 'master_data';

const DEFAULT_API_BASE = (() => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  if (typeof window !== 'undefined') {
    if (!window.location.hostname.includes('localhost') && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '/api';
    }
  }
  return envUrl.replace(/\/$/, '');
})();

export interface LocalFormDraft {
  key: string;
  screen: string;
  scopeId: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

/** Open or create IndexedDB connection */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        outboxStore.createIndex('aggregate', 'aggregate', { unique: false });
        outboxStore.createIndex('attempt', 'attempt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_MASTER)) {
        db.createObjectStore(STORE_MASTER, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Enqueue a new transaction event to IndexedDB Outbox */
export async function enqueueOutboxItem<T = Record<string, unknown>>(
  aggregate: OutboxItem['aggregate'],
  aggregateId: string,
  operation: OutboxItem['operation'],
  payload: T,
): Promise<OutboxItem<T>> {
  const db = await openDB();
  const id = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const item: OutboxItem<T> = {
    id,
    aggregate,
    aggregateId,
    operation,
    payload,
    version: 1,
    attempt: 0,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);
    const req = store.add(item);

    req.onsuccess = () => {
      // Trigger sync attempt immediately if online
      if (typeof window !== 'undefined' && navigator.onLine) {
        void triggerOutboxSync();
      }
      resolve(item);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Fetch all pending outbox items */
export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Remove synced item from outbox */
export async function removeOutboxItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

/** Fetch master data snapshot from IndexedDB */
export async function getOfflineMasterData(): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MASTER, 'readonly');
      const store = tx.objectStore(STORE_MASTER);
      const req = store.get('latest');
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Pull master data from backend and save to IndexedDB */
export async function triggerMasterDataPull(apiBaseUrl = DEFAULT_API_BASE): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const token = localStorage.getItem('tumbu_token');
    const res = await fetch(`${apiBaseUrl}/v1/sync/pull?tenantId=current&since=0`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MASTER, 'readwrite');
        const store = tx.objectStore(STORE_MASTER);
        const req = store.put({ key: 'latest', data: data.changes, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.error('Failed to pull master data:', err);
  }
}

let isSyncing = false;

/** Synchronize queued outbox items with NestJS Backend */
export async function triggerOutboxSync(apiBaseUrl = DEFAULT_API_BASE): Promise<{ syncedCount: number; remainingCount: number }> {
  if (isSyncing || (typeof window !== 'undefined' && !navigator.onLine)) {
    const pending = await getPendingOutboxItems();
    return { syncedCount: 0, remainingCount: pending.length };
  }

  isSyncing = true;
  let synced = 0;

  try {
    const pendingItems = await getPendingOutboxItems();
    if (!pendingItems.length) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('tumbu_token') : null;
    const res = await fetch(`${apiBaseUrl}/v1/sync/push`, {
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
        if (result.status === 'SYNCED') {
          await removeOutboxItem(result.id);
          synced++;
        }
      }
    }

    const remaining = await getPendingOutboxItems();
    return { syncedCount: synced, remainingCount: remaining.length };
  } catch {
    const remaining = await getPendingOutboxItems();
    return { syncedCount: 0, remainingCount: remaining.length };
  } finally {
    isSyncing = false;
  }
}

/** Get pending offline leads from localStorage */
export function getOfflineLeads(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('tumbu_offline_leads');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/** Enqueue a registration lead when offline */
export function enqueueOfflineLead(lead: { name: string; businessName: string; phone: string; email: string; notes?: string }) {
  if (typeof window === 'undefined') return;
  const leads = getOfflineLeads();
  leads.push({ id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...lead });
  localStorage.setItem('tumbu_offline_leads', JSON.stringify(leads));
  
  if (navigator.onLine) {
    void triggerLeadsSync();
  }
}

/** Sync pending leads to the backend */
export async function triggerLeadsSync(): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) return 0;
  const leads = getOfflineLeads();
  if (!leads.length) return 0;

  let synced = 0;
  const remaining: any[] = [];

  for (const lead of leads) {
    try {
      const apiBaseUrl = DEFAULT_API_BASE;
      const res = await fetch(`${apiBaseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lead),
      });
      if (res.ok) {
        synced++;
      } else {
        remaining.push(lead);
      }
    } catch {
      remaining.push(lead);
    }
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
    if (onStatusChange) {
      onStatusChange(navigator.onLine, pending.length + leads.length);
    }
  };

  window.addEventListener('online', () => {
    void triggerLeadsSync().then(() => {
      void triggerOutboxSync().then(() => {
        void triggerMasterDataPull().then(() => check());
      });
    });
  });

  window.addEventListener('offline', () => {
    void check();
  });

  // Periodic poll every 30 seconds if online
  window.setInterval(() => {
    if (navigator.onLine) {
      void triggerLeadsSync().then(() => {
        void triggerOutboxSync().then(() => {
          void triggerMasterDataPull().then(() => check());
        });
      });
    }
  }, 30000);

  void check();
}


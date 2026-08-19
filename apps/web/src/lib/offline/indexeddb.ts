// lib/offline/indexeddb.ts
// Unified IndexedDB Schema — TUMBU Offline V3
// Menggabungkan tumbu_offline_db (v1) + tumbu_offline_v2 + domain contracts storage targets

const DB_NAME = 'tumbu_offline';
const DB_VERSION = 3;

/**
 * Daftar semua object store yang terdaftar.
 * Domain contracts storage targets + core offline stores.
 */
export const STORES = {
  // ── Core Offline Infrastructure ──
  WORKSPACE_CONTEXT: 'workspace_context',
  DEVICE: 'device',
  SYNC_STATE: 'sync_state',
  OUTBOX: 'outbox',
  OUTBOX_ARCHIVE: 'outbox_archive',
  FORM_DRAFTS: 'form_drafts',
  MASTER_DATA: 'master_data',

  // ── ERP / Distributor Cache ──
  PARTNERS: 'partners',
  PRODUCTS: 'products',
  TRANSACTIONS: 'transactions',
  EXPENSES: 'expenses',

  // ── Domain: Hulu (Budidaya) — sesuai domain contracts ───
  AQUA_CYCLES: 'aqua_cycles',
  AQUA_FEED_EVENTS: 'aqua_feed_events',
  AQUA_HARVEST_EVENTS: 'aqua_harvest_events',
  AQUA_MORTALITY_EVENTS: 'aqua_mortality_events',
  AQUA_SAMPLING_EVENTS: 'aqua_sampling_events',
  AQUA_WATER_QUALITY_EVENTS: 'aqua_water_quality_events',
  AQUA_EXPENSE_EVENTS: 'aqua_expense_events',

  // ── Domain: Hilir (Inventory & Supply Chain) ──
  INVENTORY_BATCHES: 'inventory_batches',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export class TumbuDb {
  private db: IDBDatabase | null = null;

  public async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      // IndexedDB might not be available in non-client/SSR environment
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported or not running on client-side'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // ── Core Infrastructure Stores ──
        if (!db.objectStoreNames.contains(STORES.WORKSPACE_CONTEXT)) {
          db.createObjectStore(STORES.WORKSPACE_CONTEXT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.DEVICE)) {
          db.createObjectStore(STORES.DEVICE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SYNC_STATE)) {
          db.createObjectStore(STORES.SYNC_STATE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
          const outboxStore = db.createObjectStore(STORES.OUTBOX, { keyPath: 'id' });
          outboxStore.createIndex('status', 'status', { unique: false });
          outboxStore.createIndex('aggregate', 'aggregate', { unique: false });
          outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.OUTBOX_ARCHIVE)) {
          db.createObjectStore(STORES.OUTBOX_ARCHIVE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.FORM_DRAFTS)) {
          db.createObjectStore(STORES.FORM_DRAFTS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.MASTER_DATA)) {
          db.createObjectStore(STORES.MASTER_DATA, { keyPath: 'key' });
        }

        // ── ERP / Distributor Cache ──
        if (!db.objectStoreNames.contains(STORES.PARTNERS)) {
          db.createObjectStore(STORES.PARTNERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
          db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        }

        // ── Domain: Hulu (Budidaya/Aquaculture) ──
        if (!db.objectStoreNames.contains(STORES.AQUA_CYCLES)) {
          db.createObjectStore(STORES.AQUA_CYCLES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_FEED_EVENTS)) {
          db.createObjectStore(STORES.AQUA_FEED_EVENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_HARVEST_EVENTS)) {
          db.createObjectStore(STORES.AQUA_HARVEST_EVENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_MORTALITY_EVENTS)) {
          db.createObjectStore(STORES.AQUA_MORTALITY_EVENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_SAMPLING_EVENTS)) {
          db.createObjectStore(STORES.AQUA_SAMPLING_EVENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_WATER_QUALITY_EVENTS)) {
          db.createObjectStore(STORES.AQUA_WATER_QUALITY_EVENTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.AQUA_EXPENSE_EVENTS)) {
          db.createObjectStore(STORES.AQUA_EXPENSE_EVENTS, { keyPath: 'id' });
        }

        // ── Domain: Hilir (Inventory) ──
        if (!db.objectStoreNames.contains(STORES.INVENTORY_BATCHES)) {
          db.createObjectStore(STORES.INVENTORY_BATCHES, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`));
      };
    });
  }

  // Generic write method (insert or update)
  public async put<T>(storeName: string, data: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Generic read method
  public async get<T>(storeName: string, id: string): Promise<T | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic delete method
  public async delete(storeName: string, id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Generic fetch all records (optional index and query for filtered results)
  public async getAll<T>(storeName: string, indexName?: string, query?: IDBValidKey): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic clear store method
  public async clear(storeName: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export single instance for global use in apps/web
export const localDb = new TumbuDb();

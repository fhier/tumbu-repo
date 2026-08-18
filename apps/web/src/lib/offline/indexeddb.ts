// lib/offline/indexeddb.ts

const DB_NAME = 'tumbu_offline_db';
const DB_VERSION = 1;

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

        // 1. workspace_context (key-value store, primary key: id)
        if (!db.objectStoreNames.contains('workspace_context')) {
          db.createObjectStore('workspace_context', { keyPath: 'id' });
        }
        // 2. device (key-value store, primary key: id)
        if (!db.objectStoreNames.contains('device')) {
          db.createObjectStore('device', { keyPath: 'id' });
        }
        // 3. partners (local partner cache, primary key: id/clientPartnerId)
        if (!db.objectStoreNames.contains('partners')) {
          db.createObjectStore('partners', { keyPath: 'id' });
        }
        // 4. products (local catalog cache, primary key: id)
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        // 5. transactions (local transaction log cache, primary key: id/clientTransactionId)
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        // 6. expenses (local expense cache, primary key: id/clientExpenseId)
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' });
        }
        // 7. sync_state (key-value store, primary key: id)
        if (!db.objectStoreNames.contains('sync_state')) {
          db.createObjectStore('sync_state', { keyPath: 'id' });
        }
        // 8. outbox (active command queue, primary key: id)
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
        // 9. outbox_archive (archived sync commands, primary key: id)
        if (!db.objectStoreNames.contains('outbox_archive')) {
          db.createObjectStore('outbox_archive', { keyPath: 'id' });
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

  // Generic fetch all records
  public async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

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

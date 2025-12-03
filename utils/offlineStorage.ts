/**
 * IndexedDB Offline Storage for PWA
 * Provides persistent storage that survives browser close
 */

const DB_NAME = 'ConejoNegroPOS';
const DB_VERSION = 1;

// Store names
const STORES = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  EXPENSES: 'expenses',
  COWORKING_SESSIONS: 'coworkingSessions',
  CASH_SESSIONS: 'cashSessions',
  CASH_WITHDRAWALS: 'cashWithdrawals',
  USERS: 'users',
  CUSTOMERS: 'customers',
  PENDING_SYNC: 'pendingSync', // For offline mutations
  META: 'meta' // For timestamps, versions, etc.
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

// Initialize database
function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Error opening database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[OfflineDB] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[OfflineDB] Upgrading database...');

      // Create object stores if they don't exist
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === STORES.META) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          } else if (storeName === STORES.PENDING_SYNC) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });

      console.log('[OfflineDB] Database upgrade complete');
    };
  });

  return dbPromise;
}

// Generic CRUD operations

/**
 * Save all items to a store (replace all)
 */
export async function saveAll<T extends { id: string }>(
  storeName: StoreName,
  items: T[]
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Clear existing and add new
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      let addedCount = 0;
      if (items.length === 0) {
        resolve();
        return;
      }

      items.forEach(item => {
        const request = store.add(item);
        request.onsuccess = () => {
          addedCount++;
          if (addedCount === items.length) {
            // Update metadata
            saveMeta(storeName, { lastUpdated: Date.now(), count: items.length });
          }
        };
        request.onerror = () => {
          console.error(`[OfflineDB] Error adding item to ${storeName}:`, request.error);
        };
      });
    };

    transaction.oncomplete = () => {
      console.log(`[OfflineDB] Saved ${items.length} items to ${storeName}`);
      resolve();
    };

    transaction.onerror = () => {
      console.error(`[OfflineDB] Transaction error for ${storeName}:`, transaction.error);
      reject(transaction.error);
    };
  });
}

/**
 * Get all items from a store
 */
export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      console.log(`[OfflineDB] Retrieved ${request.result.length} items from ${storeName}`);
      resolve(request.result);
    };

    request.onerror = () => {
      console.error(`[OfflineDB] Error getting items from ${storeName}:`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Get single item by ID
 */
export async function getById<T>(storeName: StoreName, id: string): Promise<T | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Add or update single item
 */
export async function saveItem<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => {
      console.log(`[OfflineDB] Saved item ${item.id} to ${storeName}`);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete item by ID
 */
export async function deleteItem(storeName: StoreName, id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`[OfflineDB] Deleted item ${id} from ${storeName}`);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Metadata operations

async function saveMeta(storeName: string, meta: object): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.META, 'readwrite');
    const store = transaction.objectStore(STORES.META);
    const request = store.put({ key: storeName, ...meta });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMeta(storeName: string): Promise<{ lastUpdated: number; count: number } | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.META, 'readonly');
    const store = transaction.objectStore(STORES.META);
    const request = store.get(storeName);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if offline data is stale
 */
export async function isDataStale(storeName: StoreName, maxAgeMs: number): Promise<boolean> {
  const meta = await getMeta(storeName);
  if (!meta) return true;
  return Date.now() - meta.lastUpdated > maxAgeMs;
}

// Pending sync operations (for offline mutations)

interface PendingSyncItem {
  id?: number;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  store: StoreName;
  endpoint: string;
  method: string;
  body?: any;
  timestamp: number;
  retries: number;
}

/**
 * Queue an operation for sync when online
 */
export async function queueForSync(item: Omit<PendingSyncItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const request = store.add({
      ...item,
      timestamp: Date.now(),
      retries: 0
    });

    request.onsuccess = () => {
      console.log(`[OfflineDB] Queued ${item.type} operation for sync`);
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending sync operations
 */
export async function getPendingSync(): Promise<PendingSyncItem[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readonly');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove synced operation from queue
 */
export async function removeSyncedItem(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PENDING_SYNC, 'readwrite');
    const store = transaction.objectStore(STORES.PENDING_SYNC);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process all pending sync operations
 */
export async function processPendingSync(): Promise<{ success: number; failed: number }> {
  const pending = await getPendingSync();
  let success = 0;
  let failed = 0;

  console.log(`[OfflineDB] Processing ${pending.length} pending sync operations`);

  for (const item of pending) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined
      });

      if (response.ok) {
        await removeSyncedItem(item.id!);
        success++;
        console.log(`[OfflineDB] Synced ${item.type} operation to ${item.endpoint}`);
      } else {
        failed++;
        console.error(`[OfflineDB] Failed to sync ${item.type} to ${item.endpoint}: ${response.status}`);
      }
    } catch (error) {
      failed++;
      console.error(`[OfflineDB] Sync error for ${item.endpoint}:`, error);
    }
  }

  return { success, failed };
}

// Convenience exports
export { STORES };

export default {
  initDB,
  saveAll,
  getAll,
  getById,
  saveItem,
  deleteItem,
  getMeta,
  isDataStale,
  queueForSync,
  getPendingSync,
  processPendingSync,
  STORES
};

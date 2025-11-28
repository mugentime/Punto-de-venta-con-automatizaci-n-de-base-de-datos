/**
 * Session Cache Utility
 * Caches API data in sessionStorage to avoid refetching on page refresh
 * Data persists only for the browser session (cleared when tab closes)
 */

const CACHE_PREFIX = 'pos_cache_';
const CACHE_VERSION = 'v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for background refresh

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

export const sessionCache = {
  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Check version compatibility
      if (entry.version !== CACHE_VERSION) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Cache read error for ${key}:`, error);
      return null;
    }
  },

  /**
   * Check if cache is stale (older than TTL)
   */
  isStale(key: string): boolean {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (!cached) return true;

      const entry: CacheEntry<unknown> = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;

      return age > CACHE_TTL;
    } catch {
      return true;
    }
  },

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION
      };

      sessionStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error(`Cache write error for ${key}:`, error);
      // If storage is full, clear old cache entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        sessionCache.clearAll();
      }
    }
  },

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      sessionStorage.removeItem(cacheKey);
    } catch (error) {
      console.error(`Cache remove error for ${key}:`, error);
    }
  },

  /**
   * Clear all POS cache entries
   */
  clearAll(): void {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      console.log(`🗑️ Cleared ${keysToRemove.length} cache entries`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  },

  /**
   * Get cache timestamp for a key
   */
  getTimestamp(key: string): number | null {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (!cached) return null;

      const entry: CacheEntry<unknown> = JSON.parse(cached);
      return entry.timestamp;
    } catch {
      return null;
    }
  }
};

// Cache keys for different data types
export const CACHE_KEYS = {
  PRODUCTS: 'products',
  ORDERS: 'orders',
  EXPENSES: 'expenses',
  COWORKING_SESSIONS: 'coworking_sessions',
  CASH_SESSIONS: 'cash_sessions',
  USERS: 'users',
  CUSTOMERS: 'customers',
  CASH_WITHDRAWALS: 'cash_withdrawals'
} as const;

export default sessionCache;

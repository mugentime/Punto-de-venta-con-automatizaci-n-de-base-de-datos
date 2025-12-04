/**
 * API Cache & Request Deduplication System
 * Prevents redundant API calls and provides intelligent caching for PWA
 */

// In-flight request tracking for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// API Response Cache with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

const apiCache = new Map<string, CacheEntry<any>>();

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  products: 10 * 60 * 1000,      // 10 minutes - products don't change often
  orders: 30 * 1000,             // 30 seconds - orders change frequently
  expenses: 2 * 60 * 1000,       // 2 minutes
  'coworking-sessions': 5 * 1000, // 5 seconds - real-time updates needed
  'cash-sessions': 60 * 1000,    // 1 minute
  users: 5 * 60 * 1000,          // 5 minutes
  customers: 5 * 60 * 1000,      // 5 minutes
  'cash-withdrawals': 60 * 1000, // 1 minute
  default: 30 * 1000             // 30 seconds default
};

// Get cache TTL for endpoint
function getCacheTTL(endpoint: string): number {
  const key = endpoint.replace('/api/', '').split('/')[0].split('?')[0];
  return CACHE_TTL[key as keyof typeof CACHE_TTL] || CACHE_TTL.default;
}

// Check if cache is still valid
function isCacheValid(endpoint: string): boolean {
  const entry = apiCache.get(endpoint);
  if (!entry) return false;

  const ttl = getCacheTTL(endpoint);
  const age = Date.now() - entry.timestamp;
  return age < ttl;
}

// Get cached data if valid
export function getCachedData<T>(endpoint: string): T | null {
  if (isCacheValid(endpoint)) {
    const entry = apiCache.get(endpoint);
    console.log(`[ApiCache] HIT: ${endpoint} (age: ${Date.now() - entry!.timestamp}ms)`);
    return entry?.data || null;
  }
  return null;
}

// Set cache data
export function setCacheData<T>(endpoint: string, data: T, etag?: string): void {
  apiCache.set(endpoint, {
    data,
    timestamp: Date.now(),
    etag
  });
  console.log(`[ApiCache] SET: ${endpoint}`);
}

// Invalidate cache for endpoint
export function invalidateCache(endpoint: string): void {
  apiCache.delete(endpoint);
  console.log(`[ApiCache] INVALIDATE: ${endpoint}`);
}

// Invalidate cache by pattern
export function invalidateCachePattern(pattern: string): void {
  const keys = Array.from(apiCache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      apiCache.delete(key);
      console.log(`[ApiCache] INVALIDATE (pattern): ${key}`);
    }
  });
}

// Clear all cache
export function clearAllCache(): void {
  apiCache.clear();
  console.log(`[ApiCache] CLEAR ALL`);
}

/**
 * Deduplicated fetch - prevents multiple identical requests
 * Returns cached data if valid, otherwise fetches from network
 */
export async function dedupedFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  forceRefresh = false
): Promise<T> {
  const cacheKey = `${options.method || 'GET'}:${endpoint}`;

  // Check cache first (for GET requests only)
  if (!forceRefresh && (!options.method || options.method === 'GET')) {
    const cached = getCachedData<T>(endpoint);
    if (cached !== null) {
      return cached;
    }
  }

  // Check if there's already an in-flight request for this endpoint
  if (inFlightRequests.has(cacheKey)) {
    console.log(`[ApiCache] DEDUP: Reusing in-flight request for ${endpoint}`);
    return inFlightRequests.get(cacheKey)!;
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      console.log(`[ApiCache] FETCH: ${endpoint}`);
      const response = await fetch(endpoint, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache GET responses
      if (!options.method || options.method === 'GET') {
        const etag = response.headers.get('etag') || undefined;
        setCacheData(endpoint, data, etag);
      }

      return data as T;
    } finally {
      // Remove from in-flight tracking
      inFlightRequests.delete(cacheKey);
    }
  })();

  // Track in-flight request
  inFlightRequests.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Smart refresh - only fetches if cache is stale or forced
 */
export async function smartFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; fromCache: boolean }> {
  const cached = getCachedData<T>(endpoint);

  if (cached !== null) {
    // Return cached immediately, optionally refresh in background
    const ttl = getCacheTTL(endpoint);
    const entry = apiCache.get(endpoint);
    const age = Date.now() - (entry?.timestamp || 0);

    // If cache is more than 50% old, refresh in background
    if (age > ttl * 0.5) {
      console.log(`[ApiCache] Background refresh for ${endpoint}`);
      dedupedFetch<T>(endpoint, options, true).catch(console.error);
    }

    return { data: cached, fromCache: true };
  }

  const data = await dedupedFetch<T>(endpoint, options);
  return { data, fromCache: false };
}

/**
 * Batch fetch - fetches multiple endpoints efficiently
 */
export async function batchFetch<T extends Record<string, any>>(
  endpoints: string[]
): Promise<T> {
  const results: Record<string, any> = {};

  // Check which endpoints have valid cache
  const needsFetch: string[] = [];

  endpoints.forEach(endpoint => {
    const cached = getCachedData(endpoint);
    if (cached !== null) {
      const key = endpoint.replace('/api/', '').split('?')[0];
      results[key] = cached;
    } else {
      needsFetch.push(endpoint);
    }
  });

  // Fetch only what's needed, in parallel
  if (needsFetch.length > 0) {
    console.log(`[ApiCache] Batch fetch: ${needsFetch.length}/${endpoints.length} endpoints need refresh`);

    const fetchPromises = needsFetch.map(async endpoint => {
      try {
        const data = await dedupedFetch(endpoint);
        const key = endpoint.replace('/api/', '').split('?')[0];
        results[key] = data;
      } catch (error) {
        console.error(`[ApiCache] Error fetching ${endpoint}:`, error);
      }
    });

    await Promise.all(fetchPromises);
  } else {
    console.log(`[ApiCache] Batch fetch: All ${endpoints.length} endpoints served from cache`);
  }

  return results as T;
}

// Visibility-aware refresh (only refresh if tab is visible AND cache is stale)
let lastVisibilityRefresh = 0;
const MIN_VISIBILITY_REFRESH_INTERVAL = 5000; // Min 5 seconds between visibility refreshes

export function shouldRefreshOnVisibility(endpoint: string): boolean {
  const now = Date.now();

  // Prevent rapid refreshes on visibility change
  if (now - lastVisibilityRefresh < MIN_VISIBILITY_REFRESH_INTERVAL) {
    return false;
  }

  // Only refresh if cache is actually stale
  if (isCacheValid(endpoint)) {
    return false;
  }

  lastVisibilityRefresh = now;
  return true;
}

// Export cache stats for debugging
export function getCacheStats(): {
  entries: number;
  keys: string[];
  hitRate: string;
} {
  return {
    entries: apiCache.size,
    keys: Array.from(apiCache.keys()),
    hitRate: 'N/A' // Would need to track hits/misses for accurate rate
  };
}

export default {
  dedupedFetch,
  smartFetch,
  batchFetch,
  getCachedData,
  setCacheData,
  invalidateCache,
  invalidateCachePattern,
  clearAllCache,
  shouldRefreshOnVisibility,
  getCacheStats
};

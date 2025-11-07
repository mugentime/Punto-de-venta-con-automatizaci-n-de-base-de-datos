/**
 * Request Deduplication Utility
 * Prevents duplicate requests from being sent simultaneously
 * Useful for preventing duplicate orders from rapid button clicks
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

interface RequestDedupConfig {
  ttl?: number; // Time to live in milliseconds
}

/**
 * Request Deduplicator class
 * Maintains a cache of pending requests and returns existing promises
 * for duplicate keys instead of creating new requests
 */
export class RequestDeduplicator {
  private pending: Map<string, PendingRequest> = new Map();
  private readonly TTL: number;

  constructor(config?: RequestDedupConfig) {
    this.TTL = config?.ttl || 60000; // Default 60 seconds
  }

  /**
   * Deduplicate a request by key
   * If a request with this key is already pending, return the existing promise
   * Otherwise, execute the function and cache the promise
   *
   * @param key Unique key for this request
   * @param fn Function to execute if no pending request exists
   * @returns Promise that resolves to the result
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Check for existing pending request
    const existing = this.pending.get(key);
    if (existing && now - existing.timestamp < this.TTL) {
      console.log(`[RequestDedup] Reusing existing request for key: ${key}`);
      return existing.promise as Promise<T>;
    }

    // Clear expired requests periodically
    this.clearExpired();

    // Create new request
    const promise = fn()
      .then(result => {
        // Keep in cache for a short time in case of rapid subsequent requests
        setTimeout(() => this.pending.delete(key), 5000);
        return result;
      })
      .catch(error => {
        // Remove from cache on error to allow retry
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, { promise, timestamp: now });
    return promise;
  }

  /**
   * Clear expired requests from the cache
   */
  private clearExpired() {
    const now = Date.now();
    for (const [key, value] of this.pending.entries()) {
      if (now - value.timestamp >= this.TTL) {
        this.pending.delete(key);
      }
    }
  }

  /**
   * Clear a specific request from the cache
   * @param key Key of the request to clear
   */
  clear(key: string) {
    this.pending.delete(key);
  }

  /**
   * Clear all pending requests from the cache
   */
  clearAll() {
    this.pending.clear();
  }

  /**
   * Get the number of pending requests
   * @returns Number of pending requests
   */
  get size(): number {
    return this.pending.size;
  }

  /**
   * Check if a request is currently pending
   * @param key Key to check
   * @returns True if request is pending
   */
  isPending(key: string): boolean {
    const existing = this.pending.get(key);
    if (!existing) return false;

    const now = Date.now();
    return now - existing.timestamp < this.TTL;
  }
}

// Singleton instance for global use
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Helper function to generate a stable idempotency key
 * @param parts Parts to include in the key
 * @returns Stable key string
 */
export function generateIdempotencyKey(...parts: any[]): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const partsStr = parts.map(p => JSON.stringify(p)).join('-');
  return `${partsStr}-${timestamp}-${random}`;
}

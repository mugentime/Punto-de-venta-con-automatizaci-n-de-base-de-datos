/**
 * Retry utility with exponential backoff
 * Handles transient network errors gracefully by retrying failed operations
 */

interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: (error) => {
    // Retry on network errors
    if (error.message?.includes('Failed to fetch')) return true;
    if (error.message?.includes('NetworkError')) return true;

    // Retry on server errors (5xx)
    if (error.status >= 500 && error.status < 600) return true;

    // Retry on timeout errors
    if (error.name === 'AbortError') return true;

    return false;
  },
  onRetry: (attempt, error) => {
    console.log(`[Retry] Attempt ${attempt} after error:`, error.message || error);
  },
};

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= mergedConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors (4xx client errors)
      if (!mergedConfig.retryableErrors(error)) {
        throw error;
      }

      // Don't delay on last attempt
      if (attempt === mergedConfig.maxAttempts) {
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        mergedConfig.initialDelay * Math.pow(mergedConfig.backoffFactor, attempt - 1),
        mergedConfig.maxDelay
      );

      mergedConfig.onRetry(attempt, error);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Specialized retry for fetch requests with timeout support
 * @param url URL to fetch
 * @param options Fetch options
 * @param config Retry configuration
 * @param timeoutMs Timeout in milliseconds (default: 15000)
 * @returns Response object
 */
export async function retryFetch(
  url: string,
  options?: RequestInit,
  config?: RetryConfig,
  timeoutMs: number = 15000
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Treat HTTP errors as exceptions for retry logic
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
          error.status = response.status;
          error.response = response;
          throw error;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    {
      ...config,
      retryableErrors: (error) => {
        // Network errors
        if (error.message?.includes('Failed to fetch')) return true;
        if (error.message?.includes('NetworkError')) return true;

        // Server errors (5xx)
        if (error.status >= 500) return true;

        // Timeout errors
        if (error.name === 'AbortError') return true;

        return false;
      },
    }
  );
}

/**
 * Helper function to check if an error is retriable
 * @param error Error to check
 * @returns True if error is retriable
 */
export function isRetriableError(error: any): boolean {
  return DEFAULT_CONFIG.retryableErrors(error);
}

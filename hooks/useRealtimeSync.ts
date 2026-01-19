/**
 * useRealtimeSync Hook
 *
 * React hook for integrating real-time SSE synchronization into components.
 * Automatically refetches data when changes are detected.
 */

import { useEffect, useCallback, useRef } from 'react';
import realtimeSync from '../services/realtimeSync';

type DataType = 'products' | 'orders' | 'expenses' | 'coworking-sessions' | 'cash-sessions' | 'customers' | 'cash-withdrawals';

interface UseRealtimeSyncOptions {
  /**
   * Data types to listen for changes
   */
  dataTypes: DataType[];

  /**
   * Callback function to execute when data changes are detected
   */
  onDataChange: (dataType: DataType, action?: string) => void | Promise<void>;

  /**
   * Enable/disable sync (default: true)
   */
  enabled?: boolean;

  /**
   * Debounce delay in ms to prevent rapid refetches (default: 500ms)
   */
  debounceDelay?: number;
}

/**
 * Hook for real-time data synchronization via SSE
 */
export function useRealtimeSync(options: UseRealtimeSyncOptions): void {
  const { dataTypes, onDataChange, enabled = true, debounceDelay = 500 } = options;
  const debounceTimers = useRef<Map<DataType, number>>(new Map());

  const handleDataChange = useCallback((event: any) => {
    const { dataType, action } = event;

    // Only handle if we're listening for this data type
    if (!dataTypes.includes(dataType)) {
      return;
    }

    console.log(`[useRealtimeSync] Data change detected: ${dataType} ${action}`);

    // Clear existing debounce timer for this data type
    const existingTimer = debounceTimers.current.get(dataType);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced callback
    const timer = window.setTimeout(() => {
      onDataChange(dataType, action);
      debounceTimers.current.delete(dataType);
    }, debounceDelay);

    debounceTimers.current.set(dataType, timer);
  }, [dataTypes, onDataChange, debounceDelay]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Connect to SSE server
    realtimeSync.connect();

    // Register event listener
    const unsubscribe = realtimeSync.on(handleDataChange);

    // Cleanup
    return () => {
      unsubscribe();

      // Clear all pending debounce timers
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, [enabled, handleDataChange]);
}

export default useRealtimeSync;

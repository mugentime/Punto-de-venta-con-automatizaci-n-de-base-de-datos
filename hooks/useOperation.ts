/**
 * useOperation Hook
 * Wraps async operations with loading state management
 * Prevents concurrent execution of the same operation
 */

import { useCallback } from 'react';
import { useOperationContext } from '../contexts/OperationContext';

export interface UseOperationOptions {
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export interface UseOperationReturn<T extends any[], R> {
  execute: (...args: T) => Promise<R | null>;
  isPending: boolean;
}

/**
 * Custom hook for managing async operations with loading states
 *
 * @param operationId Unique identifier for this operation
 * @param fn Async function to execute
 * @param options Optional callbacks
 * @returns Execute function and pending state
 *
 * @example
 * const { execute: createOrder, isPending } = useOperation(
 *   'create-order',
 *   async (orderData) => {
 *     const response = await fetch('/api/orders', {
 *       method: 'POST',
 *       body: JSON.stringify(orderData)
 *     });
 *     return response.json();
 *   }
 * );
 *
 * // In component
 * <button disabled={isPending} onClick={() => createOrder(data)}>
 *   {isPending ? 'Creating...' : 'Create Order'}
 * </button>
 */
export function useOperation<T extends any[], R>(
  operationId: string,
  fn: (...args: T) => Promise<R>,
  options?: UseOperationOptions
): UseOperationReturn<T, R> {
  const { startOperation, endOperation, isOperationPending } = useOperationContext();
  const isPending = isOperationPending(operationId);

  const execute = useCallback(
    async (...args: T): Promise<R | null> => {
      if (isPending) {
        console.warn(`[useOperation] Operation "${operationId}" already in progress`);
        return null;
      }

      startOperation(operationId, 'async-operation');
      try {
        const result = await fn(...args);
        endOperation(operationId, 'success');
        options?.onSuccess?.();
        return result;
      } catch (error) {
        endOperation(operationId, 'error');
        options?.onError?.(error);
        throw error;
      }
    },
    [operationId, fn, isPending, startOperation, endOperation, options]
  );

  return { execute, isPending };
}

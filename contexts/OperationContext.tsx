/**
 * Operation Context
 * Manages global loading states and prevents concurrent operations
 */

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface Operation {
  id: string;
  type: string;
  startTime: number;
  status: 'pending' | 'success' | 'error';
}

interface OperationContextType {
  operations: Map<string, Operation>;
  startOperation: (id: string, type: string) => void;
  endOperation: (id: string, status: 'success' | 'error') => void;
  isOperationPending: (id: string) => boolean;
  clearOperation: (id: string) => void;
  getAllOperations: () => Operation[];
}

const OperationContext = createContext<OperationContextType | undefined>(undefined);

export const OperationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<Map<string, Operation>>(new Map());

  const startOperation = useCallback((id: string, type: string) => {
    console.log(`[Operation] Starting: ${id} (${type})`);
    setOperations(prev => {
      const next = new Map(prev);
      next.set(id, { id, type, startTime: Date.now(), status: 'pending' });
      return next;
    });
  }, []);

  const endOperation = useCallback((id: string, status: 'success' | 'error') => {
    console.log(`[Operation] Ending: ${id} (${status})`);
    setOperations(prev => {
      const next = new Map(prev);
      const op = next.get(id);
      if (op) {
        next.set(id, { ...op, status });
        // Auto-clear after 2 seconds
        setTimeout(() => {
          setOperations(current => {
            const updated = new Map(current);
            updated.delete(id);
            return updated;
          });
        }, 2000);
      }
      return next;
    });
  }, []);

  const isOperationPending = useCallback(
    (id: string) => {
      return operations.get(id)?.status === 'pending';
    },
    [operations]
  );

  const clearOperation = useCallback((id: string) => {
    setOperations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getAllOperations = useCallback(() => {
    return Array.from(operations.values());
  }, [operations]);

  return (
    <OperationContext.Provider
      value={{
        operations,
        startOperation,
        endOperation,
        isOperationPending,
        clearOperation,
        getAllOperations,
      }}
    >
      {children}
    </OperationContext.Provider>
  );
};

export const useOperationContext = () => {
  const context = useContext(OperationContext);
  if (!context) {
    throw new Error('useOperationContext must be used within OperationProvider');
  }
  return context;
};

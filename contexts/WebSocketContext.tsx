/**
 * WebSocket Context
 * Manages real-time WebSocket connection for coworking updates
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (event: string, callback: (...args: any[]) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server (same origin)
    const socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('[WS] Connected to server');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[WS] Disconnected from server:', reason);
      setIsConnected(false);

      // If disconnected due to transport error, try to reconnect
      if (reason === 'io server disconnect') {
        // Server forcefully disconnected, try to reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message);
      setIsConnected(false);
      // Socket.io will automatically attempt to reconnect
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`[WS] Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[WS] Reconnection attempt ${attemptNumber}`);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('[WS] Reconnection failed after all attempts');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('[WS] Disconnecting socket');
      socketInstance.disconnect();
    };
  }, []);

  const subscribe = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!socket) {
      console.warn(`[WS] Cannot subscribe to ${event}: socket not initialized`);
      return () => {};
    }

    console.log(`[WS] Subscribing to event: ${event}`);
    socket.on(event, callback);

    // Return unsubscribe function
    return () => {
      console.log(`[WS] Unsubscribing from event: ${event}`);
      socket.off(event, callback);
    };
  }, [socket]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

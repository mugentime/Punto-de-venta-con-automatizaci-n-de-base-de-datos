/**
 * Connection Indicator Component
 * Shows WebSocket connection status
 */

import React from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

const ConnectionIndicator: React.FC = () => {
  const { isConnected } = useWebSocket();

  return (
    <div className="fixed top-2 right-2 z-50">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
          isConnected
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-amber-100 text-amber-800 border border-amber-300'
        }`}
        title={isConnected ? 'Conectado al servidor' : 'Reconectando...'}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
        <span className="hidden sm:inline">
          {isConnected ? 'En línea' : 'Reconectando'}
        </span>
      </div>
    </div>
  );
};

export default ConnectionIndicator;

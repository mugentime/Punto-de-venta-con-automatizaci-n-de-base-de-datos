/**
 * Real-time Synchronization Client - SSE (Server-Sent Events)
 *
 * This client connects to the SSE server and listens for data change events.
 * When a data change event is received, it invalidates the Service Worker cache
 * and triggers a refresh of the affected data in the application.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Service Worker cache invalidation
 * - Event listeners for data changes
 * - Online/offline detection
 */

type DataChangeEvent = {
  type: 'data-change';
  dataType: 'products' | 'orders' | 'expenses' | 'coworking-sessions' | 'cash-sessions' | 'customers' | 'cash-withdrawals';
  action?: 'create' | 'update' | 'delete';
  id?: string;
  timestamp: number;
};

type SSEEvent = DataChangeEvent | {
  type: 'connected';
  timestamp: number;
};

type EventCallback = (event: DataChangeEvent) => void;

class RealtimeSyncClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: number | null = null;
  private listeners: Set<EventCallback> = new Set();
  private isConnecting = false;
  private isManuallyDisconnected = false;

  /**
   * Start SSE connection
   */
  connect(): void {
    // Don't reconnect if manually disconnected
    if (this.isManuallyDisconnected) {
      console.log('[RealtimeSync] Skipping connect (manually disconnected)');
      return;
    }

    // Don't connect if already connected or connecting
    if (this.eventSource?.readyState === EventSource.OPEN || this.isConnecting) {
      console.log('[RealtimeSync] Already connected or connecting');
      return;
    }

    // Don't connect if offline
    if (!navigator.onLine) {
      console.log('[RealtimeSync] Offline, will connect when online');
      return;
    }

    this.isConnecting = true;
    console.log('[RealtimeSync] Connecting to SSE server...');

    try {
      // Close existing connection if any
      this.disconnect(false);

      // Create new EventSource
      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        console.log('[RealtimeSync] ✅ Connected to SSE server');
        this.reconnectAttempts = 0; // Reset on successful connection
        this.isConnecting = false;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          if (data.type === 'connected') {
            console.log('[RealtimeSync] Server acknowledged connection');
          } else if (data.type === 'data-change') {
            this.handleDataChange(data);
          }
        } catch (error) {
          console.error('[RealtimeSync] Failed to parse SSE event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('[RealtimeSync] SSE connection error:', error);
        this.isConnecting = false;

        // Only attempt reconnect if not manually disconnected
        if (!this.isManuallyDisconnected) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[RealtimeSync] Failed to create EventSource:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from SSE server
   */
  disconnect(manual = true): void {
    if (manual) {
      this.isManuallyDisconnected = true;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[RealtimeSync] Disconnected from SSE server');
    }

    this.isConnecting = false;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    // Don't reconnect if manually disconnected or offline
    if (this.isManuallyDisconnected || !navigator.onLine) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RealtimeSync] Max reconnect attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s...
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;
    console.log(`[RealtimeSync] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * Handle data change event
   */
  private async handleDataChange(event: DataChangeEvent): Promise<void> {
    console.log('[RealtimeSync] 🔄 Data change detected:', event.dataType, event.action);

    // Invalidate Service Worker cache for this data type
    await this.invalidateCache(event.dataType);

    // Notify all registered listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[RealtimeSync] Listener error:', error);
      }
    });
  }

  /**
   * Invalidate Service Worker cache for specific data type
   */
  private async invalidateCache(dataType: string): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'INVALIDATE_API',
          endpoint: dataType
        });
        console.log(`[RealtimeSync] ✅ Invalidated SW cache for: ${dataType}`);
      } catch (error) {
        console.error('[RealtimeSync] Failed to invalidate SW cache:', error);
      }
    }
  }

  /**
   * Add event listener for data changes
   */
  on(callback: EventCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get connection state
   */
  get state(): 'connected' | 'connecting' | 'disconnected' {
    if (this.eventSource?.readyState === EventSource.OPEN) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }

  /**
   * Resume connection (after manual disconnect)
   */
  resume(): void {
    this.isManuallyDisconnected = false;
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Create singleton instance
const realtimeSync = new RealtimeSyncClient();

// Auto-connect when online
window.addEventListener('online', () => {
  console.log('[RealtimeSync] Network online, connecting...');
  realtimeSync.resume();
});

// Disconnect when offline (will auto-reconnect when online)
window.addEventListener('offline', () => {
  console.log('[RealtimeSync] Network offline, disconnecting...');
  realtimeSync.disconnect(false);
});

// Auto-connect on page load (if online)
if (navigator.onLine) {
  realtimeSync.connect();
}

export default realtimeSync;

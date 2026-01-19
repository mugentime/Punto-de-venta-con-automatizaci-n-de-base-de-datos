/**
 * SSE (Server-Sent Events) Service - Real-time synchronization for PWA
 *
 * This service manages SSE connections to broadcast data changes to all connected clients.
 * When data changes in the database, this service notifies all clients so they can
 * refresh their cache and stay in sync.
 *
 * Usage in API routes:
 *   import { broadcastDataChange } from '../services/sseService.js';
 *   // After updating data in database:
 *   broadcastDataChange('products', { action: 'update', id: productId });
 */

const clients = new Set();

/**
 * Register a new SSE client connection
 * @param {Response} res - Express response object
 * @param {string} userId - User ID for tracking
 */
export function registerClient(res, userId = 'anonymous') {
  const client = {
    id: Date.now() + Math.random(),
    userId,
    res,
    lastPing: Date.now()
  };

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable buffering in nginx
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  clients.add(client);
  console.log(`[SSE] Client connected. Total clients: ${clients.size}`);

  // Handle client disconnect
  res.on('close', () => {
    clients.delete(client);
    console.log(`[SSE] Client disconnected. Total clients: ${clients.size}`);
  });

  return client;
}

/**
 * Broadcast data change event to all connected clients
 * @param {string} dataType - Type of data changed (products, orders, expenses, etc.)
 * @param {object} payload - Event payload with action details
 */
export function broadcastDataChange(dataType, payload = {}) {
  const event = {
    type: 'data-change',
    dataType,
    timestamp: Date.now(),
    ...payload
  };

  const message = `data: ${JSON.stringify(event)}\n\n`;

  let sent = 0;
  let failed = 0;

  clients.forEach(client => {
    try {
      client.res.write(message);
      client.lastPing = Date.now();
      sent++;
    } catch (error) {
      console.error('[SSE] Failed to send to client:', error);
      clients.delete(client);
      failed++;
    }
  });

  if (sent > 0) {
    console.log(`[SSE] Broadcast ${dataType} change to ${sent} clients (${failed} failed)`);
  }

  return { sent, failed };
}

/**
 * Send heartbeat to all clients to keep connection alive
 */
export function sendHeartbeat() {
  const message = `:heartbeat ${Date.now()}\n\n`;

  clients.forEach(client => {
    try {
      client.res.write(message);
      client.lastPing = Date.now();
    } catch (error) {
      clients.delete(client);
    }
  });
}

/**
 * Get count of connected clients
 */
export function getClientCount() {
  return clients.size;
}

/**
 * Clean up stale connections (clients that haven't responded in 5 minutes)
 */
export function cleanupStaleConnections() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  let cleaned = 0;

  clients.forEach(client => {
    if (client.lastPing < fiveMinutesAgo) {
      try {
        client.res.end();
      } catch (e) {
        // Ignore errors when closing stale connections
      }
      clients.delete(client);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    console.log(`[SSE] Cleaned up ${cleaned} stale connections`);
  }

  return cleaned;
}

// Start heartbeat every 30 seconds to keep connections alive
const heartbeatInterval = setInterval(sendHeartbeat, 30000);

// Cleanup stale connections every 2 minutes
const cleanupInterval = setInterval(cleanupStaleConnections, 120000);

// Cleanup on process exit
process.on('SIGTERM', () => {
  clearInterval(heartbeatInterval);
  clearInterval(cleanupInterval);
  clients.forEach(client => {
    try {
      client.res.end();
    } catch (e) {
      // Ignore
    }
  });
  clients.clear();
});

export default {
  registerClient,
  broadcastDataChange,
  sendHeartbeat,
  getClientCount,
  cleanupStaleConnections
};

/**
 * SSE Middleware Helper
 *
 * This middleware adds SSE broadcasting capability to Express responses.
 * Usage: After modifying data, call res.broadcastChange(dataType, action, id)
 */

import { broadcastDataChange } from '../services/sseService.js';

/**
 * Middleware that adds broadcastChange method to Express response object
 */
export function sseMiddleware(req, res, next) {
  /**
   * Broadcast data change to all connected SSE clients
   * @param {string} dataType - Type of data (products, orders, etc.)
   * @param {string} action - Action performed (create, update, delete)
   * @param {string} id - ID of the affected item
   */
  res.broadcastChange = function(dataType, action, id) {
    broadcastDataChange(dataType, { action, id });
    console.log(`[SSE Middleware] Broadcasted ${action} on ${dataType} (${id})`);
  };

  next();
}

export default sseMiddleware;

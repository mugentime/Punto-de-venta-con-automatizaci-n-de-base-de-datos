/**
 * SSE Routes
 *
 * Defines the /api/events endpoint for Server-Sent Events
 */

import { Router } from 'express';
import { registerClient } from '../services/sseService.js';

const router = Router();

/**
 * SSE endpoint - Clients connect here to receive real-time updates
 */
router.get('/events', (req, res) => {
  const userId = req.query.userId || 'anonymous';
  console.log(`[SSE Route] New client connection: ${userId}`);
  registerClient(res, userId);

  // Keep connection alive - client will handle reconnection
  req.on('close', () => {
    console.log(`[SSE Route] Client disconnected: ${userId}`);
  });
});

export default router;

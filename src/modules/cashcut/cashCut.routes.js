/**
 * Rutas Unificadas de Cortes de Caja
 * 🔧 TaskMaster: Unified Cash Cut Routes
 */

const express = require('express');
const { auth } = require('../../../middleware/auth-file');
const cashCutController = require('./cashCut.controller');

const router = express.Router();

/**
 * 📋 GET /api/cashcuts - Get all cash cuts
 * Query params:
 * - limit: number (default: 50)
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
router.get('/', auth, cashCutController.getCashCuts);

/**
 * 📊 GET /api/cashcuts/stats - Get cash cut statistics
 * Query params:
 * - period: 'today' | 'week' | 'month' | 'year' (default: 'week')
 */
router.get('/stats', auth, cashCutController.getStatistics);

/**
 * 📈 GET /api/cashcuts/charts - Get chart data
 * Query params:
 * - days: number (default: 30)
 */
router.get('/charts', auth, cashCutController.getChartsData);

/**
 * 🔍 GET /api/cashcuts/open - Get current open cash cut
 */
router.get('/open', auth, cashCutController.getOpenCashCut);

/**
 * 📊 GET /api/cashcuts/service/status - Get service status
 */
router.get('/service/status', auth, cashCutController.getServiceStatus);

/**
 * 🔄 POST /api/cashcuts/init - Initialize service (admin only)
 * Body:
 * - settings: object with service settings
 */
router.post('/init', auth, cashCutController.initializeService);

/**
 * ✋ POST /api/cashcuts/manual - Trigger manual cash cut
 * Body:
 * - notes: string (optional)
 */
router.post('/manual', auth, cashCutController.triggerManualCut);

/**
 * 🤖 POST /api/cashcuts/auto-run - Trigger automatic cash cut (on-demand)
 */
router.post('/auto-run', auth, cashCutController.triggerAutomaticCut);

/**
 * 🔍 GET /api/cashcuts/:id - Get specific cash cut by ID
 */
router.get('/:id', auth, cashCutController.getCashCutById);

/**
 * 📊 GET /api/cashcuts/:id/report - Get cash cut report
 * This is an alias for getting a cash cut by ID with the same data
 */
router.get('/:id/report', auth, cashCutController.getCashCutById);

/**
 * 🗑️ DELETE /api/cashcuts/:id - Delete cash cut (admin only)
 * Note: Implements soft delete
 */
router.delete('/:id', auth, cashCutController.deleteCashCut);

/**
 * 🚧 Future endpoints (placeholders)
 */

/**
 * POST /api/cashcuts - Create new cash cut
 * Body:
 * - openingAmount: number (required)
 * - openedBy: string (required)
 * - notes: string (optional)
 */
router.post('/', auth, cashCutController.createCashCut);

/**
 * POST /api/cashcuts/:id/entries - Add entry to cash cut
 * Body:
 * - type: 'sale' | 'expense' | 'adjustment' (required)
 * - amount: number (required)
 * - referenceId: string (optional)
 * - note: string (optional)
 */
router.post('/:id/entries', auth, cashCutController.addEntry);

/**
 * POST /api/cashcuts/:id/close - Close cash cut
 * Body:
 * - closingAmount: number (required)
 * - closedBy: string (required)
 * - notes: string (optional)
 */
router.post('/:id/close', auth, cashCutController.closeCashCut);

module.exports = router;

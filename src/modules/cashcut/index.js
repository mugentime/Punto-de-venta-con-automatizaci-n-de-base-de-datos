/**
 * Módulo Unificado de Cortes de Caja
 * 🔧 TaskMaster: Unified Cash Cut Module
 */

const cashCutService = require('./cashCut.service');
const cashCutController = require('./cashCut.controller');
const cashCutRoutes = require('./cashCut.routes');

module.exports = {
    service: cashCutService,
    controller: cashCutController,
    routes: cashCutRoutes,
    
    // Convenience methods for direct access
    init: (options) => cashCutService.init(options),
    triggerManualCut: (userId, notes) => cashCutService.triggerManualCut(userId, notes),
    performAutomaticCashCut: () => cashCutService.performAutomaticCashCut(),
    getCashCuts: (limit) => cashCutService.getCashCuts(limit),
    getCashCutById: (id) => cashCutService.getCashCutById(id),
    getStatus: () => cashCutService.getStatus(),
    stopAllJobs: () => cashCutService.stopAllJobs()
};

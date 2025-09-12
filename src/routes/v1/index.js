const express = require('express');
const createAuthRoutes = require('./auth');
const createProductRoutes = require('./products');
const createRecordRoutes = require('./records');
// Import other route modules as they're created

/**
 * API v1 Routes
 * Main router that combines all v1 API routes
 */
function createV1Routes(dependencies) {
    const router = express.Router();

    const {
        // Controllers
        authController,
        productController,
        recordController,
        // Services
        authService,
        // Middleware
        authMiddleware,
        validationMiddleware,
        // Other dependencies
        ...otherDeps
    } = dependencies;

    // Health check for this API version
    router.get('/health', (req, res) => {
        res.json({
            success: true,
            version: 'v1',
            timestamp: new Date().toISOString(),
            status: 'operational'
        });
    });

    // Mount route modules
    router.use('/auth', createAuthRoutes(authController, authMiddleware));
    
    // Products routes (protected)
    if (productController) {
        router.use('/products', authMiddleware, createProductRoutes(productController, validationMiddleware));
    }

    // Records routes (protected)
    if (recordController) {
        router.use('/records', authMiddleware, createRecordRoutes(recordController, validationMiddleware));
    }

    // Add other route modules as they're implemented
    // router.use('/users', authMiddleware, createUserRoutes(userController));
    // router.use('/reports', authMiddleware, createReportRoutes(reportController));
    // router.use('/cashcuts', authMiddleware, createCashCutRoutes(cashCutController));

    // Catch all for undefined routes in this version
    router.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
            version: 'v1'
        });
    });

    return router;
}

module.exports = createV1Routes;
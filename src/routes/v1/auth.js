const express = require('express');
const rateLimit = require('express-rate-limit');

/**
 * Auth Routes v1
 * RESTful authentication endpoints with proper rate limiting and validation
 */
function createAuthRoutes(authController, authMiddleware) {
    const router = express.Router();

    // Rate limiting for auth endpoints
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: {
            success: false,
            error: 'Too many authentication attempts, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false
    });

    const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
        message: {
            success: false,
            error: 'Too many requests, please try again later'
        }
    });

    // Public routes (no authentication required)
    router.post('/login', authLimiter, authController.login);
    
    // Registration might be admin-only in production
    router.post('/register', authLimiter, authController.register);

    // Protected routes (authentication required)
    router.use(authMiddleware); // Apply auth middleware to all routes below

    router.post('/refresh', generalLimiter, authController.refreshToken);
    router.post('/change-password', generalLimiter, authController.changePassword);
    router.post('/logout', generalLimiter, authController.logout);
    router.get('/profile', generalLimiter, authController.getProfile);
    router.get('/permissions', generalLimiter, authController.getPermissions);

    return router;
}

module.exports = createAuthRoutes;
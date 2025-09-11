/**
 * @fileoverview Authentication Middleware
 * @description PostgreSQL-compatible authentication middleware with circuit breaker protection
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-11
 */

const jwt = require('jsonwebtoken');
const databaseManager = require('../utils/databaseManager');

// Import application constants for consistency
const {
  SECURITY,
  HTTP_STATUS,
  ERROR_MESSAGES
} = require('../config/constants');

/**
 * Circuit Breaker Configuration
 * Prevents infinite authentication loops and DoS attacks
 * @type {number} authRequestCount - Current request count within window
 * @type {number} lastReset - Timestamp of last circuit breaker reset
 */
let authRequestCount = 0;
let lastReset = Date.now();

/**
 * Authentication Middleware
 * PostgreSQL-compatible authentication with circuit breaker protection
 * Validates JWT tokens and attaches user information to request object
 * 
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 * @returns {void}
 * 
 * @example
 * // Usage in routes
 * app.get('/api/protected', auth, (req, res) => {
 *   // req.user contains authenticated user data
 *   console.log(req.user.email, req.user.role);
 * });
 */
const auth = async (req, res, next) => {
  try {
    // Circuit breaker check
    const now = Date.now();
    if (now - lastReset > SECURITY.CIRCUIT_BREAKER_WINDOW) {
      authRequestCount = 0;
      lastReset = now;
    }
    
    authRequestCount++;
    if (authRequestCount > SECURITY.CIRCUIT_BREAKER_LIMIT) {
      console.error(`🚨 CIRCUIT BREAKER: Auth middleware triggered ${authRequestCount} times in ${CIRCUIT_BREAKER_WINDOW}ms`);
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: ERROR_MESSAGES.AUTH.CIRCUIT_BREAKER,
        retryAfter: Math.ceil((SECURITY.CIRCUIT_BREAKER_WINDOW - (now - lastReset)) / 1000)
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.NO_TOKEN
      });
    }

    // Verify token using databaseManager for compatibility with file/PostgreSQL modes
    const decoded = databaseManager.verifyToken(token);
    if (!decoded) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.INVALID_TOKEN
      });
    }
    
    // CRITICAL FIX: Use databaseManager instead of MongoDB User model
    // This prevents the infinite loop caused by MongoDB dependency  
    const user = await databaseManager.getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email || user.email,
      role: decoded.role || user.role,
      permissions: user.permissions || {
        canManageInventory: true,
        canRegisterClients: true,
        canViewReports: true,
        canManageUsers: user.role === 'admin',
        canExportData: ['admin', 'manager'].includes(user.role),
        canDeleteRecords: user.role === 'admin'
      }
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.INVALID_TOKEN
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.EXPIRED_TOKEN
      });
    }

    console.error('Auth middleware error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_MESSAGES.GENERAL.INTERNAL_ERROR
    });
  }
};

/**
 * Admin Authentication Middleware
 * Ensures the authenticated user has admin privileges
 * 
 * @param {Object} req - Express request object (must have req.user from auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 * @returns {void}
 * 
 * @example
 * // Usage: Apply after auth middleware
 * app.delete('/api/admin/users/:id', auth, adminAuth, deleteUserHandler);
 */
const adminAuth = (req, res, next) => {
  // Ensure user exists and has admin role
  if (!req.user || req.user.role !== 'admin') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      error: ERROR_MESSAGES.AUTH.ADMIN_REQUIRED
    });
  }
  next();
};

/**
 * Manager Authentication Middleware
 * Ensures the authenticated user has manager or admin privileges
 * 
 * @param {Object} req - Express request object (must have req.user from auth middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 * @returns {void}
 * 
 * @example
 * // Usage: Apply after auth middleware
 * app.get('/api/reports/financial', auth, managerAuth, getFinancialReports);
 */
const managerAuth = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      error: ERROR_MESSAGES.AUTH.MANAGER_REQUIRED
    });
  }
  next();
};

/**
 * Permission-Based Middleware Factory
 * Creates middleware that checks for specific user permissions
 * 
 * @param {string} permission - The permission key to check (e.g., 'canManageInventory')
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Create permission-specific middleware
 * const canDeleteRecords = requirePermission('canDeleteRecords');
 * app.delete('/api/records/:id', auth, canDeleteRecords, deleteRecord);
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions[permission]) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: `${ERROR_MESSAGES.AUTH.ACCESS_DENIED} ${permission} permission required.`
      });
    }
    next();
  };
};

/**
 * Pre-configured Permission Middleware
 * Common permission checks for the POS system
 */

/** @type {Function} Middleware to check inventory management permission */
const canManageInventory = requirePermission('canManageInventory');

/** @type {Function} Middleware to check client registration permission */
const canRegisterClients = requirePermission('canRegisterClients');

/** @type {Function} Middleware to check report viewing permission */
const canViewReports = requirePermission('canViewReports');

/** @type {Function} Middleware to check user management permission */
const canManageUsers = requirePermission('canManageUsers');

/** @type {Function} Middleware to check data export permission */
const canExportData = requirePermission('canExportData');

/** @type {Function} Middleware to check record deletion permission */
const canDeleteRecords = requirePermission('canDeleteRecords');

module.exports = {
  auth,
  adminAuth,
  managerAuth,
  requirePermission,
  canManageInventory,
  canRegisterClients,
  canViewReports,
  canManageUsers,
  canExportData,
  canDeleteRecords
};
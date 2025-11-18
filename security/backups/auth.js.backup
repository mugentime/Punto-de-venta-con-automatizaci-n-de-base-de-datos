const jwt = require('jsonwebtoken');
const databaseManager = require('../utils/databaseManager');

// Circuit breaker to prevent infinite auth loops
let authRequestCount = 0;
let lastReset = Date.now();
const CIRCUIT_BREAKER_LIMIT = 50;
const CIRCUIT_BREAKER_WINDOW = 10000; // 10 seconds

// CRITICAL FIX: PostgreSQL-Compatible Authentication Middleware with Circuit Breaker
// Fixed infinite loop by replacing MongoDB User.findById with databaseManager
const auth = async (req, res, next) => {
  try {
    // Circuit breaker check
    const now = Date.now();
    if (now - lastReset > CIRCUIT_BREAKER_WINDOW) {
      authRequestCount = 0;
      lastReset = now;
    }
    
    authRequestCount++;
    if (authRequestCount > CIRCUIT_BREAKER_LIMIT) {
      console.error(`🚨 CIRCUIT BREAKER: Auth middleware triggered ${authRequestCount} times in ${CIRCUIT_BREAKER_WINDOW}ms`);
      return res.status(429).json({
        error: 'Authentication circuit breaker activated. Too many auth requests.',
        retryAfter: Math.ceil((CIRCUIT_BREAKER_WINDOW - (now - lastReset)) / 1000)
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token using databaseManager for compatibility with file/PostgreSQL modes
    const decoded = databaseManager.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token.'
      });
    }
    
    // CRITICAL FIX: Use databaseManager instead of MongoDB User model
    // This prevents the infinite loop caused by MongoDB dependency  
    const user = await databaseManager.getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid token. User not found or inactive.'
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
      return res.status(401).json({
        error: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error.'
    });
  }
};

// FIXED: Admin authentication middleware
const adminAuth = (req, res, next) => {
  // Ensure user exists and has admin role
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Manager or admin authentication middleware
const managerAuth = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied. Manager or admin privileges required.'
    });
  }
  next();
};

// Permission-based middleware factory
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user.permissions[permission]) {
      return res.status(403).json({
        error: `Access denied. ${permission} permission required.`
      });
    }
    next();
  };
};

// Check if user can manage inventory
const canManageInventory = requirePermission('canManageInventory');

// Check if user can register clients
const canRegisterClients = requirePermission('canRegisterClients');

// Check if user can view reports
const canViewReports = requirePermission('canViewReports');

// Check if user can manage other users
const canManageUsers = requirePermission('canManageUsers');

// Check if user can export data
const canExportData = requirePermission('canExportData');

// Check if user can delete records
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
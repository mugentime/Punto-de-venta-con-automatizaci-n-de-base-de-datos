const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Basic authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid token. User not found or inactive.'
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: user.permissions
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

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
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
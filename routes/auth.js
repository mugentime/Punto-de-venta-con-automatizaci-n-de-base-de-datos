/**
 * PostgreSQL-Compatible Authentication Routes
 * CRITICAL FIX: Replace routes/auth.js with this file to fix authentication
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const databaseManager = require('../utils/databaseManager');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Login user (FIXED for PostgreSQL)
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 LOGIN ATTEMPT:', req.body.email);
    
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user using databaseManager (PostgreSQL compatible)
    const user = await databaseManager.getUserByEmail(email.toLowerCase());
    
    console.log('🔍 User lookup result:', user ? 'FOUND' : 'NOT FOUND');

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check password using bcrypt directly
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    console.log('🔑 Password validation:', isPasswordValid ? 'VALID' : 'INVALID');
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate token via databaseManager for compatibility with file/PostgreSQL modes
    const token = databaseManager.generateToken({
      _id: user._id || user.id, // Use _id from file DB or id from PostgreSQL
      email: user.email,
      role: user.role
    });

    console.log('🎫 Token generated:', token ? 'SUCCESS' : 'FAILED');

    // Update last login
    await databaseManager.updateUser(user.id, {
      lastLogin: new Date()
    });

    // CRITICAL: Return both token and authToken for frontend compatibility
    const response = {
      message: 'Login successful',
      token,
      authToken: token,  // Frontend expects this field specifically
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || {
          canManageInventory: true,
          canRegisterClients: true,
          canViewReports: true,
          canManageUsers: user.role === 'admin',
          canExportData: user.role === 'admin' || user.role === 'manager',
          canDeleteRecords: user.role === 'admin'
        }
      }
    };
    
    console.log('✅ LOGIN SUCCESS - Token preview:', token.substring(0, 20) + '...');
    res.json(response);

  } catch (error) {
    console.error('❌ LOGIN ERROR:', error);
    res.status(500).json({
      error: 'Login failed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Register new user (FIXED for PostgreSQL)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await databaseManager.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Check if this is the first user (make them admin)
    const allUsers = await databaseManager.getUsers();
    const userRole = allUsers.length === 0 ? 'admin' : (role || 'employee');

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: userRole,
      isActive: true,
      permissions: {
        canManageInventory: true,
        canRegisterClients: true,
        canViewReports: true,
        canManageUsers: userRole === 'admin',
        canExportData: userRole === 'admin' || userRole === 'manager',
        canDeleteRecords: userRole === 'admin'
      }
    };

    // Create user using databaseManager
    const user = await databaseManager.createUser(userData);

    // Generate token via databaseManager for compatibility with file/PostgreSQL modes
    const token = databaseManager.generateToken({
      _id: user._id || user.id, // Use _id from file DB or id from PostgreSQL
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      authToken: token,  // Frontend compatibility
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message && error.message.includes('duplicate')) {
      return res.status(409).json({
        error: 'Email already in use'
      });
    }

    res.status(500).json({
      error: 'Registration failed'
    });
  }
});

// Verify token (FIXED for PostgreSQL)
router.get('/verify', auth, async (req, res) => {
  try {
    const user = await databaseManager.getUserById(req.user.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Token verification failed'
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await databaseManager.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile'
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await databaseManager.getUserByEmail(email.toLowerCase());
      if (existingUser && existingUser.id !== req.user.userId) {
        return res.status(409).json({
          error: 'Email already in use'
        });
      }
    }

    const user = await databaseManager.updateUser(req.user.userId, updateData);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      error: 'Profile update failed'
    });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await databaseManager.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await databaseManager.updateUser(req.user.userId, {
      password: hashedPassword
    });

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      error: 'Password change failed'
    });
  }
});

module.exports = router;
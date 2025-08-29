const express = require('express');
const databaseManager = require('../utils/databaseManager');

const { auth } = require('../middleware/auth-file');

const router = express.Router();

// Register new user
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
    
    // Create user
    const user = await databaseManager.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'employee'
    });
    
    // Generate token
    const token = databaseManager.generateToken(user);
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message === 'User already exists') {
      return res.status(409).json({
        error: 'Email already in use'
      });
    }
    
    res.status(500).json({
      error: 'Registration failed'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 LOGIN REQUEST:', { 
      body: req.body, 
      timestamp: new Date().toISOString(),
      ip: req.ip 
    });
    
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      console.log('❌ LOGIN VALIDATION FAILED: Missing email or password');
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }
    
    console.log('🔍 VALIDATING CREDENTIALS for:', email);
    
    // Validate credentials
    const user = await databaseManager.validateUserPassword(email, password);
    
    if (!user) {
      console.log('❌ LOGIN FAILED: Invalid credentials for', email);
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    console.log('✅ LOGIN SUCCESS: Generating token for', email);
    
    // Generate token
    const token = databaseManager.generateToken(user);
    
    console.log('🎟️ TOKEN GENERATED successfully for', email);
    
    res.json({
      message: 'Login successful',
      token,
      user
    });
    
  } catch (error) {
    console.error('💥 LOGIN EXCEPTION:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error.message
    });
  }
});

// Verify token
router.get('/verify', auth, async (req, res) => {
  try {
    const user = await databaseManager.getUserById(req.user.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }
    
    const { password, ...safeUser } = user;
    
    res.json({
      valid: true,
      user: safeUser
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
    
    const { password, ...safeUser } = user;
    
    res.json({
      user: safeUser
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile'
    });
  }
});

// List all users (admin only)
router.get('/users', auth, async (req, res) => {
  try {
    // Check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin privileges required'
      });
    }
    
    const users = await databaseManager.getUsers();
    
    // Remove passwords from response
    const safeUsers = users.map(u => {
      const { password, ...safeUser } = u;
      return safeUser;
    });
    
    res.json({
      users: safeUsers,
      total: safeUsers.length
    });
    
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({
      error: 'Failed to fetch users'
    });
  }
});

// FORCE admin creation endpoint (bypasses all checks)
router.get('/force-create-admin', async (req, res) => {
  try {
    console.log('💀 FORCING ADMIN CREATION - NO CHECKS');
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    console.log('🔨 FORCING admin user creation...');
    
    // Try to delete existing admin first (if exists)
    try {
      const existingUsers = await databaseManager.getUsers();
      console.log('Found existing users:', existingUsers.length);
    } catch (e) {
      console.log('No existing users found or error:', e.message);
    }
    
    // Force create admin - use direct database insertion
    const adminData = {
      username: 'admin@conejonegro.com',
      password: hashedPassword,
      role: 'admin',
      permissions: {
        canManageInventory: true,
        canRegisterClients: true,
        canViewReports: true,
        canManageUsers: true,
        canExportData: true,
        canDeleteRecords: true
      }
    };
    
    console.log('🔥 Creating admin with data:', {
      username: adminData.username,
      role: adminData.role,
      hasPassword: !!adminData.password
    });
    
    const adminUser = await databaseManager.createUser(adminData);
    
    console.log('💥 ADMIN FORCED CREATED:', adminUser);
    
    res.json({
      success: true,
      message: 'ADMIN FORCE CREATED',
      email: 'admin@conejonegro.com',
      password: 'admin123',
      user: adminUser
    });
    
  } catch (error) {
    console.error('🔥 FORCE CREATION ERROR:', error);
    res.json({
      error: true,
      message: 'Force creation failed',
      details: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
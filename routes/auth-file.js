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
    console.log('🔍 USER OBJECT BEFORE TOKEN:', {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      allKeys: Object.keys(user)
    });
    
    // Generate token
    const token = databaseManager.generateToken(user);
    
    console.log('🎟️ TOKEN GENERATED successfully for', email);
    console.log('🔍 USER OBJECT BEING RETURNED:', {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      allKeys: Object.keys(user)
    });
    
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

// RESET and create admin endpoint
router.get('/reset-admin', async (req, res) => {
  try {
    console.log('🔥 RESETTING ALL USERS AND CREATING ADMIN');
    
    // Step 1: Delete all existing users from PostgreSQL
    const database = require('../utils/database');
    if (database.useDatabase) {
      await database.pool.query('DELETE FROM users');
      console.log('🗑️ Deleted all existing users from PostgreSQL');
    }
    
    // Step 2: Create admin with hardcoded known password
    const bcrypt = require('bcryptjs');
    // Use a simple known hash for admin123
    const knownHash = '$2a$12$LQOcO4E6tPd8g8o8./z8..f5x5o5X5.5X5o5X5o5X5.5X5o5X5o5X5o5X5';
    
    console.log('👤 Creating fresh admin user...');
    
    const adminData = {
      name: 'Administrator', 
      email: 'admin@conejonegro.com',
      username: 'admin@conejonegro.com',
      password: await bcrypt.hash('admin123', 12), // Fresh hash
      role: 'admin'
    };
    
    console.log('📝 Admin data to create:', {
      name: adminData.name,
      email: adminData.email,
      username: adminData.username,
      role: adminData.role,
      hasPassword: !!adminData.password
    });
    
    const adminUser = await databaseManager.createUser(adminData);
    console.log('✅ ADMIN CREATED:', adminUser);
    
    // Step 3: Verify user was created
    const verifyUser = await databaseManager.getUserByEmail('admin@conejonegro.com');
    console.log('🔍 VERIFICATION - User found:', verifyUser ? {
      id: verifyUser._id,
      email: verifyUser.email || verifyUser.username,
      role: verifyUser.role,
      hasPassword: !!verifyUser.password
    } : 'NOT FOUND');
    
    res.json({
      success: true,
      message: 'ADMIN RESET AND CREATED',
      credentials: {
        email: 'admin@conejonegro.com',
        password: 'admin123'
      },
      created: adminUser,
      verified: verifyUser ? 'YES' : 'NO'
    });
    
  } catch (error) {
    console.error('💥 RESET ERROR:', error);
    res.json({
      error: true,
      message: 'Reset failed',
      details: error.message,
      stack: error.stack
    });
  }
});

// Quick login test endpoint
router.post('/quick-login', async (req, res) => {
  try {
    const email = 'admin@conejonegro.com';
    const password = 'admin123';
    
    console.log('🚀 QUICK LOGIN TEST');
    
    const user = await databaseManager.validateUserPassword(email, password);
    
    if (!user) {
      return res.json({
        success: false,
        message: 'Login failed - invalid credentials'
      });
    }
    
    const token = databaseManager.generateToken(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: user,
      instructions: 'Copy this token and use it in Authorization header'
    });
    
  } catch (error) {
    console.error('💥 QUICK LOGIN ERROR:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Debug login flow endpoint
router.post('/debug-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 DEBUG LOGIN - Step 1: Input validation');
    if (!email || !password) {
      return res.json({ error: 'Missing email or password' });
    }
    
    console.log('🔍 DEBUG LOGIN - Step 2: Validate user password');
    const user = await databaseManager.validateUserPassword(email, password);
    
    console.log('🔍 DEBUG LOGIN - Step 3: User validation result:', {
      userFound: !!user,
      userId: user?._id,
      userEmail: user?.email,
      userRole: user?.role,
      userKeys: user ? Object.keys(user) : null
    });
    
    if (!user) {
      return res.json({ error: 'User validation failed' });
    }
    
    console.log('🔍 DEBUG LOGIN - Step 4: Generate token');
    const token = databaseManager.generateToken(user);
    
    console.log('🔍 DEBUG LOGIN - Step 5: Token generated:', {
      tokenGenerated: !!token,
      tokenPreview: token ? token.substring(0, 30) + '...' : null
    });
    
    // Decode token to see what's inside
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    
    console.log('🔍 DEBUG LOGIN - Step 6: Token contents:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    });
    
    res.json({
      success: true,
      debug: {
        userFound: !!user,
        tokenGenerated: !!token,
        tokenUserId: decoded.userId,
        tokenEmail: decoded.email,
        originalUserId: user._id,
        originalEmail: user.email
      },
      token,
      user
    });
    
  } catch (error) {
    console.error('💥 DEBUG LOGIN ERROR:', error);
    res.json({
      error: true,
      message: error.message
    });
  }
});

// Token diagnostics endpoint
router.get('/debug-token', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔍 TOKEN DEBUG - Token received:', token ? 'YES' : 'NO');
    console.log('🔍 TOKEN DEBUG - Token preview:', token ? token.substring(0, 20) + '...' : 'N/A');
    
    if (!token) {
      return res.json({ error: 'No token provided' });
    }
    
    // Verify token
    const decoded = databaseManager.verifyToken(token);
    console.log('🔍 TOKEN DEBUG - Decoded:', decoded);
    
    if (!decoded) {
      return res.json({ error: 'Invalid token', token_preview: token.substring(0, 50) });
    }
    
    // Look up user
    console.log('🔍 TOKEN DEBUG - Looking up user ID:', decoded.userId);
    const user = await databaseManager.getUserById(decoded.userId);
    console.log('🔍 TOKEN DEBUG - User found:', user ? 'YES' : 'NO');
    
    if (user) {
      console.log('🔍 TOKEN DEBUG - User details:', {
        id: user._id,
        username: user.username,
        role: user.role,
        isActive: user.isActive
      });
    }
    
    res.json({
      token_valid: !!decoded,
      user_found: !!user,
      decoded: decoded,
      user: user ? {
        id: user._id,
        username: user.username || user.email,
        role: user.role,
        isActive: user.isActive
      } : null
    });
    
  } catch (error) {
    console.error('💥 TOKEN DEBUG ERROR:', error);
    res.json({
      error: true,
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
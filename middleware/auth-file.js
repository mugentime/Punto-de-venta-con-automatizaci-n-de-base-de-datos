const databaseManager = require('../utils/databaseManager');

// Simple auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔐 AUTH MIDDLEWARE - Token received:', token ? 'YES' : 'NO');
    
    if (!token) {
      console.log('❌ AUTH MIDDLEWARE - No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    console.log('🔍 AUTH MIDDLEWARE - Verifying token...');
    const decoded = databaseManager.verifyToken(token);
    
    if (!decoded) {
      console.log('❌ AUTH MIDDLEWARE - Invalid token');
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.log('✅ AUTH MIDDLEWARE - Token decoded:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
    
    console.log('🔍 AUTH MIDDLEWARE - Looking up user by ID:', decoded.userId);
    const user = await databaseManager.getUserById(decoded.userId);
    
    if (!user) {
      console.log('❌ AUTH MIDDLEWARE - User not found by ID:', decoded.userId);
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (!user.isActive) {
      console.log('❌ AUTH MIDDLEWARE - User inactive:', decoded.userId);
      return res.status(401).json({ error: 'User inactive' });
    }
    
    console.log('✅ AUTH MIDDLEWARE - User found:', { id: user._id, role: user.role, active: user.isActive });
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: user.permissions
    };
    
    console.log('✅ AUTH MIDDLEWARE - Success, proceeding to next...');
    next();
  } catch (error) {
    console.error('💥 AUTH MIDDLEWARE ERROR:', error);
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

module.exports = { auth };
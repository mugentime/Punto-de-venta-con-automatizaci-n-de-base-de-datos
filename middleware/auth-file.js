const databaseManager = require('../utils/databaseManager');

// Simple auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('DEBUG AUTH - Token received:', token ? 'YES' : 'NO');
    console.log('DEBUG AUTH - JWT_SECRET exists:', process.env.JWT_SECRET ? 'YES' : 'NO (using default)');
    
    if (!token) {
      console.log('DEBUG AUTH - No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = databaseManager.verifyToken(token);
    console.log('DEBUG AUTH - Token decoded:', decoded ? 'SUCCESS' : 'FAILED');
    
    if (!decoded) {
      console.log('DEBUG AUTH - Token verification failed');
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = await databaseManager.getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: user.permissions
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { auth };
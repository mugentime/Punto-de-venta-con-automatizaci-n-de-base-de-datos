const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes - using file-based system
const authRoutes = require('./routes/auth-file');
const productRoutes = require('./routes/products-file');
const recordRoutes = require('./routes/records-file');
const backupRoutes = require('./routes/backup-file');

// Import auth middleware
const { auth } = require('./middleware/auth-file');

// Import services
const cloudStorageService = require('./utils/cloudStorage');
const fileDatabase = require('./utils/fileDatabase');

// Import scheduled tasks
require('./utils/scheduler');

const app = express();

// Security middleware with CSP configuration for inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"]
    }
  }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://pos-conejonegro-production.up.railway.app',
        process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize file-based database
let isDatabaseReady = false;

// Initialize file database on startup
(async () => {
  try {
    await fileDatabase.initialize();
    isDatabaseReady = true;
    console.log('✅ File database ready');
  } catch (error) {
    console.error('❌ File database initialization error:', error.message);
    isDatabaseReady = false;
  }
})();

// Middleware to check database availability
const requireDatabase = (req, res, next) => {
  if (!isDatabaseReady) {
    return res.status(503).json({
      error: 'Database service initializing',
      message: 'The database is still initializing. Please try again in a moment.',
      help: 'The file-based database is being set up.'
    });
  }
  next();
};

// Routes (with database requirement)
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/products', requireDatabase, productRoutes);
app.use('/api/records', requireDatabase, recordRoutes);
app.use('/api/backup', backupRoutes); // Backup can work without DB for file operations

// Export/download endpoint
app.get('/api/exports/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = cloudStorageService.getExportPath(filename);
    
    // Check if file exists and send it
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Export download error:', err);
        res.status(404).json({ error: 'Export file not found' });
      }
    });
  } catch (error) {
    console.error('Export endpoint error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Get storage information
    const storageStats = await cloudStorageService.getStorageStats ? 
      await cloudStorageService.getStorageStats() : 
      { type: 'unknown', available: 0 };

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: {
        railway: !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
        node_env: process.env.NODE_ENV || 'development'
      },
      storage: {
        type: storageStats.type || 'Unknown',
        available: storageStats.available || 0,
        used: storageStats.used || 0,
        isPersistent: storageStats.isPersistent || false,
        backupsCount: storageStats.backupsCount || 0
      },
      database: {
        type: 'file-based',
        ready: isDatabaseReady,
        status: isDatabaseReady ? 'ready' : 'initializing',
        path: fileDatabase.dataPath || 'unknown'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: 'Could not fetch detailed stats'
    });
  }
});

// Stats endpoint for dashboard  
app.get('/api/stats', requireDatabase, auth, async (req, res) => {
  try {
    // Get today's records and products
    const todayRecords = await fileDatabase.getTodayRecords();
    const products = await fileDatabase.getProducts();
    const users = await fileDatabase.getUsers();
    
    // Calculate basic statistics
    const totalProducts = products.filter(p => p.isActive).length;
    const todayRecordsCount = todayRecords.length;
    const todayIncome = todayRecords.reduce((sum, record) => sum + record.total, 0);
    const totalUsers = users.filter(u => u.isActive).length;
    
    res.json({
      totalProducts,
      todayRecords: todayRecordsCount,
      todayIncome: Math.round(todayIncome * 100) / 100,
      totalUsers
    });
  } catch (error) {
    console.error('Stats endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      totalProducts: 0,
      todayRecords: 0,
      todayIncome: 0,
      totalUsers: 0
    });
  }
});

// Sync endpoint for frontend data synchronization
app.get('/api/sync', requireDatabase, auth, async (req, res) => {
  try {
    // Get all data for frontend synchronization
    const products = await fileDatabase.getProducts();
    const records = await fileDatabase.getTodayRecords();
    const users = await fileDatabase.getUsers();
    
    res.json({
      products: products.filter(p => p.isActive),
      records,
      reports: [], // Add reports if needed
      lastSync: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({
      error: 'Failed to sync data',
      products: [],
      records: [],
      reports: []
    });
  }
});

// Initialize sample data endpoint
app.post('/api/init-data', requireDatabase, auth, async (req, res) => {
  try {
    // Check if products already exist
    const products = await fileDatabase.getProducts();
    if (products.length > 0) {
      return res.json({
        message: 'Sample data already exists',
        products: products.filter(p => p.isActive)
      });
    }
    
    // Initialize with default products (they should already be created by fileDatabase.initialize)
    await fileDatabase.initialize();
    const newProducts = await fileDatabase.getProducts();
    
    res.json({
      message: 'Sample data initialized successfully',
      products: newProducts.filter(p => p.isActive)
    });
  } catch (error) {
    console.error('Init data error:', error);
    res.status(500).json({
      error: 'Failed to initialize sample data'
    });
  }
});

// Database setup endpoint
app.post('/api/setup', requireDatabase, async (req, res) => {
  try {
    const SetupService = require('./setup');
    const setupService = new SetupService();
    
    const result = await setupService.setupDatabase();
    
    res.json({
      success: true,
      message: 'Database setup completed successfully',
      ...result
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve HTML files
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'index.html'));
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Error loading homepage');
  }
});

app.get('/online', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'conejo_negro_online.html'));
  } catch (error) {
    console.error('Error serving online.html:', error);
    res.status(500).send('Error loading online version');
  }
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : error.message,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  
  try {
    // File database doesn't need explicit connection closing
    console.log('📊 File database operations stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 POS System: http://localhost:${PORT}`);
  console.log(`🌐 Online Version: http://localhost:${PORT}/online`);
});

module.exports = app;
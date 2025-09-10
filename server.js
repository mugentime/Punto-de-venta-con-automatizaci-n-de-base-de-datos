const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
// RAILWAY ENVIRONMENT DETECTION
if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('🚀 Railway environment detected');
    console.log('📊 DATABASE_URL present:', !!process.env.DATABASE_URL);
    if (process.env.DATABASE_URL) {
        console.log('🔗 Using PostgreSQL from Railway');
    } else {
        console.log('⚠️ DATABASE_URL missing in Railway environment!');
    }
} else {
    console.log('🏠 Local development environment');
}

// FORCE REDEPLOY: 2025-09-03T15:20:01.476Z - Ensure DATABASE_URL is loaded

// 🚨 COMMENTED OUT: Force PostgreSQL for Railway deployment
// This was causing issues with local development using file-based system
console.log('🔍 Checking DATABASE_URL...', !!process.env.DATABASE_URL);
// if (!process.env.DATABASE_URL && (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production')) {
//     console.log('🚨 FORCING DATABASE_URL for Railway...');
//     process.env.DATABASE_URL = 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway';
//     console.log('✅ DATABASE_URL set for Railway deployment');
// }


// FIXED: Import consistent file-based routes for working authentication
const authRoutes = require('./routes/auth-file');
const productRoutes = require('./routes/products-file');
const recordRoutes = require('./routes/records-file'); // FIXED: Use file-based records routes
const backupRoutes = require('./routes/backup');
// File-based routes for features not yet migrated to PostgreSQL
const cashCutRoutes = require('./routes/cashcuts-file');
const membershipRoutes = require('./routes/memberships-file');
const sessionRoutes = require('./routes/sessions-file');
const customerRoutes = require('./routes/customers-file');
const expenseRoutes = require('./routes/expenses-file');

// FIXED: Import consistent file-based auth middleware
const { auth } = require('./middleware/auth-file');

// Import services
const cloudStorageService = require('./utils/cloudStorage');
const databaseManager = require('./utils/databaseManager');

// Import scheduled tasks
require('./utils/scheduler');
// Initialize unified cash cut service
const cashCutModule = require('./src/modules/cashcut');
require('./utils/membershipNotificationService');

const app = express();

// CRITICAL FIX: Optimized Security middleware to prevent infinite loops
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

// FIXED: CORS configuration to prevent preflight loops
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://pos-conejonegro-production.onrender.com',
        process.env.RENDER_EXTERNAL_URL || null
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200, // Fix for legacy browser CORS issues
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// FIXED: Rate limiting with skip for health checks to prevent deployment loops
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // Increased for deployment
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for health checks and emergency endpoints
    return req.path === '/api/health' || 
           req.path === '/api/emergency-test' ||
           req.path.startsWith('/api/auth/login');
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Correlation ID middleware for request tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize file-based database
let isDatabaseReady = false;

// Initialize database on startup (PostgreSQL or File-based)
(async () => {
  try {
    await databaseManager.initialize();
    isDatabaseReady = true;
    
    if (process.env.DATABASE_URL) {
      console.log('✅ PostgreSQL database ready - Data will persist across deployments!');
    } else {
      console.log('✅ File-based database ready - Data may be lost on deployment');
      console.log('⚠️  Add PostgreSQL database in Render for persistent storage');
    }
    
    // 🧠 HIVE MIND AUTO-REPAIR: Create admin user if missing
    try {
      const users = await databaseManager.getUsers();
      const adminExists = users.find(user => user.email === 'admin@conejonegro.com');
      
      if (!adminExists) {
        console.log('🔧 HIVE MIND: Creating missing admin user for production...');
        
        const adminUser = await databaseManager.createUser({
          name: 'Administrator',
          email: 'admin@conejonegro.com',
          password: 'admin123',
          role: 'admin'
        });
        
        console.log('✅ HIVE MIND: Admin user created successfully!');
        console.log('   Email: admin@conejonegro.com');
        console.log('   Password: admin123');
      } else {
        console.log('✅ Admin user already exists - login should work');
      }
    } catch (error) {
      console.error('⚠️ HIVE MIND: Admin user setup failed:', error.message);
    }
    
    // Initialize cash cut service after database is ready
    try {
      await cashCutModule.init({
        db: databaseManager,
        settings: {
          cron: process.env.CASHCUT_CRON || '0 0,12 * * *', // Every 12 hours by default
          timezone: process.env.TZ || 'America/Mexico_City'
        }
      });
      console.log('✅ Cash cut service initialized with 12-hour automatic schedule');
    } catch (error) {
      console.error('⚠️ Cash cut service initialization failed:', error.message);
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
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

// EMERGENCY TEST - NO MIDDLEWARE
app.get('/api/emergency-test', (req, res) => {
  res.json({ 
    message: 'EMERGENCY TEST WORKING',
    timestamp: new Date().toISOString(),
    render_deployed: !!process.env.RENDER,
    environment: process.env.NODE_ENV || 'development'
  });
});

// EMERGENCY HISTORICAL ENDPOINT - DIRECT IN SERVER.JS
app.post('/api/records/historical', requireDatabase, async (req, res) => {
  console.log('🔥 HISTORICAL ENDPOINT HIT DIRECTLY!', req.body);
  try {
    const { 
      client, 
      service, 
      products,
      hours = 1, 
      payment, 
      tip = 0,
      historicalDate
    } = req.body;

    if (!historicalDate) {
      return res.status(400).json({
        error: 'Historical date is required for this endpoint'
      });
    }

    // Validate historical date is not in the future
    const targetDate = new Date(historicalDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (targetDate > today) {
      return res.status(400).json({
        error: 'Historical date cannot be in the future'
      });
    }

    if (!client || !service || !products || !payment) {
      return res.status(400).json({
        error: 'Missing required fields: client, service, products, payment'
      });
    }

    // Create record data
    const recordData = {
      client,
      service: service.toLowerCase(),
      products,
      hours: parseInt(hours),
      payment: payment.toLowerCase(),
      tip: parseFloat(tip) || 0,
      date: targetDate,
      total: products.reduce((sum, p) => sum + (p.price * p.quantity), 0) + (parseFloat(tip) || 0)
    };

    console.log('📝 Creating historical record:', recordData);

    // Save using database manager
    const newRecord = await databaseManager.createRecord(recordData);
    console.log('✅ Historical record created:', newRecord.id);

    res.status(201).json({
      message: 'Historical record created successfully',
      record: newRecord
    });

  } catch (error) {
    console.error('❌ Historical endpoint error:', error);
    res.status(500).json({
      error: 'Failed to create historical record',
      message: error.message
    });
  }
});

// Routes (with database requirement)
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/products', requireDatabase, productRoutes);
app.use('/api/records', requireDatabase, recordRoutes); // Includes /historical endpoint
app.use('/api/cashcuts', requireDatabase, cashCutRoutes);
app.use('/api/memberships', requireDatabase, membershipRoutes);
app.use('/api/sessions', requireDatabase, sessionRoutes);
app.use('/api/customers', requireDatabase, customerRoutes);
app.use('/api/expenses', requireDatabase, expenseRoutes);
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
        path: process.env.DATABASE_URL ? 'postgresql' : 'file-based'
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
    const todayRecords = await databaseManager.getRecords(); // Get all records for now
    const products = await databaseManager.getProducts();
    const users = await databaseManager.getUsers();
    
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
    const products = await databaseManager.getProducts();
    const records = await databaseManager.getRecords();
    const users = await databaseManager.getUsers();
    
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

// Sample data initialization endpoint disabled to prevent data loss
// Use proper database management tools instead

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

app.get('/coworking', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'coworking.html'));
  } catch (error) {
    console.error('Error serving coworking.html:', error);
    res.status(500).send('Error loading coworking page');
  }
});

app.get('/clientes', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'clientes.html'));
  } catch (error) {
    console.error('Error serving clientes.html:', error);
    res.status(500).send('Error loading clientes page');
  }
});

app.get('/analytics-clientes', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'analytics-clientes.html'));
  } catch (error) {
    console.error('Error serving analytics-clientes.html:', error);
    res.status(500).send('Error loading analytics clientes page');
  }
});

app.get('/demo-busqueda-clientes', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'demo-busqueda-clientes.html'));
  } catch (error) {
    console.error('Error serving demo-busqueda-clientes.html:', error);
    res.status(500).send('Error loading demo search clientes page');
  }
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Enhanced error handling middleware with correlation ID
app.use((error, req, res, next) => {
  const correlationId = req.id || 'unknown';
  console.error(`[${correlationId}] Server Error:`, error);
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : error.message,
    timestamp: new Date().toISOString(),
    correlationId
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
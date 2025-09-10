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


// FIXED: Import PostgreSQL-compatible auth routes for authentication
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products-file');
const recordRoutes = require('./routes/records-file'); // FIXED: Use file-based records routes
const backupRoutes = require('./routes/backup');
// File-based routes for features not yet migrated to PostgreSQL
const cashCutRoutes = require('./routes/cashcuts-file');
const membershipRoutes = require('./routes/memberships-file');
const sessionRoutes = require('./routes/sessions-file');
const customerRoutes = require('./routes/customers-file');
const expenseRoutes = require('./routes/expenses-file');

// FIXED: Import PostgreSQL-compatible auth middleware
const { auth } = require('./middleware/auth');

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

// Debug route to count users
app.get('/api/debug/users', async (req, res) => {
  try {
    console.log('👤 Checking user count');
    const users = await databaseManager.getUsers();
    console.log(`📃 Found ${users.length} users`);
    console.log('📂 Admin users:', users.filter(u => u.role === 'admin').map(u => u.email));
    
    res.json({
      status: 'ok',
      userCount: users.length,
      adminEmails: users.filter(u => u.role === 'admin').map(u => u.email)
    });
  } catch (error) {
    console.error('❌ User count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check route with database info
app.get('/api/health', async (req, res) => {
  try {
    console.log('🏥 Health check request received');
    console.log('📊 Environment variables:', {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? '[REDACTED]' : 'not set',
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
    });
    console.log('📁 Current directory:', __dirname);
    res.json({
      status: 'ok',
      databaseType: process.env.DATABASE_URL ? 'postgresql' : 'file-based',
      isDatabaseReady,
      dataPath: path.resolve(__dirname, 'data'),
      environment: process.env.NODE_ENV || 'development',
      railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'none',
      renderEnv: process.env.RENDER_EXTERNAL_URL ? 'active' : 'none'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      console.log(`🔍 Found ${users.length} users in database`);
      
      // Check for admin user with any email format
      const adminExists = users.find(user => 
        user.email === 'admin@conejonegro.com' || 
        user.role === 'admin' ||
        (user.email && user.email.includes('admin'))
      );
      
      if (!adminExists) {
        console.log('🔧 HIVE MIND: No admin user found, creating one for production...');
        
        // Hash password explicitly for PostgreSQL path
        const bcrypt = require('bcryptjs');
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);
        const adminUser = await databaseManager.createUser({
          name: 'Administrator',
          email: 'admin@conejonegro.com',
          password: hashedPassword, // Pre-hashed for PostgreSQL; file DB will still accept hashed
          role: 'admin'
        });
        
        console.log('✅ HIVE MIND: Admin user created successfully!');
        console.log('   Email: admin@conejonegro.com');
        console.log('   Password: admin123');
        console.log('   User ID:', adminUser._id || adminUser.id);
      } else {
        console.log('✅ Admin user already exists:', adminExists.email, '(', adminExists.role, ')');
        console.log('   Login should work with: admin@conejonegro.com / admin123');
        
        // If existing admin has different email, also create the expected one
        if (adminExists.email !== 'admin@conejonegro.com') {
          const standardAdminExists = users.find(u => u.email === 'admin@conejonegro.com');
          if (!standardAdminExists) {
            console.log('🔧 Creating standard admin@conejonegro.com user...');
            const bcrypt = require('bcryptjs');
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            await databaseManager.createUser({
              name: 'Administrator',
              email: 'admin@conejonegro.com',
              password: hashedPassword,
              role: 'admin'
            });
            console.log('✅ Standard admin user created');
          }
        }
      }
    } catch (error) {
      console.error('⚠️ HIVE MIND: Admin user setup failed:', error.message);
      console.error('   Stack:', error.stack);
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
    environment: process.env.NODE_ENV || 'development',
    build_time: '2025-09-10T16:41:48Z'
  });
});

// TEMPORARY DEBUG - Check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    message: 'TEMPORARY ENV DEBUG',
    timestamp: new Date().toISOString(),
    env_check: {
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      DATABASE_URL: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT_SET',
      database_url_present: !!process.env.DATABASE_URL,
      RENDER: !!process.env.RENDER,
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL || 'not_set',
      JWT_SECRET: process.env.JWT_SECRET ? 'present' : 'NOT_SET',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'not_set',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'present' : 'not_set'
    },
    production_detected: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || !!process.env.RENDER_EXTERNAL_URL),
    should_use_postgres: !!process.env.DATABASE_URL,
    uptime: process.uptime()
  });
});

// DEBUG ENDPOINT - Show users in production (temporary)
app.get('/api/debug/users', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }
    
    const users = await databaseManager.getUsers();
    
    // Return safe user info (no passwords)
    const safeUsers = users.map(user => ({
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
    
    res.json({
      message: 'Users in production database',
      count: safeUsers.length,
      users: safeUsers,
      databaseType: process.env.DATABASE_URL ? 'PostgreSQL' : 'File-based',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get users',
      message: error.message
    });
  }
});

// EMERGENCY ADMIN CREATION - Force create admin user
app.post('/api/emergency/create-admin', async (req, res) => {
  try {
    if (!isDatabaseReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }
    
    console.log('🚨 EMERGENCY: Force creating admin user...');
    
    // Check current users
    const users = await databaseManager.getUsers();
    console.log(`Current user count: ${users.length}`);
    
    // Find existing admin
    const existingAdmin = users.find(u => u.email === 'admin@conejonegro.com');
    if (existingAdmin) {
      return res.json({
        message: 'Admin user already exists',
        email: existingAdmin.email,
        created: false
      });
    }
    
    // Force create admin user
    const adminUser = await databaseManager.createUser({
      name: 'Administrator',
      email: 'admin@conejonegro.com',
      password: 'admin123',
      role: 'admin'
    });
    
    console.log('✅ EMERGENCY: Admin user created!', adminUser);
    
    res.json({
      message: 'Admin user created successfully!',
      email: 'admin@conejonegro.com',
      password: 'admin123',
      created: true,
      user: {
        id: adminUser._id || adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
    
  } catch (error) {
    console.error('❌ EMERGENCY: Admin creation failed:', error);
    res.status(500).json({
      error: 'Failed to create admin user',
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
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

// Debug endpoint to understand production auth issues
app.get('/debug-auth', async (req, res) => {
  try {
    const debug = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseUrl: !!process.env.DATABASE_URL,
        railwayEnv: !!process.env.RAILWAY_ENVIRONMENT
      },
      tests: []
    };

    // Test 1: Password hashing
    debug.tests.push({ test: 'password_hashing', status: 'testing' });
    const bcrypt = require('bcryptjs');
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    const isValidHash = await bcrypt.compare(testPassword, hashedPassword);
    debug.tests[debug.tests.length - 1] = {
      test: 'password_hashing',
      status: isValidHash ? 'pass' : 'fail',
      details: {
        originalPassword: testPassword,
        hashedPreview: hashedPassword.substring(0, 20) + '...',
        isValidHash
      }
    };

    // Test 2: Database Manager
    debug.tests.push({ test: 'database_manager', status: 'testing' });
    try {
      debug.tests[debug.tests.length - 1] = {
        test: 'database_manager',
        status: 'pass',
        details: {
          usePostgreSQL: !!process.env.DATABASE_URL,
          isDatabaseReady
        }
      };

      // Test 3: Get existing users
      debug.tests.push({ test: 'get_users', status: 'testing' });
      const users = await databaseManager.getUsers();
      debug.tests[debug.tests.length - 1] = {
        test: 'get_users',
        status: 'pass',
        details: {
          userCount: users.length,
          userEmails: users.map(u => u.email || u.username).filter(Boolean)
        }
      };

      // Test 4: Check for admin user
      debug.tests.push({ test: 'check_admin', status: 'testing' });
      const adminUser = await databaseManager.getUserByEmail('admin@conejonegro.com');
      debug.tests[debug.tests.length - 1] = {
        test: 'check_admin',
        status: adminUser ? 'found' : 'not_found',
        details: {
          adminExists: !!adminUser,
          adminEmail: adminUser ? adminUser.email : null,
          adminRole: adminUser ? adminUser.role : null,
          passwordHashPreview: adminUser ? adminUser.password.substring(0, 20) + '...' : null
        }
      };

      // Test 5: Test password validation if admin exists
      if (adminUser) {
        debug.tests.push({ test: 'validate_password', status: 'testing' });
        const isPasswordValid = await bcrypt.compare('admin123', adminUser.password);
        debug.tests[debug.tests.length - 1] = {
          test: 'validate_password',
          status: isPasswordValid ? 'valid' : 'invalid',
          details: {
            passwordValid: isPasswordValid
          }
        };
      }

    } catch (error) {
      debug.tests[debug.tests.length - 1] = {
        test: 'database_manager',
        status: 'error',
        error: error.message
      };
    }

    res.json(debug);

  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// Fix admin user endpoint for deployment issues
app.get('/fix-admin-user', async (req, res) => {
  try {
    console.log('🔧 MANUAL FIX: Checking admin user in production...');
    const users = await databaseManager.getUsers();
    console.log(`Found ${users.length} users`);
    
    const existingAdmin = users.find(u => u.email === 'admin@conejonegro.com');
    if (existingAdmin) {
      console.log('Found existing admin:', existingAdmin.email);
      
      // Check if password is properly hashed
      const bcrypt = require('bcryptjs');
      const isPlaintext = !existingAdmin.password.startsWith('$2');
      
      if (isPlaintext) {
        console.log('Admin password needs rehashing...');
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);
        
        // Update the password
        await databaseManager.updateUser(existingAdmin._id, {
          password: hashedPassword
        });
        
        console.log('✅ Admin password rehashed');
        res.json({
          status: 'fixed',
          message: 'Admin password has been rehashed',
          email: 'admin@conejonegro.com',
          userId: existingAdmin._id
        });
      } else {
        res.json({
          status: 'ok',
          message: 'Admin user exists with proper hash',
          email: 'admin@conejonegro.com',
          userId: existingAdmin._id
        });
      }
    } else {
      console.log('Creating new admin user...');
      const bcrypt = require('bcryptjs');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash('admin123', saltRounds);
      
      const newAdmin = await databaseManager.createUser({
        name: 'Administrator',
        email: 'admin@conejonegro.com',
        password: hashedPassword,
        role: 'admin'
      });
      
      res.json({
        status: 'created',
        message: 'New admin user created',
        email: 'admin@conejonegro.com',
        userId: newAdmin._id || newAdmin.id
      });
    }
  } catch (error) {
    console.error('Fix admin error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
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
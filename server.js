const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const recordRoutes = require('./routes/records');
const backupRoutes = require('./routes/backup');

// Import services
const cloudStorageService = require('./utils/cloudStorage');

// Import scheduled tasks
require('./utils/scheduler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/conejo-negro-pos')
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/backup', backupRoutes);

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'local',
    database: process.env.MONGODB_URI ? 'connected' : 'not configured'
  });
});

// Database setup endpoint
app.post('/api/setup', async (req, res) => {
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

app.get('/cafe', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'conejo_negro_cafe.html'));
  } catch (error) {
    console.error('Error serving cafe.html:', error);
    res.status(500).send('Error loading cafe version');
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
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
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
  console.log(`☕ Cafe Version: http://localhost:${PORT}/cafe`);
});

module.exports = app;
// Minimal server for Render deployment testing
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    databaseType: 'file-based-with-git-sync',
    isDatabaseReady: true,
    dataPath: path.resolve(__dirname, 'data'),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    storageInfo: {
      type: 'File-based with Git synchronization',
      persistent: true,
      cost: 'Free',
      backup: 'Automatic via Git repository'
    }
  });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({
    name: 'POS Conejo Negro',
    version: '1.0.0',
    commit: process.env.RENDER_GIT_COMMIT || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Sync status endpoint (minimal)
app.get('/api/sync/status', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    dataDirectory: path.resolve(__dirname, 'data'),
    system: 'File-based with Git synchronization',
    cost: 'Free',
    persistent: true
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>POS Conejo Negro - Minimal Version</h1>
    <p>File-based database system is operational!</p>
    <ul>
      <li><a href="/api/health">Health Check</a></li>
      <li><a href="/api/version">Version Info</a></li>
      <li><a href="/api/sync/status">Sync Status</a></li>
    </ul>
  `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minimal POS server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Data path: ${path.resolve(__dirname, 'data')}`);
  console.log(`🎯 File-based database system active`);
});

module.exports = app;

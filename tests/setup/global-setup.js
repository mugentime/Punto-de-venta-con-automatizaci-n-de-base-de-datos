const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // Create test directories if they don't exist
  const testDirs = [
    './tests/results',
    './tests/auth',
    './tests/reports',
    './tests/screenshots'
  ];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }

  console.log('✅ Global setup completed');
}

module.exports = globalSetup;

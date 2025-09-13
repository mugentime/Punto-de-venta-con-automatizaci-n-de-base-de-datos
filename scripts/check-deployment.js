const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function checkDeployment() {
  console.log('🔍 Railway Deployment Analysis');
  console.log('Deployment ID: 4548f92b-d5dd-49ff-8840-3768b72daec3');
  console.log('=' .repeat(50));

  // Check local configuration files
  console.log('\n📋 Checking local configuration:');
  
  // Check railway.json
  const railwayJsonPath = 'railway.json';
  if (fs.existsSync(railwayJsonPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));
      console.log('✅ railway.json: Valid JSON');
      console.log(`   Builder: ${config.build?.builder}`);
      console.log(`   Start command: ${config.deploy?.startCommand}`);
      console.log(`   Health check: ${config.healthcheck?.enabled ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.log('❌ railway.json: Invalid JSON');
      console.log(`   Error: ${error.message}`);
    }
  } else {
    console.log('❌ railway.json: Not found');
  }

  // Check Dockerfile
  if (fs.existsSync('Dockerfile')) {
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    console.log('✅ Dockerfile: Exists');
    console.log(`   Has EXPOSE: ${dockerfile.includes('EXPOSE') ? 'Yes' : 'No'}`);
    console.log(`   Has CMD: ${dockerfile.includes('CMD') ? 'Yes' : 'No'}`);
    
    // Check if port is properly configured
    const hasPortBinding = dockerfile.includes('$PORT') || dockerfile.includes('${PORT}') || dockerfile.includes('process.env.PORT');
    console.log(`   Port binding: ${hasPortBinding ? 'Configured' : 'Missing'}`);
  } else {
    console.log('❌ Dockerfile: Not found');
  }

  // Check package.json
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('✅ package.json: Exists');
    console.log(`   Start script: ${pkg.scripts?.start || 'Not defined'}`);
    console.log(`   Main entry: ${pkg.main || 'Not specified'}`);
    console.log(`   Node version: ${pkg.engines?.node || 'Not specified'}`);
  }

  // Check server.js
  if (fs.existsSync('server.js')) {
    const server = fs.readFileSync('server.js', 'utf8');
    console.log('✅ server.js: Exists');
    
    const hasPortConfig = server.includes('process.env.PORT') || server.includes('PORT');
    console.log(`   Port configuration: ${hasPortConfig ? 'Found' : 'Missing'}`);
    
    const hasHealthEndpoint = server.includes('/api/health');
    console.log(`   Health endpoint: ${hasHealthEndpoint ? 'Found' : 'Missing'}`);
  }

  console.log('\n🔍 Common deployment issues to check:');
  console.log('1. ❓ Port binding: App must listen on process.env.PORT');
  console.log('2. ❓ Health checks: /api/health endpoint must exist and return 200');
  console.log('3. ❓ Dependencies: All packages in package.json must be installable');
  console.log('4. ❓ File permissions: Container user must have access to files');
  console.log('5. ❓ Environment variables: Required env vars must be set');

  console.log('\n💡 Quick fixes to try:');
  console.log('1. 🔧 Ensure server.js listens on: process.env.PORT || 3000');
  console.log('2. 🔧 Add health endpoint that returns { status: "healthy" }');
  console.log('3. 🔧 Check that npm start command works locally');
  console.log('4. 🔧 Verify all files are committed to git');
  console.log('5. 🔧 Test Docker build locally: docker build -t test .');

  // Try to get basic Railway status
  try {
    console.log('\n📊 Attempting to get Railway status...');
    const { stdout } = await execAsync('railway --version', { timeout: 5000 });
    console.log(`✅ Railway CLI available: ${stdout.trim()}`);
    
    // If Railway CLI is available, try to get logs (but don't fail if token is missing)
    try {
      const { stdout: statusOut } = await execAsync('railway status', { timeout: 10000 });
      console.log('\n📋 Railway Status:');
      console.log(statusOut);
    } catch (statusError) {
      console.log('⚠️ Railway status not available (need to login)');
    }
    
  } catch (error) {
    console.log('⚠️ Railway CLI not available or not configured');
  }

  return {
    railwayJson: fs.existsSync('railway.json'),
    dockerfile: fs.existsSync('Dockerfile'),
    packageJson: fs.existsSync('package.json'),
    serverJs: fs.existsSync('server.js'),
    deploymentId: '4548f92b-d5dd-49ff-8840-3768b72daec3'
  };
}

if (require.main === module) {
  checkDeployment().catch(console.error);
}

module.exports = { checkDeployment };
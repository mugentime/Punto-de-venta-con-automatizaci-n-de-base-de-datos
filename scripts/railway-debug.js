const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

class RailwayDebugger {
  constructor(deploymentId, token) {
    this.deploymentId = deploymentId;
    this.token = token;
    this.serviceName = 'pos-conejo-negro';
  }

  async checkRailwayConfig() {
    console.log('🔍 Checking Railway Configuration...');
    
    // Check if railway.json exists and is valid
    const railwayJsonPath = path.join(process.cwd(), 'railway.json');
    if (fs.existsSync(railwayJsonPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));
        console.log('✅ railway.json exists and is valid JSON');
        console.log('📋 Configuration:');
        console.log(`   Builder: ${config.build?.builder || 'Not specified'}`);
        console.log(`   Start command: ${config.deploy?.startCommand || 'Not specified'}`);
        console.log(`   Health check: ${config.healthcheck?.enabled ? 'Enabled' : 'Disabled'}`);
        console.log(`   Health path: ${config.healthcheck?.path || 'Not specified'}`);
      } catch (error) {
        console.log('❌ railway.json exists but contains invalid JSON');
        console.log(`   Error: ${error.message}`);
        return false;
      }
    } else {
      console.log('❌ railway.json not found');
      return false;
    }

    // Check Dockerfile
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
      console.log('✅ Dockerfile exists');
      console.log('📋 Dockerfile analysis:');
      console.log(`   Has EXPOSE: ${dockerfile.includes('EXPOSE') ? 'Yes' : 'No'}`);
      console.log(`   Has CMD/ENTRYPOINT: ${dockerfile.includes('CMD') || dockerfile.includes('ENTRYPOINT') ? 'Yes' : 'No'}`);
      console.log(`   Base image: ${dockerfile.match(/FROM\s+(\S+)/)?.[1] || 'Not found'}`);
    } else {
      console.log('❌ Dockerfile not found');
      return false;
    }

    // Check package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log('✅ package.json exists');
      console.log('📋 Package.json analysis:');
      console.log(`   Start script: ${packageJson.scripts?.start || 'Not defined'}`);
      console.log(`   Main file: ${packageJson.main || 'Not specified'}`);
      console.log(`   Node engine: ${packageJson.engines?.node || 'Not specified'}`);
    }

    return true;
  }

  async getDeploymentLogs() {
    console.log(`🔍 Fetching Railway deployment logs for: ${this.deploymentId}`);
    
    try {
      // Set Railway token as environment variable
      process.env.RAILWAY_TOKEN = this.token;
      
      // Try to get deployment logs
      const { stdout, stderr } = await execAsync(`railway logs --deployment-id ${this.deploymentId}`, {
        timeout: 30000
      });
      
      if (stdout) {
        console.log('📋 Deployment Logs:');
        console.log('=' .repeat(50));
        console.log(stdout);
        console.log('=' .repeat(50));
        
        // Save logs to file
        fs.writeFileSync('railway-deployment-logs.txt', stdout);
        console.log('💾 Logs saved to: railway-deployment-logs.txt');
      }
      
      if (stderr) {
        console.log('⚠️ Error output:');
        console.log(stderr);
      }
      
      return { stdout, stderr };
      
    } catch (error) {
      console.log(`❌ Failed to get deployment logs: ${error.message}`);
      
      // Try alternative approach - get service logs
      try {
        console.log('🔄 Trying alternative: getting service logs...');
        const { stdout: serviceStdout } = await execAsync('railway logs --tail 100', {
          timeout: 30000
        });
        
        if (serviceStdout) {
          console.log('📋 Service Logs (last 100 lines):');
          console.log('=' .repeat(50));
          console.log(serviceStdout);
          console.log('=' .repeat(50));
          
          fs.writeFileSync('railway-service-logs.txt', serviceStdout);
          console.log('💾 Service logs saved to: railway-service-logs.txt');
        }
        
        return { stdout: serviceStdout, stderr: '' };
        
      } catch (serviceError) {
        console.log(`❌ Also failed to get service logs: ${serviceError.message}`);
        return null;
      }
    }
  }

  async getDeploymentStatus() {
    console.log('📊 Getting Railway deployment status...');
    
    try {
      process.env.RAILWAY_TOKEN = this.token;
      
      const { stdout } = await execAsync('railway status', { timeout: 15000 });
      
      console.log('📋 Railway Status:');
      console.log('=' .repeat(50));
      console.log(stdout);
      console.log('=' .repeat(50));
      
      return stdout;
      
    } catch (error) {
      console.log(`❌ Failed to get status: ${error.message}`);
      return null;
    }
  }

  async diagnoseCommonIssues(logs) {
    console.log('🔍 Diagnosing common deployment issues...');
    
    const issues = [];
    
    if (!logs) {
      issues.push('❌ Could not retrieve logs for analysis');
      return issues;
    }
    
    const logText = logs.stdout || '';
    
    // Check for common issues
    if (logText.includes('npm ERR!') || logText.includes('Error:')) {
      issues.push('❌ NPM/Node.js errors detected in build');
    }
    
    if (logText.includes('ENOENT') || logText.includes('No such file')) {
      issues.push('❌ Missing files or dependencies');
    }
    
    if (logText.includes('Permission denied') || logText.includes('EACCES')) {
      issues.push('❌ Permission issues');
    }
    
    if (logText.includes('Port') && logText.includes('already in use')) {
      issues.push('❌ Port binding issues');
    }
    
    if (logText.includes('syntax error') || logText.includes('SyntaxError')) {
      issues.push('❌ JavaScript syntax errors');
    }
    
    if (logText.includes('Cannot find module') || logText.includes('MODULE_NOT_FOUND')) {
      issues.push('❌ Missing Node.js modules');
    }
    
    if (logText.includes('Docker') && logText.includes('failed')) {
      issues.push('❌ Docker build failures');
    }
    
    if (logText.includes('DATABASE_URL') || logText.includes('database')) {
      issues.push('⚠️ Database connection issues may be present');
    }
    
    if (logText.includes('health') && logText.includes('failed')) {
      issues.push('⚠️ Health check failures');
    }
    
    if (issues.length === 0) {
      issues.push('✅ No obvious issues detected in logs');
    }
    
    return issues;
  }

  async suggestFixes(issues) {
    console.log('💡 Suggested fixes based on analysis:');
    
    const fixes = [];
    
    issues.forEach(issue => {
      if (issue.includes('NPM/Node.js errors')) {
        fixes.push('🔧 Check package.json dependencies and ensure all packages are compatible');
        fixes.push('🔧 Try clearing npm cache: npm cache clean --force');
      }
      
      if (issue.includes('Missing files')) {
        fixes.push('🔧 Ensure all required files are committed to Git');
        fixes.push('🔧 Check .gitignore to make sure important files are not excluded');
      }
      
      if (issue.includes('Permission issues')) {
        fixes.push('🔧 Review Dockerfile user permissions');
        fixes.push('🔧 Ensure files have correct permissions in container');
      }
      
      if (issue.includes('Port binding')) {
        fixes.push('🔧 Ensure app listens on process.env.PORT');
        fixes.push('🔧 Check that PORT environment variable is properly configured');
      }
      
      if (issue.includes('syntax errors')) {
        fixes.push('🔧 Run local syntax checking: npm run lint');
        fixes.push('🔧 Test application locally before deployment');
      }
      
      if (issue.includes('Missing Node.js modules')) {
        fixes.push('🔧 Check package.json dependencies are complete');
        fixes.push('🔧 Ensure package-lock.json is committed');
      }
      
      if (issue.includes('Docker build failures')) {
        fixes.push('🔧 Test Dockerfile build locally: docker build -t test .');
        fixes.push('🔧 Check Dockerfile syntax and commands');
      }
      
      if (issue.includes('Database connection')) {
        fixes.push('🔧 Verify DATABASE_URL environment variable is set');
        fixes.push('🔧 Check database connection string format');
      }
      
      if (issue.includes('Health check failures')) {
        fixes.push('🔧 Ensure /api/health endpoint exists and returns 200');
        fixes.push('🔧 Check health check configuration in railway.json');
      }
    });
    
    if (fixes.length === 0) {
      fixes.push('✅ Configuration appears correct - deployment may need more time');
      fixes.push('🔧 Consider checking Railway dashboard for additional details');
    }
    
    return fixes;
  }

  async createFixedDockerfile() {
    console.log('🔧 Creating optimized Dockerfile...');
    
    const dockerfile = `# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodeuser -u 1001

# Change ownership of app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE \$PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD node -e "const http=require('http'); http.get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start application
CMD ["npm", "start"]
`;

    fs.writeFileSync('Dockerfile.optimized', dockerfile);
    console.log('✅ Optimized Dockerfile created: Dockerfile.optimized');
    console.log('💡 You can replace the current Dockerfile with this optimized version');
  }

  async runDiagnosis() {
    console.log('🚀 Starting Railway Deployment Diagnosis');
    console.log(`🎯 Deployment ID: ${this.deploymentId}`);
    console.log('=' .repeat(60));
    
    // Step 1: Check local configuration
    const configOK = await this.checkRailwayConfig();
    
    // Step 2: Get deployment status
    await this.getDeploymentStatus();
    
    // Step 3: Get logs
    const logs = await this.getDeploymentLogs();
    
    // Step 4: Diagnose issues
    const issues = await this.diagnoseCommonIssues(logs);
    console.log('\n🚨 Issues found:');
    issues.forEach(issue => console.log(`   ${issue}`));
    
    // Step 5: Suggest fixes
    const fixes = await this.suggestFixes(issues);
    console.log('\n💡 Suggested fixes:');
    fixes.forEach(fix => console.log(`   ${fix}`));
    
    // Step 6: Create optimized Dockerfile
    await this.createFixedDockerfile();
    
    // Step 7: Generate report
    const report = {
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
      configurationStatus: configOK,
      issues,
      fixes,
      logs: logs ? 'Retrieved' : 'Failed to retrieve'
    };
    
    fs.writeFileSync('railway-debug-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Debug report saved: railway-debug-report.json');
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('=' .repeat(60));
    
    return report;
  }
}

// Run diagnosis if called directly
if (require.main === module) {
  const deploymentId = process.argv[2] || '4548f92b-d5dd-49ff-8840-3768b72daec3';
  const token = process.argv[3];
  
  if (!token) {
    console.log('❌ Railway token is required');
    console.log('Usage: node railway-debug.js <deploymentId> <token>');
    process.exit(1);
  }
  
  const railwayDebugger = new RailwayDebugger(deploymentId, token);
  railwayDebugger.runDiagnosis().catch(console.error);
}

module.exports = { RailwayDebugger };
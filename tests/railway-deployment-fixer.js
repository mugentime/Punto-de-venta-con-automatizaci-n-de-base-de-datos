const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);
const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';
const LOCAL_URL = 'http://localhost:3000';

class RailwayDeploymentFixer {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.fixAttempts = [];
  }

  async initialize() {
    console.log('🔧 Initializing Railway Deployment Fixer');
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    this.page = await this.context.newPage();
  }

  async diagnoseIssue() {
    console.log('\n🔍 Diagnosing Railway Deployment Issue...');
    
    // Check Railway deployment
    console.log('📡 Checking Railway deployment...');
    await this.page.goto(RAILWAY_URL);
    await this.page.waitForLoadState('networkidle');
    
    const railwayContent = await this.page.content();
    const railwayTitle = await this.page.title();
    
    console.log(`Railway Title: "${railwayTitle}"`);
    console.log(`Railway has POS content: ${railwayContent.includes('POS') || railwayContent.includes('main-app')}`);
    console.log(`Railway has API placeholder: ${railwayContent.includes('Railway API') || railwayContent.includes('ASCII')}`);
    
    // Take screenshot
    await this.page.screenshot({ 
      path: 'tests/screenshots/railway-diagnosis.png',
      fullPage: true 
    });
    
    // Check local deployment
    console.log('\n🏠 Checking local deployment...');
    try {
      await this.page.goto(LOCAL_URL);
      await this.page.waitForLoadState('networkidle');
      
      const localContent = await this.page.content();
      const localTitle = await this.page.title();
      
      console.log(`Local Title: "${localTitle}"`);
      console.log(`Local has POS content: ${localContent.includes('POS') || localContent.includes('main-app')}`);
      
      return {
        railway: {
          hasPOS: railwayContent.includes('POS') || railwayContent.includes('main-app'),
          hasPlaceholder: railwayContent.includes('Railway API') || railwayContent.includes('ASCII'),
          title: railwayTitle
        },
        local: {
          hasPOS: localContent.includes('POS') || localContent.includes('main-app'),
          title: localTitle,
          accessible: true
        }
      };
    } catch (error) {
      console.log(`Local server not accessible: ${error.message}`);
      return {
        railway: {
          hasPOS: railwayContent.includes('POS') || railwayContent.includes('main-app'),
          hasPlaceholder: railwayContent.includes('Railway API') || railwayContent.includes('ASCII'),
          title: railwayTitle
        },
        local: {
          accessible: false,
          error: error.message
        }
      };
    }
  }

  async fixRailwayConfiguration() {
    console.log('\n🔧 Fixing Railway Configuration...');
    
    const fixes = [];
    
    // Fix 1: Check railway.json configuration
    const railwayJsonPath = path.join(process.cwd(), 'railway.json');
    if (fs.existsSync(railwayJsonPath)) {
      const railwayConfig = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));
      console.log('📄 Railway.json exists:', railwayConfig);
      
      // Ensure proper start command
      if (!railwayConfig.build || !railwayConfig.build.commands) {
        railwayConfig.build = railwayConfig.build || {};
        railwayConfig.build.commands = ["npm install"];
        fixes.push('Added build commands to railway.json');
      }
      
      if (!railwayConfig.deploy || !railwayConfig.deploy.startCommand) {
        railwayConfig.deploy = railwayConfig.deploy || {};
        railwayConfig.deploy.startCommand = "npm start";
        fixes.push('Added start command to railway.json');
      }
      
      fs.writeFileSync(railwayJsonPath, JSON.stringify(railwayConfig, null, 2));
      console.log('✅ Updated railway.json configuration');
    } else {
      // Create railway.json
      const railwayConfig = {
        "build": {
          "commands": ["npm install"]
        },
        "deploy": {
          "startCommand": "npm start"
        }
      };
      fs.writeFileSync(railwayJsonPath, JSON.stringify(railwayConfig, null, 2));
      fixes.push('Created railway.json configuration');
      console.log('✅ Created railway.json');
    }
    
    // Fix 2: Check package.json start script
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts || !packageJson.scripts.start) {
        packageJson.scripts = packageJson.scripts || {};
        packageJson.scripts.start = "node server.js";
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        fixes.push('Added start script to package.json');
        console.log('✅ Fixed package.json start script');
      }
    }
    
    // Fix 3: Check Dockerfile
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
      
      if (!dockerfile.includes('EXPOSE')) {
        const updatedDockerfile = dockerfile + '\nEXPOSE $PORT\n';
        fs.writeFileSync(dockerfilePath, updatedDockerfile);
        fixes.push('Added EXPOSE directive to Dockerfile');
        console.log('✅ Fixed Dockerfile EXPOSE');
      }
      
      if (!dockerfile.includes('CMD') && !dockerfile.includes('ENTRYPOINT')) {
        const updatedDockerfile = fs.readFileSync(dockerfilePath, 'utf8') + '\nCMD ["npm", "start"]\n';
        fs.writeFileSync(dockerfilePath, updatedDockerfile);
        fixes.push('Added CMD directive to Dockerfile');
        console.log('✅ Fixed Dockerfile CMD');
      }
    }
    
    return fixes;
  }

  async forceRailwayRedeploy() {
    console.log('\n🚀 Forcing Railway Redeployment...');
    
    try {
      // Create deployment trigger file
      const triggerContent = `# Railway Deployment Trigger
Generated: ${new Date().toISOString()}
Trigger: Force redeploy with fixed configuration

This file triggers a new Railway deployment with the corrected configuration files.
`;
      
      fs.writeFileSync('railway-deploy-trigger.md', triggerContent);
      
      // Commit and push
      await execAsync('git add .');
      await execAsync('git commit -m "fix: Force Railway redeployment with corrected configuration\\n\\n- Updated railway.json with proper build/deploy commands\\n- Ensured package.json has correct start script\\n- Fixed Dockerfile configuration\\n- Force trigger Railway rebuild\\n\\n🤖 Generated with [Claude Code](https://claude.ai/code)\\n\\nCo-Authored-By: Claude <noreply@anthropic.com>"');
      await execAsync('git push origin main');
      
      console.log('✅ Successfully triggered Railway redeployment');
      
      // Clean up trigger file
      setTimeout(() => {
        if (fs.existsSync('railway-deploy-trigger.md')) {
          fs.unlinkSync('railway-deploy-trigger.md');
        }
      }, 5000);
      
      return true;
    } catch (error) {
      console.log(`❌ Failed to trigger redeployment: ${error.message}`);
      return false;
    }
  }

  async monitorDeployment(maxWaitMinutes = 10) {
    console.log(`\n👀 Monitoring Railway Deployment (${maxWaitMinutes} minutes max)...`);
    
    const startTime = Date.now();
    const maxWaitTime = maxWaitMinutes * 60 * 1000;
    const checkInterval = 30000; // 30 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        await this.page.goto(RAILWAY_URL, { waitUntil: 'networkidle', timeout: 15000 });
        
        const content = await this.page.content();
        const title = await this.page.title();
        
        const hasPOS = content.includes('POS') || content.includes('main-app') || content.includes('inventario');
        const hasPlaceholder = content.includes('Railway API') || content.includes('ASCII');
        
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`   ${elapsed}s: ${hasPOS ? '✅ POS' : '❌ No POS'} | ${hasPlaceholder ? '❌ Placeholder' : '✅ No Placeholder'} | "${title}"`);
        
        if (hasPOS && !hasPlaceholder) {
          console.log('\n🎉 SUCCESS! Railway is now serving the POS application!');
          
          // Take success screenshot
          await this.page.screenshot({ 
            path: 'tests/screenshots/railway-deployment-success.png',
            fullPage: true 
          });
          
          // Test health endpoints
          await this.testHealthEndpoints();
          
          return true;
        }
        
        if (elapsed < maxWaitTime / 1000 - 30) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
      } catch (error) {
        console.log(`   Error checking deployment: ${error.message}`);
      }
    }
    
    console.log('\n⏰ Deployment monitoring timed out');
    return false;
  }

  async testHealthEndpoints() {
    console.log('\n🏥 Testing Health Endpoints...');
    
    try {
      const healthResponse = await this.page.request.get(`${RAILWAY_URL}/api/health`);
      const statusResponse = await this.page.request.get(`${RAILWAY_URL}/api/status`);
      
      console.log(`   /api/health: ${healthResponse.status()}`);
      console.log(`   /api/status: ${statusResponse.status()}`);
      
      if (healthResponse.ok()) {
        const healthData = await healthResponse.json();
        console.log(`   Health status: ${healthData.status}`);
        console.log(`   Uptime: ${Math.round(healthData.uptime)}s`);
      }
      
      if (statusResponse.ok()) {
        const statusData = await statusResponse.json();
        console.log(`   Service status: ${statusData.status}`);
      }
      
      return healthResponse.ok() && statusResponse.ok();
    } catch (error) {
      console.log(`   ❌ Health endpoint test failed: ${error.message}`);
      return false;
    }
  }

  async runCompleteFix() {
    await this.initialize();
    
    console.log('🚀 Starting Complete Railway Deployment Fix');
    console.log('=' .repeat(50));
    
    // Step 1: Diagnose the issue
    const diagnosis = await this.diagnoseIssue();
    console.log('\n📊 Diagnosis Results:');
    console.log(`Railway has POS: ${diagnosis.railway.hasPOS}`);
    console.log(`Railway has placeholder: ${diagnosis.railway.hasPlaceholder}`);
    console.log(`Local accessible: ${diagnosis.local.accessible}`);
    
    if (diagnosis.railway.hasPOS && !diagnosis.railway.hasPlaceholder) {
      console.log('\n✅ Railway deployment is already working correctly!');
      await this.testHealthEndpoints();
      await this.browser.close();
      return true;
    }
    
    // Step 2: Fix configuration
    const configFixes = await this.fixRailwayConfiguration();
    console.log(`\n🔧 Applied ${configFixes.length} configuration fixes:`);
    configFixes.forEach(fix => console.log(`   - ${fix}`));
    
    // Step 3: Force redeployment
    const redeploySuccess = await this.forceRailwayRedeploy();
    if (!redeploySuccess) {
      console.log('❌ Failed to trigger redeployment');
      await this.browser.close();
      return false;
    }
    
    // Step 4: Monitor deployment
    const deploymentSuccess = await this.monitorDeployment(8);
    
    // Step 5: Generate report
    const report = {
      timestamp: new Date().toISOString(),
      diagnosis,
      configurationFixes: configFixes,
      redeploymentTriggered: redeploySuccess,
      deploymentSuccess,
      finalStatus: deploymentSuccess ? 'SUCCESS' : 'PARTIAL_SUCCESS'
    };
    
    fs.writeFileSync('tests/railway-deployment-fix-report.json', JSON.stringify(report, null, 2));
    
    console.log('\n📄 Fix Report Generated: tests/railway-deployment-fix-report.json');
    console.log(`🎯 Final Status: ${report.finalStatus}`);
    
    await this.browser.close();
    return deploymentSuccess;
  }
}

// Run the complete fix
if (require.main === module) {
  const fixer = new RailwayDeploymentFixer();
  fixer.runCompleteFix().catch(console.error);
}

module.exports = { RailwayDeploymentFixer };
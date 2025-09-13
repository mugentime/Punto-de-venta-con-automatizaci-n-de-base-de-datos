const { chromium } = require('playwright');
const fs = require('fs');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';

class DeploymentMonitor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.checkCount = 0;
    this.maxChecks = 40; // 20 minutes with 30s intervals
    this.deploymentId = '4548f92b-d5dd-49ff-8840-3768b72daec3';
  }

  async initialize() {
    console.log('🚀 Initializing New Deployment Monitor');
    console.log(`🎯 Failed Deployment ID: ${this.deploymentId}`);
    console.log(`📡 Monitoring: ${RAILWAY_URL}`);
    
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 100
    });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async checkDeploymentStatus() {
    this.checkCount++;
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`\n🔍 Deployment Check ${this.checkCount}/${this.maxChecks} - ${timestamp}`);
    console.log('🎯 Previous failure: 4548f92b-d5dd-49ff-8840-3768b72daec3');
    console.log('=' .repeat(50));
    
    try {
      const startTime = Date.now();
      const response = await this.page.goto(RAILWAY_URL, { 
        waitUntil: 'domcontentloaded',
        timeout: 20000 
      });
      const loadTime = Date.now() - startTime;
      
      const status = response.status();
      const title = await this.page.title();
      const content = await this.page.content();
      
      // Check for different deployment states
      const states = {
        hasPOS: content.includes('POS') || content.includes('main-app') || 
                content.includes('inventario') || title.includes('POS'),
        hasPlaceholder: content.includes('Railway API') || 
                       content.includes('ASCII') || content.includes('░'),
        hasError: content.includes('Application Error') || 
                  content.includes('500') || content.includes('error'),
        hasBuildError: content.includes('Build Error') || 
                      content.includes('deployment failed'),
        isLoading: content.includes('loading') || content.includes('Building')
      };
      
      // Quick health check
      let healthStatus = 'N/A';
      let healthResponse = null;
      try {
        healthResponse = await this.page.request.get(`${RAILWAY_URL}/api/health`, { timeout: 5000 });
        healthStatus = healthResponse.status();
      } catch (e) {
        healthStatus = 'Timeout/Error';
      }
      
      console.log(`📊 HTTP Status: ${status} (${loadTime}ms)`);
      console.log(`📄 Title: "${title || 'No title'}"`);
      console.log(`🏪 POS App: ${states.hasPOS ? '✅ DETECTED' : '❌ Missing'}`);
      console.log(`🤖 API Placeholder: ${states.hasPlaceholder ? '❌ Present' : '✅ Gone'}`);
      console.log(`💥 Error Page: ${states.hasError ? '❌ Error detected' : '✅ No errors'}`);
      console.log(`🔨 Build Error: ${states.hasBuildError ? '❌ Build failed' : '✅ No build errors'}`);
      console.log(`⏳ Loading: ${states.isLoading ? '🔄 In progress' : '✅ Complete'}`);
      console.log(`🏥 Health Check: ${healthStatus}`);
      
      // Determine deployment state
      let deploymentState;
      if (states.hasPOS && healthStatus === 200) {
        deploymentState = 'SUCCESS';
      } else if (states.hasPOS && healthStatus !== 200) {
        deploymentState = 'PARTIAL_SUCCESS';
      } else if (states.hasBuildError) {
        deploymentState = 'BUILD_FAILED';
      } else if (states.hasError) {
        deploymentState = 'RUNTIME_ERROR';
      } else if (states.isLoading) {
        deploymentState = 'BUILDING';
      } else if (states.hasPlaceholder) {
        deploymentState = 'PLACEHOLDER';
      } else {
        deploymentState = 'UNKNOWN';
      }
      
      console.log(`🎯 Deployment State: ${deploymentState}`);
      
      // Take screenshot
      await this.page.screenshot({ 
        path: `tests/screenshots/deployment-monitor-${this.checkCount}.png`,
        fullPage: true 
      });
      
      const result = {
        check: this.checkCount,
        timestamp: new Date().toISOString(),
        httpStatus: status,
        loadTime,
        title,
        states,
        healthStatus,
        deploymentState,
        isSuccess: deploymentState === 'SUCCESS' || deploymentState === 'PARTIAL_SUCCESS'
      };
      
      // Save progress
      this.saveProgress(result);
      
      if (result.isSuccess) {
        console.log('\n🎉 DEPLOYMENT SUCCESS!');
        await this.runSuccessValidation();
        return { success: true, result };
      }
      
      if (deploymentState === 'BUILD_FAILED') {
        console.log('\n💥 BUILD FAILURE DETECTED');
        console.log('🔧 The deployment fixes may need adjustment');
      }
      
      return { success: false, result };
      
    } catch (error) {
      console.log(`❌ Check failed: ${error.message}`);
      return {
        success: false,
        result: {
          check: this.checkCount,
          error: error.message,
          deploymentState: 'CONNECTION_ERROR'
        }
      };
    }
  }

  async runSuccessValidation() {
    console.log('\n🔍 Running Success Validation...');
    
    try {
      // Test health endpoints
      const healthResp = await this.page.request.get(`${RAILWAY_URL}/api/health`);
      const statusResp = await this.page.request.get(`${RAILWAY_URL}/api/status`);
      
      console.log(`   Health endpoint: ${healthResp.status()}`);
      console.log(`   Status endpoint: ${statusResp.status()}`);
      
      if (healthResp.ok()) {
        const healthData = await healthResp.json();
        console.log(`   Service status: ${healthData.status}`);
        console.log(`   Uptime: ${Math.round(healthData.uptime || 0)}s`);
      }
      
      // Test UI elements
      const loginForms = await this.page.locator('form, #login-form').count();
      const buttons = await this.page.locator('button').count();
      
      console.log(`   Login forms: ${loginForms}`);
      console.log(`   Interactive buttons: ${buttons}`);
      
      // Take success screenshot
      await this.page.screenshot({ 
        path: 'tests/screenshots/deployment-success-final.png',
        fullPage: true 
      });
      
      console.log('📸 Success validation complete');
      
    } catch (error) {
      console.log(`   ⚠️ Validation error: ${error.message}`);
    }
  }

  saveProgress(result) {
    const progressFile = 'tests/deployment-monitor-progress.json';
    let progress = { 
      previousFailure: this.deploymentId,
      checks: [] 
    };
    
    if (fs.existsSync(progressFile)) {
      progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    }
    
    progress.checks.push(result);
    progress.lastUpdate = new Date().toISOString();
    progress.totalChecks = this.checkCount;
    
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  }

  async monitor() {
    await this.initialize();
    
    console.log('\n👀 Starting Deployment Recovery Monitor');
    console.log('🚨 Previous deployment failed - monitoring for fixes');
    console.log(`⏱️ Max monitoring time: ${this.maxChecks * 30} seconds`);
    
    while (this.checkCount < this.maxChecks) {
      const { success } = await this.checkDeploymentStatus();
      
      if (success) {
        console.log('\n🎉 RECOVERY SUCCESSFUL!');
        break;
      }
      
      if (this.checkCount < this.maxChecks) {
        console.log('⏳ Waiting 30 seconds for next check...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    if (this.checkCount >= this.maxChecks) {
      console.log('\n⏰ Maximum monitoring time reached');
      console.log('💡 Check Railway dashboard for detailed deployment logs');
    }
    
    await this.generateFinalReport();
    await this.browser.close();
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Deployment Recovery Report...');
    
    const progressFile = 'tests/deployment-monitor-progress.json';
    let progress = { checks: [] };
    
    if (fs.existsSync(progressFile)) {
      progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    }
    
    const successful = progress.checks.filter(c => c.isSuccess).length;
    const errors = progress.checks.filter(c => c.deploymentState?.includes('ERROR')).length;
    const building = progress.checks.filter(c => c.deploymentState === 'BUILDING').length;
    
    const report = {
      originalFailure: this.deploymentId,
      fixesApplied: [
        'Fixed package.json merge conflicts',
        'Simplified railway.json configuration',
        'Optimized Dockerfile for Railway',
        'Added proper health check configuration'
      ],
      monitoringResults: {
        totalChecks: progress.checks.length,
        successfulChecks: successful,
        errorChecks: errors,
        buildingChecks: building,
        finalStatus: progress.checks[progress.checks.length - 1]
      },
      recommendation: this.getRecommendation(progress.checks)
    };
    
    fs.writeFileSync('tests/deployment-recovery-report.json', JSON.stringify(report, null, 2));
    
    console.log('📄 Recovery report: tests/deployment-recovery-report.json');
    console.log(`🎯 Success rate: ${Math.round((successful / progress.checks.length) * 100)}%`);
    console.log(`💡 ${report.recommendation}`);
  }

  getRecommendation(checks) {
    const lastCheck = checks[checks.length - 1];
    
    if (lastCheck?.isSuccess) {
      return 'Deployment recovery successful! POS application is now live on Railway.';
    } else if (lastCheck?.deploymentState === 'BUILD_FAILED') {
      return 'Build is still failing. Check Railway logs for specific error details.';
    } else if (lastCheck?.deploymentState === 'BUILDING') {
      return 'Deployment is in progress. Continue monitoring Railway dashboard.';
    } else {
      return 'Deployment needs manual intervention. Check Railway dashboard and logs.';
    }
  }
}

// Start monitoring
if (require.main === module) {
  const monitor = new DeploymentMonitor();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping monitor...');
    if (monitor.browser) {
      await monitor.browser.close();
    }
    process.exit(0);
  });
  
  monitor.monitor().catch(console.error);
}

module.exports = { DeploymentMonitor };
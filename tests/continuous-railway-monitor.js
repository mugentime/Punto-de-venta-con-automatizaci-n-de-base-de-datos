const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';
const LOCAL_URL = 'http://localhost:3000';

class ContinuousRailwayMonitor {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.monitoringActive = true;
    this.checkInterval = 30000; // 30 seconds
    this.results = [];
  }

  async initialize() {
    console.log('🔄 Initializing Continuous Railway Monitor');
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 100
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    this.page = await this.context.newPage();
  }

  async quickHealthCheck(url) {
    try {
      const startTime = Date.now();
      const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const loadTime = Date.now() - startTime;
      
      const status = response.status();
      const title = await this.page.title();
      const content = await this.page.content();
      
      const hasApiPlaceholder = content.includes('Railway API') || content.includes('ASCII') || content.includes('░');
      const hasPosElements = content.includes('POS') || content.includes('inventario') || content.includes('main-app') || content.includes('login');
      
      // Quick health endpoint check
      let healthStatus = 'unknown';
      try {
        const healthResponse = await this.page.request.get(`${url}/api/health`);
        healthStatus = healthResponse.status();
      } catch (e) {
        healthStatus = 'error';
      }
      
      return {
        timestamp: new Date().toISOString(),
        url,
        status,
        loadTime,
        title: title || 'No title',
        hasApiPlaceholder,
        hasPosElements,
        healthStatus,
        assessment: this.assessDeployment(status, hasApiPlaceholder, hasPosElements, healthStatus)
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        url,
        status: 'error',
        error: error.message,
        assessment: 'failed'
      };
    }
  }

  assessDeployment(status, hasApiPlaceholder, hasPosElements, healthStatus) {
    if (status !== 200) return 'offline';
    if (hasApiPlaceholder && !hasPosElements) return 'api_placeholder';
    if (hasPosElements && healthStatus === 200) return 'fully_deployed';
    if (hasPosElements && healthStatus !== 200) return 'partial_deployment';
    return 'unknown';
  }

  async startMonitoring() {
    await this.initialize();
    
    console.log('🚀 Starting Continuous Railway Monitoring');
    console.log(`📊 Monitoring Railway: ${RAILWAY_URL}`);
    console.log(`🏠 Comparing with Local: ${LOCAL_URL}`);
    console.log(`⏱️  Check interval: ${this.checkInterval / 1000}s`);
    
    let iteration = 0;
    
    while (this.monitoringActive && iteration < 20) { // Max 20 iterations (10 minutes)
      iteration++;
      console.log(`\n🔍 === Check ${iteration} === ${new Date().toLocaleTimeString()}`);
      
      // Check Railway deployment
      const railwayResult = await this.quickHealthCheck(RAILWAY_URL);
      console.log(`🚄 Railway Status: ${railwayResult.assessment.toUpperCase()} (${railwayResult.status}) - ${railwayResult.loadTime}ms`);
      
      if (railwayResult.hasPosElements) {
        console.log('   ✅ POS Elements detected!');
      } else if (railwayResult.hasApiPlaceholder) {
        console.log('   ❌ Still showing API placeholder');
      }
      
      if (railwayResult.healthStatus === 200) {
        console.log('   ✅ Health endpoints working');
      } else if (railwayResult.healthStatus === 404) {
        console.log('   ❌ Health endpoints missing');
      }
      
      // Check local for comparison
      const localResult = await this.quickHealthCheck(LOCAL_URL);
      console.log(`🏠 Local Status: ${localResult.assessment.toUpperCase()} (${localResult.status})`);
      
      this.results.push({
        iteration,
        railway: railwayResult,
        local: localResult,
        comparison: {
          railwayWorking: railwayResult.assessment === 'fully_deployed',
          localWorking: localResult.assessment === 'fully_deployed',
          syncNeeded: railwayResult.assessment !== localResult.assessment
        }
      });
      
      // Check if Railway is now working
      if (railwayResult.assessment === 'fully_deployed') {
        console.log('\n🎉 SUCCESS! Railway deployment is now fully working!');
        await this.runFinalValidation();
        break;
      }
      
      // Check if we need to trigger another deployment
      if (railwayResult.assessment === 'api_placeholder' && iteration % 3 === 0) {
        console.log('🔄 Attempting to trigger Railway redeployment...');
        await this.triggerRedeployment(iteration);
      }
      
      // Save progress
      this.saveProgress();
      
      if (iteration < 20) {
        console.log(`⏳ Waiting ${this.checkInterval / 1000}s for next check...`);
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }
    
    await this.generateFinalReport();
    await this.browser.close();
  }

  async triggerRedeployment(iteration) {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Create a small change to trigger deployment
      const triggerFile = path.join(process.cwd(), 'railway_deploy_trigger.txt');
      fs.writeFileSync(triggerFile, `Deployment trigger ${iteration} - ${new Date().toISOString()}`);
      
      await execAsync('git add railway_deploy_trigger.txt');
      await execAsync(`git commit -m "trigger: Railway redeployment attempt ${iteration}"`);
      await execAsync('git push origin main');
      
      console.log('   ✅ Triggered Railway redeployment via Git push');
      
      // Clean up trigger file
      fs.unlinkSync(triggerFile);
      
    } catch (error) {
      console.log(`   ❌ Redeployment trigger failed: ${error.message}`);
    }
  }

  async runFinalValidation() {
    console.log('\n🔍 Running Final Validation Suite...');
    
    // Test Railway thoroughly
    await this.page.goto(RAILWAY_URL);
    await this.page.waitForLoadState('networkidle');
    
    // Take screenshot
    await this.page.screenshot({ 
      path: 'tests/screenshots/railway-final-success.png', 
      fullPage: true 
    });
    
    // Test health endpoints
    const healthResponse = await this.page.request.get(`${RAILWAY_URL}/api/health`);
    const statusResponse = await this.page.request.get(`${RAILWAY_URL}/api/status`);
    
    console.log(`   Health endpoint: ${healthResponse.status()}`);
    console.log(`   Status endpoint: ${statusResponse.status()}`);
    
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      console.log(`   Uptime: ${Math.round(healthData.uptime)}s`);
    }
    
    // Test POS functionality
    const loginElements = await this.page.locator('form, #login-form, [class*="login"]').count();
    const navElements = await this.page.locator('nav, [class*="nav"], [data-section]').count();
    
    console.log(`   Login forms: ${loginElements}`);
    console.log(`   Navigation elements: ${navElements}`);
    
    console.log('\n✅ Final validation complete!');
  }

  saveProgress() {
    const reportPath = path.join(process.cwd(), 'tests', 'continuous-monitoring-progress.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      startTime: this.results[0]?.railway?.timestamp || new Date().toISOString(),
      currentTime: new Date().toISOString(),
      totalChecks: this.results.length,
      results: this.results.slice(-5), // Keep last 5 results
      summary: {
        railwayWorking: this.results.filter(r => r.railway.assessment === 'fully_deployed').length,
        apiPlaceholder: this.results.filter(r => r.railway.assessment === 'api_placeholder').length,
        offline: this.results.filter(r => r.railway.assessment === 'offline').length
      }
    }, null, 2));
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Final Monitoring Report...');
    
    const report = {
      monitoringPeriod: {
        start: this.results[0]?.railway?.timestamp,
        end: new Date().toISOString(),
        totalChecks: this.results.length,
        duration: `${Math.round(this.results.length * this.checkInterval / 1000 / 60)} minutes`
      },
      finalStatus: {
        railway: this.results[this.results.length - 1]?.railway,
        local: this.results[this.results.length - 1]?.local
      },
      summary: {
        railwayFullyWorking: this.results.filter(r => r.railway.assessment === 'fully_deployed').length,
        railwayApiPlaceholder: this.results.filter(r => r.railway.assessment === 'api_placeholder').length,
        railwayOffline: this.results.filter(r => r.railway.assessment === 'offline').length,
        successRate: Math.round((this.results.filter(r => r.railway.assessment === 'fully_deployed').length / this.results.length) * 100)
      },
      timeline: this.results
    };
    
    const reportPath = path.join(process.cwd(), 'tests', 'continuous-monitoring-final-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Final report saved: ${reportPath}`);
    console.log(`🎯 Railway success rate: ${report.summary.successRate}%`);
    
    if (report.summary.successRate > 0) {
      console.log('🎉 Railway deployment achieved at least partial success!');
    } else {
      console.log('❌ Railway deployment needs manual intervention');
    }
  }

  async stop() {
    this.monitoringActive = false;
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run continuous monitoring
if (require.main === module) {
  const monitor = new ContinuousRailwayMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping monitoring...');
    await monitor.stop();
    process.exit(0);
  });
  
  monitor.startMonitoring().catch(console.error);
}

module.exports = { ContinuousRailwayMonitor };
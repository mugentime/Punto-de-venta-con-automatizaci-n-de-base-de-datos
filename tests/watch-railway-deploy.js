const { chromium } = require('playwright');
const fs = require('fs');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';

class RailwayDeploymentWatcher {
  constructor() {
    this.browser = null;
    this.page = null;
    this.watching = true;
    this.checkCount = 0;
    this.maxChecks = 20; // 10 minutes with 30s intervals
  }

  async initialize() {
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 100
    });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async checkDeployment() {
    this.checkCount++;
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`\n🔍 Check ${this.checkCount}/${this.maxChecks} - ${timestamp}`);
    console.log('=' .repeat(40));
    
    try {
      const startTime = Date.now();
      const response = await this.page.goto(RAILWAY_URL, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      const loadTime = Date.now() - startTime;
      
      const status = response.status();
      const title = await this.page.title();
      const content = await this.page.content();
      
      const hasPOS = content.includes('POS') || content.includes('main-app') || 
                    content.includes('inventario') || title.includes('POS');
      const hasPlaceholder = content.includes('Railway API') || 
                            content.includes('ASCII') || content.includes('░');
      
      // Quick health check
      let healthStatus = 'N/A';
      try {
        const healthResp = await this.page.request.get(`${RAILWAY_URL}/api/health`);
        healthStatus = healthResp.status();
      } catch (e) {
        healthStatus = 'Error';
      }
      
      console.log(`📊 Status: HTTP ${status} (${loadTime}ms)`);
      console.log(`📄 Title: "${title}"`);
      console.log(`🏪 POS App: ${hasPOS ? '✅ DETECTED' : '❌ Missing'}`);
      console.log(`🤖 API Placeholder: ${hasPlaceholder ? '❌ Present' : '✅ Gone'}`);
      console.log(`🏥 Health: ${healthStatus}`);
      
      const result = {
        check: this.checkCount,
        timestamp: new Date().toISOString(),
        httpStatus: status,
        loadTime,
        title,
        hasPOS,
        hasPlaceholder,
        healthStatus,
        assessment: this.assessStatus(hasPOS, hasPlaceholder, healthStatus)
      };
      
      console.log(`🎯 Assessment: ${result.assessment}`);
      
      // Check if deployment is successful
      if (hasPOS && !hasPlaceholder) {
        console.log('\n🎉 SUCCESS! Railway deployment is working!');
        await this.runFinalValidation();
        this.watching = false;
        return result;
      }
      
      // Save progress
      this.saveProgress(result);
      
      return result;
      
    } catch (error) {
      console.log(`❌ Check failed: ${error.message}`);
      return {
        check: this.checkCount,
        timestamp: new Date().toISOString(),
        error: error.message,
        assessment: 'ERROR'
      };
    }
  }

  assessStatus(hasPOS, hasPlaceholder, healthStatus) {
    if (hasPOS && !hasPlaceholder && healthStatus === 200) {
      return 'FULLY_DEPLOYED';
    } else if (hasPOS && !hasPlaceholder) {
      return 'POS_DEPLOYED_NO_HEALTH';
    } else if (hasPlaceholder) {
      return 'API_PLACEHOLDER';
    } else {
      return 'UNKNOWN';
    }
  }

  async runFinalValidation() {
    console.log('\n🔍 Running Final Validation...');
    
    // Test authentication
    try {
      const loginElements = await this.page.locator('form, #login-form, [class*="login"]').count();
      console.log(`   Login forms: ${loginElements}`);
    } catch (e) {
      console.log('   Could not check login elements');
    }
    
    // Test navigation
    try {
      const navElements = await this.page.locator('nav, [class*="nav"], [data-section]').count();
      console.log(`   Navigation elements: ${navElements}`);
    } catch (e) {
      console.log('   Could not check navigation');
    }
    
    // Take success screenshot
    await this.page.screenshot({ 
      path: 'tests/screenshots/railway-deployment-final-success.png',
      fullPage: true 
    });
    
    console.log('📸 Success screenshot saved');
  }

  saveProgress(result) {
    const progressFile = 'tests/railway-deployment-progress.json';
    let progress = { checks: [] };
    
    if (fs.existsSync(progressFile)) {
      progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    }
    
    progress.checks.push(result);
    progress.lastUpdate = new Date().toISOString();
    progress.totalChecks = this.checkCount;
    
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  }

  async watch() {
    await this.initialize();
    
    console.log('👀 Starting Railway Deployment Watcher');
    console.log(`🎯 Target: ${RAILWAY_URL}`);
    console.log(`⏱️  Max duration: ${this.maxChecks * 30} seconds (${this.maxChecks} checks)`);
    console.log('🚀 Monitoring for POS deployment...');
    
    while (this.watching && this.checkCount < this.maxChecks) {
      await this.checkDeployment();
      
      if (this.watching && this.checkCount < this.maxChecks) {
        console.log('⏳ Waiting 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    if (this.checkCount >= this.maxChecks && this.watching) {
      console.log('\n⏰ Maximum checks reached');
      console.log('💡 Railway deployment may need additional time or manual intervention');
    }
    
    await this.generateFinalReport();
    await this.browser.close();
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Final Watch Report...');
    
    const progressFile = 'tests/railway-deployment-progress.json';
    let progress = { checks: [] };
    
    if (fs.existsSync(progressFile)) {
      progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    }
    
    const successful = progress.checks.filter(c => c.assessment === 'FULLY_DEPLOYED').length;
    const posDeployed = progress.checks.filter(c => c.hasPOS).length;
    const placeholderCount = progress.checks.filter(c => c.hasPlaceholder).length;
    
    const report = {
      watchingPeriod: {
        totalChecks: progress.checks.length,
        duration: `${progress.checks.length * 30} seconds`,
        startTime: progress.checks[0]?.timestamp,
        endTime: progress.checks[progress.checks.length - 1]?.timestamp
      },
      deploymentProgress: {
        fullyDeployedChecks: successful,
        posDeployedChecks: posDeployed,
        placeholderChecks: placeholderCount,
        successRate: Math.round((successful / progress.checks.length) * 100)
      },
      finalStatus: progress.checks[progress.checks.length - 1],
      recommendation: this.getRecommendation(progress.checks)
    };
    
    fs.writeFileSync('tests/railway-watch-final-report.json', JSON.stringify(report, null, 2));
    
    console.log(`📄 Final report: tests/railway-watch-final-report.json`);
    console.log(`🎯 Success rate: ${report.deploymentProgress.successRate}%`);
    console.log(`💡 Recommendation: ${report.recommendation}`);
  }

  getRecommendation(checks) {
    const lastCheck = checks[checks.length - 1];
    
    if (lastCheck?.assessment === 'FULLY_DEPLOYED') {
      return 'Deployment successful! Railway is serving the POS application.';
    } else if (lastCheck?.hasPOS) {
      return 'POS app deployed but health endpoints need configuration.';
    } else if (lastCheck?.hasPlaceholder) {
      return 'Railway is still showing API placeholder. Check deployment logs and configuration.';
    } else {
      return 'Deployment status unclear. Manual Railway dashboard inspection recommended.';
    }
  }
}

// Start watching
if (require.main === module) {
  const watcher = new RailwayDeploymentWatcher();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping watcher...');
    watcher.watching = false;
    if (watcher.browser) {
      await watcher.browser.close();
    }
    process.exit(0);
  });
  
  watcher.watch().catch(console.error);
}

module.exports = { RailwayDeploymentWatcher };
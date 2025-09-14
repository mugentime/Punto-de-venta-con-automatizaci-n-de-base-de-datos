/**
 * TaskMaster Continuous Monitor for Railway Deployment
 * Project ID: fed11c6d-a65a-4d93-90e6-955e16b6753f
 */

const https = require('https');
const fs = require('fs');

class TaskMasterContinuousMonitor {
  constructor() {
    this.config = JSON.parse(fs.readFileSync('taskmaster-monitoring-config.json', 'utf8'));
    this.checkCount = 0;
    this.successCount = 0;
    this.results = [];
  }

  async start() {
    console.log('🎯 TaskMaster Continuous Monitor Started');
    console.log(`📊 Project: ${this.config.projectId}`);
    console.log(`🔗 Target: ${this.config.url}`);
    console.log(`⏱️  Interval: ${this.config.interval}ms`);
    console.log('=' .repeat(50));

    this.monitor();
  }

  async monitor() {
    if (this.checkCount >= this.config.maxChecks) {
      this.generateReport();
      return;
    }

    this.checkCount++;
    console.log(`\n🔍 Check ${this.checkCount}/${this.config.maxChecks} - ${new Date().toLocaleTimeString()}`);

    const results = await this.checkDeployment();
    this.results.push(results);

    if (results.success) {
      this.successCount++;
      console.log('✅ POS Application Detected!');
      console.log('🎉 Railway deployment successful!');
      this.generateSuccessReport();
      return;
    }

    console.log(`⏳ Next check in ${this.config.interval / 1000} seconds...`);
    setTimeout(() => this.monitor(), this.config.interval);
  }

  async checkDeployment() {
    const checks = {
      mainPage: await this.checkUrl(this.config.url),
      health: await this.checkUrl(`${this.config.url}/api/health`),
      status: await this.checkUrl(`${this.config.url}/api/status`)
    };

    const hasPOS = checks.mainPage.content.includes('POS') ||
                   checks.mainPage.content.includes('inventario') ||
                   checks.mainPage.content.includes('main-app');

    const hasPlaceholder = checks.mainPage.content.includes('Railway API') ||
                          checks.mainPage.content.includes('Home of the Railway API');

    const healthOK = checks.health.status === 200;
    const statusOK = checks.status.status === 200;

    console.log(`  📊 Main Page: ${checks.mainPage.status}`);
    console.log(`  🏥 Health: ${checks.health.status}`);
    console.log(`  📈 Status: ${checks.status.status}`);
    console.log(`  🏪 POS App: ${hasPOS ? '✅' : '❌'}`);
    console.log(`  🚂 Placeholder: ${hasPlaceholder ? '⚠️ Present' : '✅ Absent'}`);

    return {
      timestamp: new Date().toISOString(),
      checkNumber: this.checkCount,
      success: hasPOS && !hasPlaceholder && healthOK,
      details: {
        hasPOS,
        hasPlaceholder,
        healthOK,
        statusOK,
        mainStatus: checks.mainPage.status,
        healthStatus: checks.health.status,
        statusStatus: checks.status.status
      }
    };
  }

  checkUrl(url) {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            content: data.substring(0, 500)
          });
        });
      }).on('error', (err) => {
        resolve({
          status: 0,
          content: err.message
        });
      });
    });
  }

  generateReport() {
    const report = {
      projectId: this.config.projectId,
      url: this.config.url,
      totalChecks: this.checkCount,
      successfulChecks: this.successCount,
      timestamp: new Date().toISOString(),
      results: this.results
    };

    fs.writeFileSync('taskmaster-monitoring-report.json', JSON.stringify(report, null, 2));

    console.log('\n📊 Monitoring Complete');
    console.log(`Total Checks: ${this.checkCount}`);
    console.log(`Success Rate: ${(this.successCount / this.checkCount * 100).toFixed(1)}%`);

    if (this.successCount === 0) {
      console.log('❌ Deployment still showing Railway API placeholder');
      console.log('🔧 Further intervention required');
    }
  }

  generateSuccessReport() {
    const report = {
      projectId: this.config.projectId,
      url: this.config.url,
      success: true,
      timestamp: new Date().toISOString(),
      checksBeforeSuccess: this.checkCount,
      timeToSuccess: this.checkCount * this.config.interval / 1000,
      results: this.results
    };

    fs.writeFileSync('taskmaster-success-report.json', JSON.stringify(report, null, 2));

    console.log('\n🎉 SUCCESS REPORT');
    console.log(`✅ POS Application deployed successfully`);
    console.log(`⏱️  Time to deployment: ${report.timeToSuccess} seconds`);
    console.log(`📊 Checks performed: ${this.checkCount}`);
  }
}

// Start monitoring
if (require.main === module) {
  const monitor = new TaskMasterContinuousMonitor();
  monitor.start().catch(console.error);
}

module.exports = { TaskMasterContinuousMonitor };
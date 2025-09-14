/**
 * Real-time Deployment Status Dashboard
 * Monitors emergency deployment loop and parallel swarm progress
 */

const https = require('https');
const fs = require('fs');

class DeploymentStatusDashboard {
  constructor() {
    this.railwayUrl = 'https://pos-conejo-negro.railway.app';
    this.checkInterval = 10000; // 10 seconds
    this.maxChecks = 100;
    this.currentCheck = 0;
    this.successCount = 0;
    this.results = [];
  }

  async startDashboard() {
    console.log('📊 DEPLOYMENT STATUS DASHBOARD');
    console.log('🎯 Monitoring Railway deployment recovery...');
    console.log('🔄 Emergency loop and parallel swarm active');
    console.log('=' .repeat(60));

    this.monitorLoop();
  }

  async monitorLoop() {
    if (this.currentCheck >= this.maxChecks) {
      this.generateFinalReport();
      return;
    }

    this.currentCheck++;
    const timestamp = new Date().toLocaleTimeString();

    console.log(`\\n🔍 CHECK ${this.currentCheck}/${this.maxChecks} - ${timestamp}`);
    console.log('=' .repeat(50));

    // Check Railway status
    const railwayStatus = await this.checkRailwayStatus();
    const deploymentFiles = this.checkDeploymentFiles();

    // Display status
    this.displayStatus(railwayStatus, deploymentFiles);

    // Store results
    this.results.push({
      check: this.currentCheck,
      timestamp,
      railway: railwayStatus,
      files: deploymentFiles
    });

    // Check for success
    if (railwayStatus.hasPOS && !railwayStatus.hasPlaceholder) {
      console.log('\\n🎉 SUCCESS DETECTED!');
      console.log('✅ Railway is now serving POS application!');
      this.generateSuccessReport();
      return;
    }

    // Continue monitoring
    setTimeout(() => this.monitorLoop(), this.checkInterval);
  }

  async checkRailwayStatus() {
    return new Promise((resolve) => {
      https.get(this.railwayUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const hasPOS = data.includes('POS') ||
                        data.includes('Conejo Negro') ||
                        data.includes('inventario') ||
                        data.includes('main-app');

          const hasPlaceholder = data.includes('Railway API') ||
                                data.includes('Home of the Railway API');

          resolve({
            statusCode: res.statusCode,
            hasPOS,
            hasPlaceholder,
            responseSize: data.length,
            title: this.extractTitle(data),
            hasHealthEndpoint: data.includes('/api/health')
          });
        });
      }).on('error', (err) => {
        resolve({
          statusCode: 0,
          hasPOS: false,
          hasPlaceholder: false,
          error: err.message,
          responseSize: 0
        });
      });
    });
  }

  extractTitle(html) {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    return titleMatch ? titleMatch[1].substring(0, 50) : 'No title';
  }

  checkDeploymentFiles() {
    return {
      railwayJson: fs.existsSync('railway.json'),
      dockerfile: fs.existsSync('Dockerfile'),
      packageJson: fs.existsSync('package.json'),
      serverJs: fs.existsSync('server.js'),
      publicIndex: fs.existsSync('public/index.html'),
      emergencyTriggers: fs.readdirSync('.').filter(f => f.startsWith('deployment-trigger')).length,
      lastModified: this.getLastModifiedTime()
    };
  }

  getLastModifiedTime() {
    try {
      const railwayStats = fs.statSync('railway.json');
      const dockerStats = fs.statSync('Dockerfile');

      const railwayTime = railwayStats.mtime;
      const dockerTime = dockerStats.mtime;

      const latest = railwayTime > dockerTime ? railwayTime : dockerTime;
      return latest.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  }

  displayStatus(railway, files) {
    // Railway Status
    console.log('🌐 RAILWAY STATUS:');
    console.log(`  📊 HTTP Status: ${railway.statusCode}`);
    console.log(`  📄 Title: "${railway.title}"`);
    console.log(`  🏪 POS App: ${railway.hasPOS ? '✅ DETECTED' : '❌ MISSING'}`);
    console.log(`  🚂 API Placeholder: ${railway.hasPlaceholder ? '⚠️  PRESENT' : '✅ ABSENT'}`);
    console.log(`  📦 Response Size: ${railway.responseSize} bytes`);
    console.log(`  🏥 Health Endpoint: ${railway.hasHealthEndpoint ? '✅' : '❌'}`);

    // Deployment Files Status
    console.log('\\n📁 DEPLOYMENT FILES:');
    console.log(`  railway.json: ${files.railwayJson ? '✅' : '❌'}`);
    console.log(`  Dockerfile: ${files.dockerfile ? '✅' : '❌'}`);
    console.log(`  package.json: ${files.packageJson ? '✅' : '❌'}`);
    console.log(`  server.js: ${files.serverJs ? '✅' : '❌'}`);
    console.log(`  public/index.html: ${files.publicIndex ? '✅' : '❌'}`);
    console.log(`  Emergency triggers: ${files.emergencyTriggers}`);
    console.log(`  Last modified: ${files.lastModified}`);

    // Overall Assessment
    const assessment = this.assessDeployment(railway, files);
    console.log(`\\n🎯 ASSESSMENT: ${assessment}`);

    if (railway.hasPOS) {
      this.successCount++;
      console.log('🎉 POS APPLICATION IS WORKING!');
    }
  }

  assessDeployment(railway, files) {
    if (railway.hasPOS && !railway.hasPlaceholder) {
      return '🟢 DEPLOYMENT SUCCESSFUL';
    } else if (railway.statusCode === 200 && !railway.hasPlaceholder) {
      return '🟡 DEPLOYMENT IN PROGRESS';
    } else if (railway.hasPlaceholder) {
      return '🔴 STILL SHOWING API PLACEHOLDER';
    } else if (railway.statusCode === 0) {
      return '🔴 RAILWAY NOT RESPONDING';
    } else {
      return '🟠 DEPLOYMENT STATUS UNCLEAR';
    }
  }

  generateSuccessReport() {
    const report = {
      success: true,
      totalChecks: this.currentCheck,
      successfulChecks: this.successCount,
      deploymentTime: `${this.currentCheck * (this.checkInterval / 1000)} seconds`,
      timestamp: new Date().toISOString(),
      finalStatus: this.results[this.results.length - 1]
    };

    fs.writeFileSync('deployment-success-dashboard-report.json', JSON.stringify(report, null, 2));

    console.log('\\n🎉 DEPLOYMENT SUCCESS REPORT');
    console.log('=' .repeat(60));
    console.log(`✅ Railway deployment successful after ${this.currentCheck} checks`);
    console.log(`⏱️  Total deployment time: ${report.deploymentTime}`);
    console.log(`🎯 Success rate: ${(this.successCount / this.currentCheck * 100).toFixed(1)}%`);
    console.log('📋 Report saved to: deployment-success-dashboard-report.json');
  }

  generateFinalReport() {
    const report = {
      success: this.successCount > 0,
      totalChecks: this.currentCheck,
      successfulChecks: this.successCount,
      successRate: `${(this.successCount / this.currentCheck * 100).toFixed(1)}%`,
      monitoringDuration: `${this.currentCheck * (this.checkInterval / 1000)} seconds`,
      timestamp: new Date().toISOString(),
      results: this.results
    };

    fs.writeFileSync('deployment-final-dashboard-report.json', JSON.stringify(report, null, 2));

    console.log('\\n📊 FINAL MONITORING REPORT');
    console.log('=' .repeat(60));
    console.log(`Total checks: ${this.currentCheck}`);
    console.log(`Successful detections: ${this.successCount}`);
    console.log(`Success rate: ${report.successRate}`);
    console.log(`Monitoring duration: ${report.monitoringDuration}`);

    if (this.successCount > 0) {
      console.log('✅ Railway deployment shows signs of success');
    } else {
      console.log('❌ Deployment still needs attention');
    }

    console.log('📋 Report saved to: deployment-final-dashboard-report.json');
  }
}

// Start dashboard
if (require.main === module) {
  const dashboard = new DeploymentStatusDashboard();
  dashboard.startDashboard().catch(console.error);
}

module.exports = { DeploymentStatusDashboard };
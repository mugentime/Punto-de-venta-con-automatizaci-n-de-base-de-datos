/**
 * Emergency Railway Deployment Loop with Swarm Coordination
 * Project: fed11c6d-a65a-4d93-90e6-955e16b6753f
 * Continuous deployment until success
 */

const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');

class EmergencyRailwayDeploymentLoop {
  constructor() {
    this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
    this.railwayUrl = 'https://pos-conejo-negro.railway.app';
    this.maxAttempts = 50;
    this.currentAttempt = 0;
    this.deploymentStrategies = [
      'minimal-docker',
      'nixpacks-auto',
      'static-serve',
      'emergency-fallback'
    ];
    this.currentStrategy = 0;
    this.fixes = [];
    this.deploymentHistory = [];
  }

  async startDeploymentLoop() {
    console.log('🚨 EMERGENCY RAILWAY DEPLOYMENT LOOP INITIATED');
    console.log(`📊 Project: ${this.projectId}`);
    console.log(`🎯 Target: ${this.railwayUrl}`);
    console.log(`🔄 Max Attempts: ${this.maxAttempts}`);
    console.log('=' .repeat(60));

    while (this.currentAttempt < this.maxAttempts) {
      this.currentAttempt++;
      console.log(`\n🔄 DEPLOYMENT ATTEMPT ${this.currentAttempt}/${this.maxAttempts}`);
      console.log('=' .repeat(40));

      try {
        // Step 1: Debug current deployment state
        await this.debugCurrentState();

        // Step 2: Apply current strategy
        await this.applyDeploymentStrategy();

        // Step 3: Trigger deployment
        await this.triggerDeployment();

        // Step 4: Monitor deployment
        const success = await this.monitorDeployment();

        if (success) {
          console.log('✅ DEPLOYMENT SUCCESS! Railway is serving POS application');
          await this.generateSuccessReport();
          return true;
        }

        // Step 5: Switch strategy for next attempt
        await this.switchStrategy();

      } catch (error) {
        console.log(`❌ Attempt ${this.currentAttempt} failed: ${error.message}`);
        this.deploymentHistory.push({
          attempt: this.currentAttempt,
          strategy: this.deploymentStrategies[this.currentStrategy],
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Wait before next attempt
      console.log('⏳ Waiting 30 seconds before next attempt...');
      await this.sleep(30000);
    }

    console.log('❌ All deployment attempts exhausted');
    await this.generateFailureReport();
    return false;
  }

  async debugCurrentState() {
    console.log('🔍 Debugging current deployment state...');

    // Check if Railway is responding
    const status = await this.checkRailwayStatus();
    console.log(`  📊 Railway Status: ${status.statusCode}`);
    console.log(`  🏪 Has POS: ${status.hasPOS}`);
    console.log(`  🚂 API Placeholder: ${status.hasPlaceholder}`);

    // Check local configuration
    const config = this.checkLocalConfiguration();
    console.log(`  ⚙️ Railway.json: ${config.hasRailwayJson ? '✅' : '❌'}`);
    console.log(`  🐳 Dockerfile: ${config.hasDockerfile ? '✅' : '❌'}`);
    console.log(`  📦 Package.json: ${config.hasValidPackageJson ? '✅' : '❌'}`);

    return { status, config };
  }

  async checkRailwayStatus() {
    return new Promise((resolve) => {
      https.get(this.railwayUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const hasPOS = data.includes('POS') || data.includes('Conejo Negro') || data.includes('inventario');
          const hasPlaceholder = data.includes('Railway API') || data.includes('Home of the Railway API');

          resolve({
            statusCode: res.statusCode,
            hasPOS,
            hasPlaceholder,
            content: data.substring(0, 200)
          });
        });
      }).on('error', (err) => {
        resolve({
          statusCode: 0,
          hasPOS: false,
          hasPlaceholder: false,
          error: err.message
        });
      });
    });
  }

  checkLocalConfiguration() {
    return {
      hasRailwayJson: fs.existsSync('railway.json'),
      hasDockerfile: fs.existsSync('Dockerfile'),
      hasValidPackageJson: fs.existsSync('package.json') && this.validatePackageJson(),
      hasPublicIndex: fs.existsSync('public/index.html')
    };
  }

  validatePackageJson() {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.scripts && pkg.scripts.start && pkg.name;
    } catch {
      return false;
    }
  }

  async applyDeploymentStrategy() {
    const strategy = this.deploymentStrategies[this.currentStrategy];
    console.log(`🔧 Applying strategy: ${strategy}`);

    switch (strategy) {
      case 'minimal-docker':
        await this.applyMinimalDockerStrategy();
        break;
      case 'nixpacks-auto':
        await this.applyNixpacksStrategy();
        break;
      case 'static-serve':
        await this.applyStaticServeStrategy();
        break;
      case 'emergency-fallback':
        await this.applyEmergencyFallbackStrategy();
        break;
    }
  }

  async applyMinimalDockerStrategy() {
    console.log('  🐳 Creating minimal Docker configuration...');

    const dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production --no-audit
COPY . .
RUN adduser -D -s /bin/sh nodeuser
RUN chown -R nodeuser:nodeuser /app
USER nodeuser
EXPOSE 3000
CMD ["npm", "start"]`;

    const railwayJson = {
      "build": { "builder": "dockerfile" },
      "deploy": { "startCommand": "npm start" }
    };

    fs.writeFileSync('Dockerfile', dockerfile);
    fs.writeFileSync('railway.json', JSON.stringify(railwayJson, null, 2));

    this.fixes.push('Applied minimal Docker strategy');
  }

  async applyNixpacksStrategy() {
    console.log('  📦 Creating Nixpacks configuration...');

    const railwayJson = {
      "build": { "builder": "nixpacks" },
      "deploy": { "startCommand": "npm start" }
    };

    // Remove Dockerfile to force Nixpacks
    if (fs.existsSync('Dockerfile')) {
      fs.renameSync('Dockerfile', 'Dockerfile.backup');
    }

    fs.writeFileSync('railway.json', JSON.stringify(railwayJson, null, 2));
    this.fixes.push('Applied Nixpacks strategy');
  }

  async applyStaticServeStrategy() {
    console.log('  🌐 Creating static serve configuration...');

    // Create build script
    const buildScript = `#!/bin/bash
echo "Building static assets..."
mkdir -p dist
cp -r public/* dist/ 2>/dev/null || true
cp *.html dist/ 2>/dev/null || true
echo "Static build complete"`;

    fs.writeFileSync('build.sh', buildScript);

    const railwayJson = {
      "build": {
        "builder": "dockerfile"
      },
      "deploy": {
        "startCommand": "npm start"
      }
    };

    fs.writeFileSync('railway.json', JSON.stringify(railwayJson, null, 2));
    this.fixes.push('Applied static serve strategy');
  }

  async applyEmergencyFallbackStrategy() {
    console.log('  🚨 Creating emergency fallback configuration...');

    // Ultra-minimal package.json
    const emergencyPackage = {
      "name": "pos-emergency",
      "version": "1.0.0",
      "main": "server.js",
      "scripts": {
        "start": "node server.js"
      },
      "dependencies": {
        "express": "^4.18.0"
      }
    };

    // Ultra-minimal server
    const emergencyServer = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.get('/', (req, res) => res.redirect('/online'));
app.get('/online', (req, res) => res.sendFile(__dirname + '/conejo_negro_online.html'));
app.get('/api/health', (req, res) => res.json({status: 'ok'}));

app.listen(port, () => console.log('Emergency server running on', port));`;

    fs.writeFileSync('package.json', JSON.stringify(emergencyPackage, null, 2));
    fs.writeFileSync('server-emergency.js', emergencyServer);

    const railwayJson = {
      "build": { "builder": "nixpacks" },
      "deploy": { "startCommand": "node server-emergency.js" }
    };

    fs.writeFileSync('railway.json', JSON.stringify(railwayJson, null, 2));
    this.fixes.push('Applied emergency fallback strategy');
  }

  async triggerDeployment() {
    console.log('🚀 Triggering Railway deployment...');

    const triggerFile = `deployment-trigger-${this.currentAttempt}.txt`;
    const triggerContent = `Deployment attempt ${this.currentAttempt}
Strategy: ${this.deploymentStrategies[this.currentStrategy]}
Timestamp: ${new Date().toISOString()}
Project: ${this.projectId}`;

    fs.writeFileSync(triggerFile, triggerContent);

    // Git operations
    await this.executeGitOperations(this.currentAttempt);
  }

  async executeGitOperations(attempt) {
    return new Promise((resolve) => {
      const commands = [
        'git add .',
        `git commit -m "Emergency deployment attempt ${attempt} - ${this.deploymentStrategies[this.currentStrategy]}" || echo "No changes"`,
        'git push origin main --force-with-lease'
      ];

      exec(commands.join(' && '), (error, stdout, stderr) => {
        if (stdout) console.log('  📤 Git:', stdout.split('\n')[0]);
        if (stderr && !stderr.includes('No changes')) {
          console.log('  ⚠️ Git warning:', stderr.split('\n')[0]);
        }
        resolve();
      });
    });
  }

  async monitorDeployment() {
    console.log('📡 Monitoring deployment...');

    // Wait for deployment to start
    await this.sleep(45000); // 45 seconds initial wait

    // Check multiple times
    for (let i = 0; i < 8; i++) {
      const status = await this.checkRailwayStatus();
      console.log(`  🔍 Check ${i + 1}/8: Status ${status.statusCode}, POS: ${status.hasPOS ? '✅' : '❌'}, Placeholder: ${status.hasPlaceholder ? '❌' : '✅'}`);

      if (status.hasPOS && !status.hasPlaceholder) {
        return true; // Success!
      }

      await this.sleep(15000); // 15 seconds between checks
    }

    return false; // Failed
  }

  async switchStrategy() {
    this.currentStrategy = (this.currentStrategy + 1) % this.deploymentStrategies.length;
    console.log(`🔄 Switching to strategy: ${this.deploymentStrategies[this.currentStrategy]}`);
  }

  async generateSuccessReport() {
    const report = {
      success: true,
      attempts: this.currentAttempt,
      successfulStrategy: this.deploymentStrategies[this.currentStrategy],
      fixes: this.fixes,
      deploymentHistory: this.deploymentHistory,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('emergency-deployment-success-report.json', JSON.stringify(report, null, 2));
    console.log('\n🎉 SUCCESS REPORT GENERATED');
    console.log(`✅ Deployment successful after ${this.currentAttempt} attempts`);
    console.log(`🏆 Winning strategy: ${this.deploymentStrategies[this.currentStrategy]}`);
  }

  async generateFailureReport() {
    const report = {
      success: false,
      totalAttempts: this.currentAttempt,
      strategiesTested: this.deploymentStrategies,
      fixes: this.fixes,
      deploymentHistory: this.deploymentHistory,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('emergency-deployment-failure-report.json', JSON.stringify(report, null, 2));
    console.log('\n📊 FAILURE REPORT GENERATED');
    console.log(`❌ All ${this.currentAttempt} attempts failed`);
    console.log('🔧 Manual intervention required');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute emergency deployment loop
if (require.main === module) {
  const deploymentLoop = new EmergencyRailwayDeploymentLoop();
  deploymentLoop.startDeploymentLoop().catch(console.error);
}

module.exports = { EmergencyRailwayDeploymentLoop };
/**
 * Automated Trigger System for Deployment Tracking
 * Orchestrates git hooks, Railway monitoring, and memory coordination
 */

const GitHooksManager = require('../hooks/gitHooks');
const RailwayMonitor = require('./railwayMonitor');
const DeploymentMemoryTracker = require('../memory/deploymentTracker');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AutomatedTriggerSystem {
    constructor() {
        this.gitHooks = new GitHooksManager();
        this.railwayMonitor = new RailwayMonitor();
        this.memoryTracker = new DeploymentMemoryTracker();
        this.isInitialized = false;
        
        this.initialize();
    }

    /**
     * Initialize the automated trigger system
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('[HIVE-MIND] Initializing automated trigger system...');

            // Initialize memory system
            await this.memoryTracker.initializeMemorySystem();

            // Install git hooks
            await this.gitHooks.installHooks();

            // Start Railway monitoring
            this.railwayMonitor.startMonitoring(15000); // Check every 15 seconds

            // Set up process event handlers
            this.setupProcessHandlers();

            // Create trigger script
            await this.createTriggerScript();

            this.isInitialized = true;
            console.log('[HIVE-MIND] Automated trigger system initialized successfully');

            // Log initialization
            await this.logSystemEvent('system-initialized', {
                timestamp: new Date().toISOString(),
                gitHooksStatus: await this.gitHooks.checkHooksStatus(),
                railwayMonitorStatus: this.railwayMonitor.getMonitoringStatus()
            });

        } catch (error) {
            console.error('[HIVE-MIND] Failed to initialize automated trigger system:', error);
            throw error;
        }
    }

    /**
     * Setup process event handlers for cleanup
     */
    setupProcessHandlers() {
        const cleanup = () => {
            console.log('[HIVE-MIND] Shutting down automated trigger system...');
            this.railwayMonitor.stopMonitoring();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
    }

    /**
     * Create a trigger script for manual deployment tracking
     */
    async createTriggerScript() {
        const scriptContent = `#!/usr/bin/env node
/**
 * Manual Deployment Trigger Script
 * Use this script to manually trigger deployment tracking
 */

const AutomatedTriggerSystem = require('./src/services/automatedTrigger');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const trigger = new AutomatedTriggerSystem();
    await trigger.initialize();

    switch (command) {
        case 'track-push':
            const commitHash = args[1] || 'HEAD';
            await trigger.triggerDeploymentTracking(commitHash);
            break;
            
        case 'check-status':
            const status = await trigger.getSystemStatus();
            console.log(JSON.stringify(status, null, 2));
            break;
            
        case 'install-hooks':
            await trigger.reinstallHooks();
            break;
            
        case 'monitor-status':
            const monitorStatus = trigger.railwayMonitor.getMonitoringStatus();
            console.log(JSON.stringify(monitorStatus, null, 2));
            break;
            
        case 'deployment-stats':
            const days = parseInt(args[1]) || 30;
            const stats = await trigger.memoryTracker.getDeploymentStats(days);
            console.log(JSON.stringify(stats, null, 2));
            break;
            
        case 'query-deployments':
            const limit = parseInt(args[1]) || 10;
            const deployments = await trigger.memoryTracker.queryDeployments({ limit });
            console.log(JSON.stringify(deployments, null, 2));
            break;
            
        default:
            console.log(\`
Usage: node trigger-deployment.js <command> [args]

Commands:
  track-push [commit-hash]     Track a git push and deployment
  check-status                 Get system status
  install-hooks               Reinstall git hooks
  monitor-status              Get Railway monitoring status
  deployment-stats [days]     Get deployment statistics
  query-deployments [limit]   Query recent deployments

Examples:
  node trigger-deployment.js track-push
  node trigger-deployment.js track-push abc123
  node trigger-deployment.js deployment-stats 7
  node trigger-deployment.js query-deployments 5
\`);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AutomatedTriggerSystem };
`;

        const scriptPath = path.join(process.cwd(), 'trigger-deployment.js');
        await fs.writeFile(scriptPath, scriptContent);
        
        // Make executable on Unix systems
        if (process.platform !== 'win32') {
            execSync(`chmod +x "${scriptPath}"`);
        }

        console.log('[HIVE-MIND] Created trigger script: trigger-deployment.js');
    }

    /**
     * Trigger deployment tracking manually
     */
    async triggerDeploymentTracking(commitHash = null) {
        try {
            const commit = commitHash || this.getCurrentCommitHash();
            console.log(`[HIVE-MIND] Triggering deployment tracking for commit: ${commit}`);

            // Track git push
            const gitOpId = await this.memoryTracker.trackGitPush(commit, 'main', 'origin');
            console.log(`[HIVE-MIND] Git operation tracked: ${gitOpId}`);

            // Create Railway deployment entry
            const deploymentId = await this.memoryTracker.trackRailwayDeployment(gitOpId, {
                status: 'pending',
                environment: 'production',
                triggers: ['manual-trigger'],
                timestamp: new Date().toISOString()
            });
            console.log(`[HIVE-MIND] Railway deployment tracking initiated: ${deploymentId}`);

            // Log the trigger event
            await this.logSystemEvent('manual-trigger', {
                commitHash: commit,
                gitOpId,
                deploymentId,
                timestamp: new Date().toISOString()
            });

            // Force immediate monitoring check
            setTimeout(() => {
                this.railwayMonitor.checkDeploymentStatus();
            }, 3000);

            return { gitOpId, deploymentId };

        } catch (error) {
            console.error('[HIVE-MIND] Error triggering deployment tracking:', error);
            throw error;
        }
    }

    /**
     * Get current system status
     */
    async getSystemStatus() {
        return {
            initialized: this.isInitialized,
            gitHooks: await this.gitHooks.checkHooksStatus(),
            railwayMonitor: this.railwayMonitor.getMonitoringStatus(),
            recentDeployments: await this.memoryTracker.queryDeployments({ limit: 5 }),
            deploymentStats: await this.memoryTracker.getDeploymentStats(7),
            systemHealth: {
                timestamp: new Date().toISOString(),
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
    }

    /**
     * Reinstall git hooks
     */
    async reinstallHooks() {
        await this.gitHooks.removeHooks();
        await this.gitHooks.installHooks();
        console.log('[HIVE-MIND] Git hooks reinstalled');
    }

    /**
     * Set up automatic triggers for CI/CD integration
     */
    async setupCITriggers() {
        // Create GitHub Actions workflow
        const workflowContent = `name: Hive-Mind Deployment Tracking

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  track-deployment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Track deployment
        run: node trigger-deployment.js track-push \${{ github.sha }}
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
          RAILWAY_PROJECT_ID: \${{ secrets.RAILWAY_PROJECT_ID }}
          RAILWAY_SERVICE_ID: \${{ secrets.RAILWAY_SERVICE_ID }}
          RAILWAY_APP_URL: \${{ secrets.RAILWAY_APP_URL }}
`;

        const workflowDir = path.join(process.cwd(), '.github', 'workflows');
        await fs.mkdir(workflowDir, { recursive: true });
        
        const workflowPath = path.join(workflowDir, 'hive-mind-tracking.yml');
        await fs.writeFile(workflowPath, workflowContent);
        
        console.log('[HIVE-MIND] GitHub Actions workflow created');
    }

    /**
     * Log system events
     */
    async logSystemEvent(event, data) {
        try {
            const logEntry = {
                event,
                data,
                timestamp: new Date().toISOString(),
                sessionId: process.env.HIVE_SESSION_ID || `session-${Date.now()}`
            };

            const logPath = path.join(process.cwd(), '.hive-mind', 'logs', 'system-events.jsonl');
            await fs.mkdir(path.dirname(logPath), { recursive: true });
            await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');

        } catch (error) {
            console.error('[HIVE-MIND] Error logging system event:', error);
        }
    }

    /**
     * Get current commit hash
     */
    getCurrentCommitHash() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch {
            return 'unknown';
        }
    }

    /**
     * Export deployment report
     */
    async exportDeploymentReport(days = 30) {
        const stats = await this.memoryTracker.getDeploymentStats(days);
        const deployments = await this.memoryTracker.queryDeployments({ 
            limit: 100,
            dateFrom: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString()
        });

        const report = {
            reportGeneratedAt: new Date().toISOString(),
            periodDays: days,
            statistics: stats,
            deployments: deployments.map(d => ({
                id: d.id,
                status: d.status,
                timestamp: d.timestamp,
                environment: d.environment,
                buildDuration: d.buildDuration,
                deploymentUrl: d.deploymentUrl
            })),
            systemStatus: await this.getSystemStatus()
        };

        const reportPath = path.join(process.cwd(), '.hive-mind', 'exports', `deployment-report-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`[HIVE-MIND] Deployment report exported: ${reportPath}`);
        return reportPath;
    }
}

module.exports = AutomatedTriggerSystem;
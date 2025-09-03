#!/usr/bin/env node
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
            console.log(`
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
`);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AutomatedTriggerSystem };

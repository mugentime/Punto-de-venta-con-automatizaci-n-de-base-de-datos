#!/usr/bin/env node
/**
 * Hive-Mind Initialization Script
 * Initializes the automated deployment tracking system
 */

const AutomatedTriggerSystem = require('./src/services/automatedTrigger');

async function initializeHiveMind() {
    console.log('[HIVE-MIND] Starting initialization...');
    
    try {
        const trigger = new AutomatedTriggerSystem();
        await trigger.initialize();
        
        console.log('[HIVE-MIND] ✓ System initialized successfully');
        console.log('[HIVE-MIND] ✓ Git hooks installed');
        console.log('[HIVE-MIND] ✓ Railway monitoring started');
        console.log('[HIVE-MIND] ✓ Memory system configured');
        console.log('[HIVE-MIND] ✓ Trigger script created');
        
        // Get initial status
        const status = await trigger.getSystemStatus();
        console.log('\nSystem Status:');
        console.log('- Git hooks:', JSON.stringify(status.gitHooks, null, 2));
        console.log('- Railway monitor:', status.railwayMonitor.isMonitoring ? 'Running' : 'Stopped');
        console.log('- Recent deployments:', status.recentDeployments.length);
        
        // Keep alive for 10 seconds to let monitoring start
        setTimeout(() => {
            console.log('\n[HIVE-MIND] Initialization complete. Use npm run hive:* commands for management.');
            process.exit(0);
        }, 3000);
        
    } catch (error) {
        console.error('[HIVE-MIND] Initialization failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    initializeHiveMind();
}

module.exports = initializeHiveMind;
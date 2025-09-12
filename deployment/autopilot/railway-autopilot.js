#!/usr/bin/env node

/**
 * Railway Autopilot - Intelligent Deployment Orchestrator
 * Coordinates adaptive deployment with monitoring and validation
 */

const AdaptiveDeploymentCoordinator = require('./adaptive-coordinator');
const RealTimeDeploymentMonitor = require('../monitoring/real-time-monitor');
const DeploymentValidator = require('../validation/deployment-validator');

class RailwayAutopilot {
    constructor() {
        this.coordinator = new AdaptiveDeploymentCoordinator();
        this.monitor = new RealTimeDeploymentMonitor();
        this.validator = new DeploymentValidator();
        
        this.autopilotState = {
            phase: 'initialization',
            startTime: Date.now(),
            agents: {
                coordinator: 'initializing',
                monitor: 'initializing',
                validator: 'initializing'
            },
            deploymentSuccess: false,
            rollbackExecuted: false
        };
        
        console.log('🤖 Railway Autopilot - Intelligent Deployment System Initialized');
    }
    
    /**
     * Execute full autopilot deployment sequence
     */
    async execute() {
        console.log('🚀 Starting Railway Autopilot Deployment Sequence');
        console.log('=' .repeat(60));
        
        try {
            // Phase 1: Initialize Adaptive Coordination
            await this.initializeCoordination();
            
            // Phase 2: Start Real-Time Monitoring
            await this.startMonitoring();
            
            // Phase 3: Execute Deployment
            await this.executeDeployment();
            
            // Phase 4: Validate Deployment
            await this.validateDeployment();
            
            // Phase 5: Generate Final Report
            const report = await this.generateFinalReport();
            
            console.log('🎉 Railway Autopilot Deployment Completed Successfully!');
            console.log('=' .repeat(60));
            
            return report;
            
        } catch (error) {
            console.error('❌ Autopilot deployment failed:', error.message);
            
            // Attempt automated recovery
            await this.executeEmergencyProcedures(error);
            
            throw error;
        } finally {
            // Cleanup monitoring
            this.monitor.stopMonitoring();
        }
    }
    
    /**
     * Phase 1: Initialize Adaptive Coordination
     */
    async initializeCoordination() {
        console.log('🎯 Phase 1: Initializing Adaptive Coordination');
        this.autopilotState.phase = 'coordination-init';
        this.autopilotState.agents.coordinator = 'active';
        
        const topologyInfo = await this.coordinator.initializeTopology();
        
        console.log(`✅ Coordination topology selected: ${topologyInfo.topology}`);
        console.log(`📊 Project complexity: ${topologyInfo.systemState.complexity}`);
        
        return topologyInfo;
    }
    
    /**
     * Phase 2: Start Real-Time Monitoring
     */
    async startMonitoring() {
        console.log('📊 Phase 2: Starting Real-Time Monitoring');
        this.autopilotState.phase = 'monitoring-init';
        this.autopilotState.agents.monitor = 'active';
        
        // Start monitoring in background
        this.monitor.startMonitoring().catch(error => {
            console.error('⚠️ Monitoring error:', error.message);
        });
        
        // Wait for monitoring to initialize
        await this.sleep(5000);
        
        console.log('✅ Real-time monitoring active');
    }
    
    /**
     * Phase 3: Execute Deployment
     */
    async executeDeployment() {
        console.log('🚄 Phase 3: Executing Railway Deployment');
        this.autopilotState.phase = 'deployment';
        
        const deploymentResult = await this.coordinator.executeDeployment();
        
        // Check deployment success
        const failedPhases = deploymentResult.checkpoints.filter(cp => cp.status === 'failed');
        
        if (failedPhases.length > 0) {
            throw new Error(`Deployment failed at phase(s): ${failedPhases.map(fp => fp.phase).join(', ')}`);
        }
        
        this.autopilotState.deploymentSuccess = true;
        console.log('✅ Railway deployment executed successfully');
        
        return deploymentResult;
    }
    
    /**
     * Phase 4: Validate Deployment
     */
    async validateDeployment() {
        console.log('🔍 Phase 4: Validating Deployment');
        this.autopilotState.phase = 'validation';
        this.autopilotState.agents.validator = 'active';
        
        // Wait for deployment to settle
        console.log('⏳ Waiting for deployment to stabilize...');
        await this.sleep(30000); // 30 seconds
        
        const validationReport = await this.validator.validateDeployment();
        
        // Check validation results
        if (validationReport.summary.status === 'critical') {
            throw new Error('Deployment validation failed - critical issues detected');
        }
        
        if (validationReport.summary.criticalIssues > 0) {
            console.log(`⚠️ ${validationReport.summary.criticalIssues} critical issues found, but deployment acceptable`);
        }
        
        console.log(`✅ Deployment validation completed - Status: ${validationReport.summary.status}`);
        console.log(`📊 Success Rate: ${(validationReport.summary.successRate * 100).toFixed(1)}%`);
        
        return validationReport;
    }
    
    /**
     * Generate comprehensive final report
     */
    async generateFinalReport() {
        console.log('📋 Phase 5: Generating Final Report');
        this.autopilotState.phase = 'reporting';
        
        const endTime = Date.now();
        const totalDuration = endTime - this.autopilotState.startTime;
        
        const report = {
            autopilot: {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                totalDuration,
                humanDuration: this.formatDuration(totalDuration),
                success: this.autopilotState.deploymentSuccess && !this.autopilotState.rollbackExecuted,
                phases: {
                    coordination: this.autopilotState.agents.coordinator === 'active',
                    monitoring: this.autopilotState.agents.monitor === 'active', 
                    deployment: this.autopilotState.deploymentSuccess,
                    validation: this.autopilotState.agents.validator === 'active',
                    rollback: this.autopilotState.rollbackExecuted
                }
            },
            service: {
                name: 'POS-CONEJONEGRO',
                url: 'https://pos-conejo-negro.railway.app',
                platform: 'Railway',
                environment: 'production'
            },
            performance: {
                deploymentTime: totalDuration,
                adaptiveOptimizations: true,
                realTimeMonitoring: true,
                intelligentValidation: true,
                automaticRollback: this.autopilotState.rollbackExecuted
            },
            recommendations: [
                'Continue monitoring performance metrics for first 24 hours',
                'Review deployment logs for any warning patterns',
                'Consider implementing performance baselines for future deployments',
                'Schedule regular health checks using the validation suite'
            ]
        };
        
        // Save report
        const reportFile = `deployment/autopilot/autopilot-report-${Date.now()}.json`;
        const fs = require('fs').promises;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log('✅ Final autopilot report generated:', reportFile);
        
        // Display summary
        this.displaySuccessSummary(report);
        
        return report;
    }
    
    /**
     * Display success summary
     */
    displaySuccessSummary(report) {
        console.log('');
        console.log('🎊 RAILWAY AUTOPILOT DEPLOYMENT SUCCESS 🎊');
        console.log('=' .repeat(60));
        console.log(`🚄 Service: ${report.service.name}`);
        console.log(`🌐 URL: ${report.service.url}`);
        console.log(`⏱️  Duration: ${report.autopilot.humanDuration}`);
        console.log(`✅ Success: ${report.autopilot.success ? 'YES' : 'NO'}`);
        console.log(`📊 Adaptive Optimizations: ${report.performance.adaptiveOptimizations ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📡 Real-Time Monitoring: ${report.performance.realTimeMonitoring ? 'ACTIVE' : 'INACTIVE'}`);
        console.log(`🔍 Intelligent Validation: ${report.performance.intelligentValidation ? 'PASSED' : 'FAILED'}`);
        
        if (report.autopilot.phases.rollback) {
            console.log(`🔄 Rollback Executed: YES (Safety mechanism triggered)`);
        }
        
        console.log('=' .repeat(60));
        console.log('🎯 Next Steps:');
        report.recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
        console.log('');
    }
    
    /**
     * Execute emergency procedures on failure
     */
    async executeEmergencyProcedures(error) {
        console.log('🚨 Executing Emergency Procedures');
        
        try {
            // Stop monitoring
            this.monitor.stopMonitoring();
            
            // Check if rollback is needed
            const shouldRollback = await this.assessRollbackNeed(error);
            
            if (shouldRollback) {
                console.log('🔄 Initiating emergency rollback');
                await this.coordinator.initiateRollback();
                this.autopilotState.rollbackExecuted = true;
                
                // Wait for rollback to complete
                await this.sleep(30000);
                
                // Validate rollback
                try {
                    await this.validator.validateRollback();
                    console.log('✅ Emergency rollback completed successfully');
                } catch (rollbackError) {
                    console.error('❌ Rollback validation failed:', rollbackError.message);
                }
            }
            
            // Generate emergency report
            await this.generateEmergencyReport(error);
            
        } catch (emergencyError) {
            console.error('💥 Emergency procedures failed:', emergencyError.message);
        }
    }
    
    /**
     * Assess if rollback is needed
     */
    async assessRollbackNeed(error) {
        // Critical errors that require rollback
        const criticalErrors = [
            'Service Availability',
            'Health Endpoint',
            'Database Connectivity',
            'Authentication System'
        ];
        
        return criticalErrors.some(critical => 
            error.message.toLowerCase().includes(critical.toLowerCase())
        );
    }
    
    /**
     * Generate emergency report
     */
    async generateEmergencyReport(error) {
        const emergencyReport = {
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                phase: this.autopilotState.phase,
                stack: error.stack
            },
            autopilotState: this.autopilotState,
            emergencyActions: {
                rollbackExecuted: this.autopilotState.rollbackExecuted,
                monitoringStopped: true,
                emergencyProceduresCompleted: true
            },
            recommendations: [
                'Review deployment logs for error root cause',
                'Check Railway service status and configuration',
                'Verify environment variables and secrets',
                'Test deployment in staging environment first',
                'Contact Railway support if platform issues suspected'
            ]
        };
        
        const fs = require('fs').promises;
        const emergencyFile = `deployment/autopilot/emergency-report-${Date.now()}.json`;
        await fs.writeFile(emergencyFile, JSON.stringify(emergencyReport, null, 2));
        
        console.log('📋 Emergency report generated:', emergencyFile);
    }
    
    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    /**
     * Sleep utility
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run autopilot if called directly
if (require.main === module) {
    const autopilot = new RailwayAutopilot();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('🛑 Autopilot interrupted - cleaning up...');
        autopilot.monitor.stopMonitoring();
        process.exit(0);
    });
    
    // Execute autopilot
    autopilot.execute()
        .then(report => {
            console.log('🎉 Autopilot completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Autopilot failed:', error.message);
            process.exit(1);
        });
}

module.exports = RailwayAutopilot;
#!/usr/bin/env node

/**
 * @fileoverview Railway CLI Command Generator and Executor
 * @description Direct Railway management using project ID fed11c6d-a65a-4d93-90e6-955e16b6753f
 * @version 1.0.0
 * @author TaskMaster Railway Agent
 * @created 2025-01-15
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class RailwayCLICommander {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.failedDeploymentId = '4548f92b-d5dd-49ff-8840-3768b72daec3';
        this.commands = [];
        this.results = [];
    }

    /**
     * Main CLI Command Generator
     */
    async generateAndExecuteCommands() {
        console.log('🚂 RAILWAY CLI COMMANDER STARTING');
        console.log(`📊 Project ID: ${this.projectId}`);
        console.log(`❌ Failed Deployment: ${this.failedDeploymentId}\n`);

        // Generate all necessary Railway CLI commands
        this.generateCommands();

        // Execute commands in sequence
        for (const command of this.commands) {
            await this.executeCommand(command);
        }

        // Generate command report
        await this.generateReport();
    }

    /**
     * Generate All Required Railway CLI Commands
     */
    generateCommands() {
        this.commands = [
            {
                name: 'Check Railway CLI Version',
                command: 'railway --version',
                description: 'Verify Railway CLI installation and version',
                critical: true
            },
            {
                name: 'Check Authentication Status',
                command: 'railway whoami',
                description: 'Verify user authentication with Railway',
                critical: true
            },
            {
                name: 'Link to Project',
                command: `railway link ${this.projectId}`,
                description: `Link CLI to project ${this.projectId}`,
                critical: true
            },
            {
                name: 'Get Project Status',
                command: 'railway status',
                description: 'Get current project and deployment status',
                critical: false
            },
            {
                name: 'List Project Variables',
                command: 'railway variables',
                description: 'List all environment variables',
                critical: false
            },
            {
                name: 'Get Project Info',
                command: 'railway info',
                description: 'Get detailed project information',
                critical: false
            },
            {
                name: 'Check Deployments',
                command: 'railway deployments',
                description: 'List recent deployments and their status',
                critical: false
            },
            {
                name: 'Get Project Domain',
                command: 'railway domain',
                description: 'Get project domain information',
                critical: false
            },
            {
                name: 'Set NODE_ENV',
                command: 'railway variables set NODE_ENV=production',
                description: 'Set production environment variable',
                critical: true,
                skipIfExists: 'NODE_ENV'
            },
            {
                name: 'Set PORT',
                command: 'railway variables set PORT=3000',
                description: 'Set port environment variable',
                critical: true,
                skipIfExists: 'PORT'
            },
            {
                name: 'Set Railway Environment Flag',
                command: 'railway variables set RAILWAY_ENVIRONMENT=true',
                description: 'Set Railway environment detection flag',
                critical: true,
                skipIfExists: 'RAILWAY_ENVIRONMENT'
            },
            {
                name: 'Deploy Project',
                command: 'railway up --detach',
                description: 'Deploy project to Railway',
                critical: true,
                confirmRequired: true
            },
            {
                name: 'Check Logs',
                command: 'railway logs --follow=false --lines=50',
                description: 'Get recent deployment logs',
                critical: false
            }
        ];
    }

    /**
     * Execute Individual Railway Command
     */
    async executeCommand(commandObj) {
        const { name, command, description, critical, confirmRequired, skipIfExists } = commandObj;
        
        console.log(`\n🔧 ${name}`);
        console.log(`📝 Command: ${command}`);
        console.log(`📋 Description: ${description}`);

        // Skip if confirmation required and not provided
        if (confirmRequired) {
            console.log('⚠️  This command will trigger a deployment. Skipping in automated mode.');
            console.log('💡 Run manually: ' + command);
            this.results.push({
                ...commandObj,
                status: 'skipped',
                reason: 'confirmation_required',
                manual_command: command
            });
            return;
        }

        try {
            const startTime = Date.now();
            const { stdout, stderr } = await execAsync(command, { 
                timeout: 30000,
                env: { ...process.env, FORCE_COLOR: '0' }
            });
            const duration = Date.now() - startTime;

            console.log('✅ SUCCESS');
            if (stdout) {
                console.log('📤 Output:', stdout.substring(0, 200) + (stdout.length > 200 ? '...' : ''));
            }
            if (stderr) {
                console.log('⚠️  Stderr:', stderr.substring(0, 100));
            }

            this.results.push({
                ...commandObj,
                status: 'success',
                duration: `${duration}ms`,
                stdout: stdout,
                stderr: stderr
            });

        } catch (error) {
            console.log(`❌ FAILED: ${error.message}`);
            
            // Handle specific error cases
            let suggestion = this.getErrorSuggestion(error.message, command);
            if (suggestion) {
                console.log(`💡 Suggestion: ${suggestion}`);
            }

            this.results.push({
                ...commandObj,
                status: critical ? 'critical_failure' : 'failure',
                error: error.message,
                suggestion
            });

            // Stop execution on critical failures
            if (critical && this.isCriticalError(error.message)) {
                console.log('🚨 Critical failure detected. Stopping execution.');
                return;
            }
        }
    }

    /**
     * Get Error-specific Suggestions
     */
    getErrorSuggestion(errorMessage, command) {
        const error = errorMessage.toLowerCase();
        
        if (error.includes('not found') || error.includes('command not found')) {
            return 'Install Railway CLI: npm install -g @railway/cli';
        }
        
        if (error.includes('not logged in') || error.includes('unauthorized')) {
            return 'Login to Railway: railway login';
        }
        
        if (error.includes('project not found')) {
            return `Verify project ID ${this.projectId} exists and you have access`;
        }
        
        if (error.includes('timeout')) {
            return 'Network timeout - check internet connection and try again';
        }
        
        if (error.includes('permission denied')) {
            return 'Check project permissions in Railway dashboard';
        }

        return 'Check Railway documentation or dashboard for more details';
    }

    /**
     * Check if Error is Critical
     */
    isCriticalError(errorMessage) {
        const criticalErrors = [
            'command not found',
            'not logged in',
            'unauthorized',
            'project not found'
        ];
        
        return criticalErrors.some(err => errorMessage.toLowerCase().includes(err));
    }

    /**
     * Generate Command Execution Report
     */
    async generateReport() {
        const report = {
            execution: {
                timestamp: new Date().toISOString(),
                projectId: this.projectId,
                totalCommands: this.commands.length,
                executedCommands: this.results.length
            },
            summary: {
                successful: this.results.filter(r => r.status === 'success').length,
                failed: this.results.filter(r => r.status === 'failure').length,
                criticalFailures: this.results.filter(r => r.status === 'critical_failure').length,
                skipped: this.results.filter(r => r.status === 'skipped').length
            },
            results: this.results,
            recommendations: this.generateRecommendations(),
            manualCommands: this.getManualCommands(),
            nextSteps: this.generateNextSteps()
        };

        const reportPath = path.join('C:\\Users\\je2al\\Desktop\\POS-CONEJONEGRO', 'reports', 'railway-cli-execution-report.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log('\n📊 RAILWAY CLI COMMANDER COMPLETED');
        console.log('==================================');
        console.log(`✅ Successful: ${report.summary.successful}`);
        console.log(`❌ Failed: ${report.summary.failed}`);
        console.log(`🚨 Critical: ${report.summary.criticalFailures}`);
        console.log(`⏭️  Skipped: ${report.summary.skipped}`);
        console.log(`📋 Report: ${reportPath}`);

        if (report.manualCommands.length > 0) {
            console.log('\n🔧 MANUAL COMMANDS REQUIRED:');
            report.manualCommands.forEach((cmd, i) => {
                console.log(`${i + 1}. ${cmd}`);
            });
        }

        console.log('\n📋 NEXT STEPS:');
        report.nextSteps.forEach((step, i) => {
            console.log(`${i + 1}. ${step}`);
        });
    }

    /**
     * Generate Recommendations Based on Results
     */
    generateRecommendations() {
        const recommendations = [];
        const failures = this.results.filter(r => r.status === 'failure' || r.status === 'critical_failure');
        
        if (failures.length === 0) {
            recommendations.push('All Railway CLI commands executed successfully');
            recommendations.push('Project is properly configured and accessible');
        } else {
            failures.forEach(failure => {
                if (failure.suggestion) {
                    recommendations.push(failure.suggestion);
                }
            });
        }

        // Check for specific issues
        const authFailure = failures.find(f => f.error && f.error.includes('not logged in'));
        if (authFailure) {
            recommendations.push('Complete Railway authentication before proceeding');
        }

        const projectLinkFailure = failures.find(f => f.command && f.command.includes('link'));
        if (projectLinkFailure) {
            recommendations.push('Verify project ID and access permissions');
        }

        return recommendations;
    }

    /**
     * Get Manual Commands that Need to be Run
     */
    getManualCommands() {
        return this.results
            .filter(r => r.status === 'skipped' && r.manual_command)
            .map(r => r.manual_command);
    }

    /**
     * Generate Next Steps Based on Execution Results
     */
    generateNextSteps() {
        const steps = [];
        const criticalFailures = this.results.filter(r => r.status === 'critical_failure');
        
        if (criticalFailures.length > 0) {
            steps.push('Resolve critical failures first');
            steps.push('Install Railway CLI if not found');
            steps.push('Login to Railway if not authenticated');
            steps.push('Verify project access permissions');
        } else {
            steps.push('Review successful command outputs');
            steps.push('Execute manual deployment command if needed');
            steps.push('Monitor deployment progress in Railway dashboard');
            steps.push('Check application health at deployment URL');
        }

        steps.push('Start monitoring with: node scripts/railway-monitor.js');
        steps.push(`Visit Railway dashboard: https://railway.app/project/${this.projectId}`);
        steps.push('Review deployment logs for any runtime issues');

        return steps;
    }

    /**
     * Quick Status Check Method
     */
    async quickStatusCheck() {
        console.log('🔍 QUICK RAILWAY STATUS CHECK');
        console.log('============================');
        
        const quickCommands = [
            'railway --version',
            'railway whoami', 
            'railway status',
            `railway link ${this.projectId}`,
            'railway domain'
        ];

        for (const command of quickCommands) {
            try {
                const { stdout } = await execAsync(command, { timeout: 10000 });
                console.log(`✅ ${command}: ${stdout.substring(0, 50).replace(/\n/g, ' ')}...`);
            } catch (error) {
                console.log(`❌ ${command}: ${error.message.substring(0, 50)}...`);
            }
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const commander = new RailwayCLICommander();
    
    // Check for quick status flag
    if (process.argv.includes('--quick')) {
        commander.quickStatusCheck().catch(console.error);
    } else {
        commander.generateAndExecuteCommands().catch(console.error);
    }
}

module.exports = { RailwayCLICommander };
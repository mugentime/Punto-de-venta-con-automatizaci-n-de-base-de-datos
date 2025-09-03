#!/usr/bin/env node

/**
 * Railway Monitor Service Orchestrator
 * Manages all monitoring components as a unified service
 */

const RailwayMonitor = require('./railway-monitor');
const AlertSystem = require('./alert-system');
const HealthDashboard = require('./health-dashboard');
const fs = require('fs').promises;
const path = require('path');

class MonitorService {
    constructor(config = {}) {
        this.config = {
            enableDashboard: true,
            enableAlerts: true,
            dashboardPort: 8080,
            configFile: path.join(__dirname, '../../config/monitoring/monitor-config.json'),
            logDir: path.join(__dirname, '../../logs/monitoring'),
            pidFile: path.join(__dirname, '../../logs/monitoring/monitor.pid'),
            ...config
        };

        this.components = {};
        this.isRunning = false;
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(this.config.configFile, 'utf8');
            const fileConfig = JSON.parse(configData);
            this.config = { ...this.config, ...fileConfig };
            console.log('⚙️  Configuration loaded from file');
        } catch (error) {
            console.log('⚙️  Using default configuration (config file not found)');
            await this.saveDefaultConfig();
        }
    }

    async saveDefaultConfig() {
        const defaultConfig = {
            appUrl: 'https://pos-conejonegro-production.up.railway.app',
            healthEndpoint: '/api/health',
            checkInterval: 60000,
            timeout: 10000,
            alertThreshold: 3,
            enableDashboard: true,
            enableAlerts: true,
            dashboardRefreshInterval: 30000,
            webhookUrls: [],
            notifications: {
                console: true,
                file: true,
                webhook: false
            }
        };

        try {
            await fs.mkdir(path.dirname(this.config.configFile), { recursive: true });
            await fs.writeFile(this.config.configFile, JSON.stringify(defaultConfig, null, 2));
            console.log('⚙️  Default configuration saved');
        } catch (error) {
            console.error('❌ Failed to save default configuration:', error.message);
        }
    }

    async init() {
        console.log('🚀 Initializing Railway Monitor Service...');
        
        await this.loadConfig();
        
        // Initialize components
        this.components.monitor = new RailwayMonitor({
            appUrl: this.config.appUrl,
            healthEndpoint: this.config.healthEndpoint,
            checkInterval: this.config.checkInterval,
            timeout: this.config.timeout,
            alertThreshold: this.config.alertThreshold,
            logDir: this.config.logDir
        });

        if (this.config.enableAlerts) {
            this.components.alerts = new AlertSystem({
                logDir: this.config.logDir,
                webhookUrls: this.config.webhookUrls || [],
                enableConsoleAlerts: this.config.notifications?.console ?? true,
                enableFileAlerts: this.config.notifications?.file ?? true,
                enableWebhookAlerts: this.config.notifications?.webhook ?? false
            });
        }

        if (this.config.enableDashboard) {
            this.components.dashboard = new HealthDashboard({
                logDir: this.config.logDir,
                refreshInterval: this.config.dashboardRefreshInterval || 30000
            });
        }

        // Initialize all components
        await this.components.monitor.init();
        
        if (this.components.dashboard) {
            await this.components.dashboard.init();
        }

        // Set up cross-component communication
        this.setupEventHandlers();

        console.log('✅ Monitor service initialized successfully');
    }

    setupEventHandlers() {
        // Override monitor's alert trigger to use our alert system
        if (this.components.alerts && this.components.monitor) {
            const originalTriggerAlert = this.components.monitor.triggerAlert.bind(this.components.monitor);
            this.components.monitor.triggerAlert = async (type, details) => {
                // Call original method
                await originalTriggerAlert(type, details);
                
                // Also send through alert system
                const alert = {
                    id: Date.now().toString(),
                    type,
                    timestamp: new Date().toISOString(),
                    details
                };
                
                await this.components.alerts.sendAlert(alert);
            };
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Service is already running');
            return;
        }

        console.log('🚀 Starting Railway Monitor Service...');
        
        // Write PID file
        await this.writePidFile();
        
        // Start monitoring
        this.components.monitor.start();
        
        // Start dashboard auto-generation
        if (this.components.dashboard) {
            this.components.dashboard.startAutoGeneration();
        }

        this.isRunning = true;
        
        // Set up graceful shutdown handlers
        this.setupShutdownHandlers();
        
        console.log('✅ Railway Monitor Service started successfully');
        console.log('📊 Monitor Status:');
        console.log(`   App URL: ${this.config.appUrl}`);
        console.log(`   Check Interval: ${this.config.checkInterval / 1000}s`);
        console.log(`   Alerts: ${this.config.enableAlerts ? 'Enabled' : 'Disabled'}`);
        console.log(`   Dashboard: ${this.config.enableDashboard ? 'Enabled' : 'Disabled'}`);
        console.log(`   Log Directory: ${this.config.logDir}`);
        
        if (this.components.dashboard) {
            const dashboardPath = path.join(this.components.dashboard.config.outputDir, 'index.html');
            console.log(`   Dashboard: file://${dashboardPath}`);
        }
    }

    async stop() {
        if (!this.isRunning) {
            console.log('⚠️  Service is not running');
            return;
        }

        console.log('🛑 Stopping Railway Monitor Service...');
        
        // Stop monitoring
        if (this.components.monitor) {
            this.components.monitor.stop();
        }
        
        // Generate final report
        if (this.components.monitor) {
            await this.components.monitor.generateReport();
        }
        
        if (this.components.dashboard) {
            await this.components.dashboard.generateDashboard();
        }

        // Remove PID file
        await this.removePidFile();
        
        this.isRunning = false;
        console.log('✅ Service stopped successfully');
    }

    async restart() {
        console.log('🔄 Restarting Railway Monitor Service...');
        await this.stop();
        await this.start();
    }

    async getStatus() {
        const status = {
            isRunning: this.isRunning,
            config: this.config,
            components: {
                monitor: this.components.monitor ? await this.components.monitor.getStatus() : null,
                alerts: !!this.components.alerts,
                dashboard: !!this.components.dashboard
            }
        };

        if (this.components.monitor) {
            status.monitoring = await this.components.monitor.getStatus();
        }

        return status;
    }

    async writePidFile() {
        try {
            await fs.mkdir(path.dirname(this.config.pidFile), { recursive: true });
            await fs.writeFile(this.config.pidFile, process.pid.toString());
        } catch (error) {
            console.error('⚠️  Failed to write PID file:', error.message);
        }
    }

    async removePidFile() {
        try {
            await fs.unlink(this.config.pidFile);
        } catch (error) {
            // File doesn't exist, that's fine
        }
    }

    async isAlreadyRunning() {
        try {
            const pidData = await fs.readFile(this.config.pidFile, 'utf8');
            const pid = parseInt(pidData.trim());
            
            // Check if process is still running
            try {
                process.kill(pid, 0); // Signal 0 just checks if process exists
                return pid;
            } catch (error) {
                // Process doesn't exist, remove stale PID file
                await this.removePidFile();
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        process.on('uncaughtException', async (error) => {
            console.error('💥 Uncaught Exception:', error);
            await this.stop();
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            await this.stop();
            process.exit(1);
        });
    }

    async testAll() {
        console.log('🧪 Testing all monitoring components...\n');
        
        // Test monitor
        console.log('🔍 Testing health check...');
        if (this.components.monitor) {
            const healthResult = await this.components.monitor.performHealthCheck();
            console.log('✅ Health check completed\n');
        }

        // Test alerts
        console.log('🚨 Testing alert system...');
        if (this.components.alerts) {
            await this.components.alerts.testAlerts();
            console.log('✅ Alert test completed\n');
        }

        // Test dashboard
        console.log('📊 Testing dashboard generation...');
        if (this.components.dashboard) {
            await this.components.dashboard.generateDashboard();
            console.log('✅ Dashboard generated\n');
        }

        console.log('🎉 All tests completed successfully!');
    }
}

// CLI interface
if (require.main === module) {
    const service = new MonitorService();
    
    async function main() {
        const command = process.argv[2];
        
        switch (command) {
            case 'start':
                const existingPid = await service.isAlreadyRunning();
                if (existingPid) {
                    console.log(`⚠️  Service is already running (PID: ${existingPid})`);
                    process.exit(1);
                }
                await service.init();
                await service.start();
                break;
                
            case 'stop':
                await service.init();
                await service.stop();
                break;
                
            case 'restart':
                await service.init();
                await service.restart();
                break;
                
            case 'status':
                await service.init();
                const status = await service.getStatus();
                console.log('📊 Service Status:');
                console.log(JSON.stringify(status, null, 2));
                break;
                
            case 'test':
                await service.init();
                await service.testAll();
                break;
                
            default:
                console.log('Railway Monitor Service');
                console.log('');
                console.log('Usage:');
                console.log('  node monitor-service.js start    - Start the monitoring service');
                console.log('  node monitor-service.js stop     - Stop the monitoring service');
                console.log('  node monitor-service.js restart  - Restart the monitoring service');
                console.log('  node monitor-service.js status   - Show service status');
                console.log('  node monitor-service.js test     - Test all components');
                console.log('');
                console.log('Background service:');
                console.log('  npm run monitor:start   - Start as background service');
                console.log('  npm run monitor:stop    - Stop background service');
                console.log('  npm run monitor:status  - Check service status');
        }
    }
    
    main().catch(console.error);
}

module.exports = MonitorService;
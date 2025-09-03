#!/usr/bin/env node

/**
 * Alert System for Railway Monitoring
 * Handles notifications and alert routing
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

class AlertSystem {
    constructor(config = {}) {
        this.config = {
            logDir: path.join(__dirname, '../../logs/monitoring'),
            webhookUrls: [], // Add webhook URLs here
            emailConfig: null, // Add email config here
            slackConfig: null, // Add Slack config here
            cooldownPeriod: 300000, // 5 minutes between same type alerts
            enableConsoleAlerts: true,
            enableFileAlerts: true,
            enableWebhookAlerts: false,
            ...config
        };
        
        this.alertHistory = new Map();
    }

    async sendWebhook(url, payload) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
            const postData = JSON.stringify(payload);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'Railway-Monitor-Alert/1.0'
                }
            };

            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, statusCode: res.statusCode, response: data });
                    } else {
                        reject(new Error(`Webhook failed: ${res.statusCode} ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    formatDiscordWebhook(alert) {
        const colors = {
            deployment_down: 15158332, // Red
            consecutive_failures: 16776960, // Yellow
            health_check_failed: 16753920, // Orange
            deployment_slow: 255, // Blue
            recovery: 65280 // Green
        };

        const emoji = {
            deployment_down: '🔴',
            consecutive_failures: '⚠️',
            health_check_failed: '🚨',
            deployment_slow: '🐌',
            recovery: '✅'
        };

        return {
            embeds: [{
                title: `${emoji[alert.type] || '⚠️'} Railway Deployment Alert`,
                description: `**Alert Type:** ${alert.type.replace('_', ' ').toUpperCase()}`,
                color: colors[alert.type] || 16776960,
                fields: [
                    {
                        name: "Application",
                        value: "POS Conejo Negro",
                        inline: true
                    },
                    {
                        name: "Environment",
                        value: "Production",
                        inline: true
                    },
                    {
                        name: "Timestamp",
                        value: new Date(alert.timestamp).toLocaleString(),
                        inline: false
                    },
                    {
                        name: "Details",
                        value: JSON.stringify(alert.details, null, 2),
                        inline: false
                    }
                ],
                footer: {
                    text: "Railway Monitor v1.0"
                }
            }]
        };
    }

    formatSlackWebhook(alert) {
        const emoji = {
            deployment_down: ':red_circle:',
            consecutive_failures: ':warning:',
            health_check_failed: ':rotating_light:',
            deployment_slow: ':snail:',
            recovery: ':white_check_mark:'
        };

        const colors = {
            deployment_down: 'danger',
            consecutive_failures: 'warning',
            health_check_failed: 'danger',
            deployment_slow: 'warning',
            recovery: 'good'
        };

        return {
            text: `${emoji[alert.type] || ':warning:'} Railway Deployment Alert`,
            attachments: [{
                color: colors[alert.type] || 'warning',
                title: `${alert.type.replace('_', ' ').toUpperCase()}`,
                fields: [
                    {
                        title: "Application",
                        value: "POS Conejo Negro",
                        short: true
                    },
                    {
                        title: "Environment", 
                        value: "Production",
                        short: true
                    },
                    {
                        title: "Time",
                        value: new Date(alert.timestamp).toLocaleString(),
                        short: false
                    },
                    {
                        title: "Details",
                        value: `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
                        short: false
                    }
                ],
                footer: "Railway Monitor",
                ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
            }]
        };
    }

    formatGenericWebhook(alert) {
        return {
            alert_type: alert.type,
            application: "POS Conejo Negro",
            environment: "production",
            timestamp: alert.timestamp,
            details: alert.details,
            severity: this.getAlertSeverity(alert.type),
            url: "https://pos-conejonegro-production.up.railway.app"
        };
    }

    getAlertSeverity(alertType) {
        const severityMap = {
            deployment_down: 'critical',
            consecutive_failures: 'high',
            health_check_failed: 'medium',
            deployment_slow: 'low',
            recovery: 'info'
        };
        return severityMap[alertType] || 'medium';
    }

    shouldSendAlert(alert) {
        const key = `${alert.type}_${alert.details?.deploymentError || ''}`;
        const lastSent = this.alertHistory.get(key);
        
        if (!lastSent) {
            this.alertHistory.set(key, Date.now());
            return true;
        }
        
        const timeSinceLastAlert = Date.now() - lastSent;
        if (timeSinceLastAlert > this.config.cooldownPeriod) {
            this.alertHistory.set(key, Date.now());
            return true;
        }
        
        return false;
    }

    async sendAlert(alert) {
        if (!this.shouldSendAlert(alert)) {
            console.log(`⏸️  Alert suppressed due to cooldown: ${alert.type}`);
            return;
        }

        const results = [];

        // Console alerts
        if (this.config.enableConsoleAlerts) {
            this.sendConsoleAlert(alert);
            results.push({ type: 'console', success: true });
        }

        // File alerts
        if (this.config.enableFileAlerts) {
            try {
                await this.sendFileAlert(alert);
                results.push({ type: 'file', success: true });
            } catch (error) {
                results.push({ type: 'file', success: false, error: error.message });
            }
        }

        // Webhook alerts
        if (this.config.enableWebhookAlerts && this.config.webhookUrls.length > 0) {
            for (const webhookUrl of this.config.webhookUrls) {
                try {
                    let payload;
                    
                    if (webhookUrl.includes('discord')) {
                        payload = this.formatDiscordWebhook(alert);
                    } else if (webhookUrl.includes('slack')) {
                        payload = this.formatSlackWebhook(alert);
                    } else {
                        payload = this.formatGenericWebhook(alert);
                    }
                    
                    const result = await this.sendWebhook(webhookUrl, payload);
                    results.push({ type: 'webhook', url: webhookUrl, success: true, ...result });
                    console.log(`📤 Webhook sent successfully: ${webhookUrl}`);
                } catch (error) {
                    results.push({ type: 'webhook', url: webhookUrl, success: false, error: error.message });
                    console.error(`❌ Webhook failed: ${webhookUrl} - ${error.message}`);
                }
            }
        }

        return results;
    }

    sendConsoleAlert(alert) {
        const border = '═'.repeat(80);
        const title = `🚨 RAILWAY DEPLOYMENT ALERT - ${alert.type.toUpperCase()} 🚨`;
        
        console.log('\n' + border);
        console.log(title.padStart((80 + title.length) / 2).padEnd(80));
        console.log(border);
        console.log(`⏰ Timestamp: ${new Date(alert.timestamp).toLocaleString()}`);
        console.log(`🎯 Application: POS Conejo Negro`);
        console.log(`🌍 Environment: Production`);
        console.log(`🔗 URL: https://pos-conejonegro-production.up.railway.app`);
        console.log(`⚠️  Severity: ${this.getAlertSeverity(alert.type).toUpperCase()}`);
        console.log('');
        console.log('📊 Alert Details:');
        console.log(JSON.stringify(alert.details, null, 2));
        console.log(border + '\n');
    }

    async sendFileAlert(alert) {
        const alertFile = path.join(this.config.logDir, 'critical-alerts.log');
        const timestamp = new Date(alert.timestamp).toISOString();
        const severity = this.getAlertSeverity(alert.type);
        
        const logLine = `[${timestamp}] SEVERITY=${severity.toUpperCase()} TYPE=${alert.type} DETAILS=${JSON.stringify(alert.details)}\n`;
        
        try {
            await fs.appendFile(alertFile, logLine);
        } catch (error) {
            // Try to create directory if it doesn't exist
            await fs.mkdir(this.config.logDir, { recursive: true });
            await fs.appendFile(alertFile, logLine);
        }
    }

    async sendEmailAlert(alert) {
        // Placeholder for email functionality
        // Would require nodemailer or similar
        console.log('📧 Email alerts not configured');
        return false;
    }

    async getAlertHistory(hours = 24) {
        try {
            const alertFile = path.join(this.config.logDir, 'critical-alerts.log');
            const content = await fs.readFile(alertFile, 'utf8');
            const lines = content.trim().split('\n');
            
            const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
            
            return lines
                .filter(line => line.trim())
                .map(line => {
                    const timestampMatch = line.match(/\[([^\]]+)\]/);
                    const severityMatch = line.match(/SEVERITY=(\w+)/);
                    const typeMatch = line.match(/TYPE=(\w+)/);
                    const detailsMatch = line.match(/DETAILS=(.+)$/);
                    
                    if (!timestampMatch) return null;
                    
                    const timestamp = new Date(timestampMatch[1]);
                    
                    return {
                        timestamp: timestamp.toISOString(),
                        severity: severityMatch ? severityMatch[1] : 'UNKNOWN',
                        type: typeMatch ? typeMatch[1] : 'UNKNOWN',
                        details: detailsMatch ? JSON.parse(detailsMatch[1]) : {}
                    };
                })
                .filter(alert => alert && new Date(alert.timestamp) > cutoffTime)
                .reverse(); // Most recent first
        } catch (error) {
            console.error('❌ Failed to read alert history:', error.message);
            return [];
        }
    }

    async clearAlertHistory() {
        try {
            const alertFile = path.join(this.config.logDir, 'critical-alerts.log');
            await fs.writeFile(alertFile, '');
            this.alertHistory.clear();
            console.log('🧹 Alert history cleared');
        } catch (error) {
            console.error('❌ Failed to clear alert history:', error.message);
        }
    }

    // Test alert functionality
    async testAlerts() {
        console.log('🧪 Testing alert system...');
        
        const testAlert = {
            id: 'test-' + Date.now(),
            type: 'deployment_down',
            timestamp: new Date().toISOString(),
            details: {
                error: 'Test alert - all systems functioning normally',
                deploymentError: 'Connection timeout',
                consecutiveFailures: 5
            }
        };

        const results = await this.sendAlert(testAlert);
        
        console.log('✅ Test alert sent. Results:');
        results.forEach(result => {
            console.log(`  ${result.type}: ${result.success ? '✅' : '❌'} ${result.error || ''}`);
        });
        
        return results;
    }
}

// CLI interface
if (require.main === module) {
    const alertSystem = new AlertSystem();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            alertSystem.testAlerts();
            break;
        case 'history':
            const hours = parseInt(process.argv[3]) || 24;
            alertSystem.getAlertHistory(hours).then(history => {
                console.log(`📜 Alert history (last ${hours} hours):`);
                history.forEach(alert => {
                    console.log(`  ${alert.timestamp} [${alert.severity}] ${alert.type}`);
                });
            });
            break;
        case 'clear':
            alertSystem.clearAlertHistory();
            break;
        default:
            console.log('Usage:');
            console.log('  node alert-system.js test     - Test alert functionality');
            console.log('  node alert-system.js history  - Show alert history');
            console.log('  node alert-system.js clear    - Clear alert history');
    }
}

module.exports = AlertSystem;
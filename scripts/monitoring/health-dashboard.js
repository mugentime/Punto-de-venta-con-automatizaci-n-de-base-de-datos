#!/usr/bin/env node

/**
 * Health Dashboard Generator
 * Creates HTML dashboards from monitoring data
 */

const fs = require('fs').promises;
const path = require('path');

class HealthDashboard {
    constructor(config = {}) {
        this.config = {
            logDir: path.join(__dirname, '../../logs/monitoring'),
            dataDir: path.join(__dirname, '../../logs/monitoring/data'),
            outputDir: path.join(__dirname, '../../logs/monitoring/dashboard'),
            refreshInterval: 30000, // 30 seconds
            historyDays: 7,
            ...config
        };
    }

    async init() {
        try {
            await fs.mkdir(this.config.outputDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create output directory:', error.message);
        }
    }

    async loadMonitoringData() {
        try {
            // Load latest status
            const statusPath = path.join(this.config.dataDir, 'status.json');
            const statusData = await fs.readFile(statusPath, 'utf8');
            const status = JSON.parse(statusData);

            // Load recent health checks
            const healthChecks = [];
            for (let i = 0; i < this.config.historyDays; i++) {
                const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
                const dateStr = date.toISOString().split('T')[0];
                const logFile = path.join(this.config.logDir, `health-${dateStr}.json`);
                
                try {
                    const data = await fs.readFile(logFile, 'utf8');
                    const dayChecks = JSON.parse(data);
                    healthChecks.push(...dayChecks);
                } catch (error) {
                    // File doesn't exist for this date
                }
            }

            // Load alerts
            let alerts = [];
            try {
                const alertPath = path.join(this.config.logDir, 'alerts.json');
                const alertData = await fs.readFile(alertPath, 'utf8');
                alerts = JSON.parse(alertData);
            } catch (error) {
                // No alerts file
            }

            return { status, healthChecks, alerts };
        } catch (error) {
            console.error('Failed to load monitoring data:', error.message);
            return { status: null, healthChecks: [], alerts: [] };
        }
    }

    generateStatusBadge(isHealthy, uptime) {
        const color = isHealthy ? '#28a745' : '#dc3545';
        const text = isHealthy ? 'OPERATIONAL' : 'DOWN';
        return `
            <div class="status-badge" style="background-color: ${color}">
                <i class="fas ${isHealthy ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                ${text}
            </div>
            <div class="uptime-badge">
                ${uptime}% Uptime
            </div>
        `;
    }

    generateMetricsCards(status, healthChecks) {
        const recentChecks = healthChecks.slice(-24); // Last 24 checks
        const avgResponseTime = recentChecks.length > 0 ? 
            recentChecks
                .filter(c => c.healthResult?.responseTime)
                .reduce((acc, c) => acc + c.healthResult.responseTime, 0) / 
            recentChecks.filter(c => c.healthResult?.responseTime).length : 0;

        const totalErrors = recentChecks.filter(c => !c.overallSuccess).length;

        return `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">
                        <i class="fas fa-heartbeat"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${status?.uptime || 0}%</div>
                        <div class="metric-label">Uptime</div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${Math.round(avgResponseTime)}ms</div>
                        <div class="metric-label">Avg Response Time</div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${status?.successfulChecks || 0}</div>
                        <div class="metric-label">Successful Checks</div>
                    </div>
                </div>
                
                <div class="metric-card ${totalErrors > 0 ? 'metric-error' : ''}">
                    <div class="metric-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${totalErrors}</div>
                        <div class="metric-label">Recent Errors</div>
                    </div>
                </div>
            </div>
        `;
    }

    generateChart(healthChecks) {
        const recentChecks = healthChecks.slice(-48); // Last 48 checks
        const chartData = recentChecks.map(check => ({
            time: new Date(check.timestamp).getTime(),
            success: check.overallSuccess ? 1 : 0,
            responseTime: check.healthResult?.responseTime || 0
        }));

        return `
            <div class="chart-container">
                <canvas id="healthChart" width="800" height="300"></canvas>
            </div>
            <script>
                const chartData = ${JSON.stringify(chartData)};
                
                // Simple chart implementation
                const canvas = document.getElementById('healthChart');
                const ctx = canvas.getContext('2d');
                
                function drawChart() {
                    if (chartData.length === 0) return;
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw grid
                    ctx.strokeStyle = '#e0e0e0';
                    ctx.lineWidth = 1;
                    for (let i = 0; i <= 10; i++) {
                        const y = (canvas.height / 10) * i;
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(canvas.width, y);
                        ctx.stroke();
                    }
                    
                    // Draw response time line
                    const maxResponseTime = Math.max(...chartData.map(d => d.responseTime));
                    if (maxResponseTime > 0) {
                        ctx.strokeStyle = '#007bff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        
                        chartData.forEach((point, index) => {
                            const x = (canvas.width / (chartData.length - 1)) * index;
                            const y = canvas.height - (point.responseTime / maxResponseTime) * canvas.height;
                            
                            if (index === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        });
                        ctx.stroke();
                    }
                    
                    // Draw status dots
                    chartData.forEach((point, index) => {
                        const x = (canvas.width / (chartData.length - 1)) * index;
                        const y = canvas.height - 20;
                        
                        ctx.fillStyle = point.success ? '#28a745' : '#dc3545';
                        ctx.beginPath();
                        ctx.arc(x, y, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                }
                
                drawChart();
            </script>
        `;
    }

    generateAlertsTable(alerts) {
        const recentAlerts = alerts.slice(-10); // Last 10 alerts
        
        if (recentAlerts.length === 0) {
            return '<div class="no-alerts">No recent alerts</div>';
        }

        const alertRows = recentAlerts.map(alert => {
            const severity = this.getAlertSeverity(alert.type);
            const severityClass = severity === 'critical' ? 'alert-critical' : 
                                severity === 'high' ? 'alert-high' : 'alert-medium';
            
            return `
                <tr class="${severityClass}">
                    <td>${new Date(alert.timestamp).toLocaleString()}</td>
                    <td><span class="alert-type">${alert.type.replace('_', ' ')}</span></td>
                    <td><span class="severity-badge severity-${severity}">${severity}</span></td>
                    <td>${JSON.stringify(alert.details)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="alerts-section">
                <h3>Recent Alerts</h3>
                <table class="alerts-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alertRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    getAlertSeverity(alertType) {
        const severityMap = {
            deployment_down: 'critical',
            consecutive_failures: 'high',
            health_check_failed: 'medium',
            deployment_slow: 'low'
        };
        return severityMap[alertType] || 'medium';
    }

    generateDashboardHTML(data) {
        const { status, healthChecks, alerts } = data;
        const isHealthy = status?.isHealthy || false;
        const uptime = status?.uptime || 0;
        const lastCheck = status?.lastCheck ? new Date(status.lastCheck).toLocaleString() : 'Never';

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Monitor - POS Conejo Negro</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
        }

        .app-title {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 10px;
            color: #333;
        }

        .app-subtitle {
            color: #666;
            margin-bottom: 20px;
        }

        .status-badge {
            display: inline-block;
            padding: 10px 25px;
            border-radius: 25px;
            color: white;
            font-weight: bold;
            font-size: 1.1rem;
            margin-right: 15px;
        }

        .uptime-badge {
            display: inline-block;
            background: #f8f9fa;
            padding: 10px 20px;
            border-radius: 20px;
            color: #333;
            font-weight: 500;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            transition: transform 0.2s;
        }

        .metric-card:hover {
            transform: translateY(-5px);
        }

        .metric-card.metric-error {
            border-left: 4px solid #dc3545;
        }

        .metric-icon {
            font-size: 2rem;
            margin-right: 20px;
            color: #667eea;
        }

        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
        }

        .metric-label {
            color: #666;
            font-size: 0.9rem;
        }

        .chart-container {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .alerts-section {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .alerts-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        .alerts-table th,
        .alerts-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .alerts-table th {
            background: #f8f9fa;
            font-weight: 600;
        }

        .alert-critical {
            border-left: 4px solid #dc3545;
        }

        .alert-high {
            border-left: 4px solid #fd7e14;
        }

        .alert-medium {
            border-left: 4px solid #ffc107;
        }

        .severity-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            text-transform: uppercase;
        }

        .severity-critical {
            background: #dc3545;
            color: white;
        }

        .severity-high {
            background: #fd7e14;
            color: white;
        }

        .severity-medium {
            background: #ffc107;
            color: #333;
        }

        .no-alerts {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 40px;
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            color: rgba(255,255,255,0.8);
        }

        .last-update {
            background: white;
            border-radius: 10px;
            padding: 15px;
            margin-top: 20px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .app-title {
                font-size: 2rem;
            }
            
            .metric-card {
                flex-direction: column;
                text-align: center;
            }
            
            .metric-icon {
                margin-right: 0;
                margin-bottom: 10px;
            }
        }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="app-title">🚂 Railway Monitor</h1>
            <p class="app-subtitle">POS Conejo Negro - Production Environment</p>
            ${this.generateStatusBadge(isHealthy, uptime)}
        </div>

        ${this.generateMetricsCards(status, healthChecks)}

        ${this.generateChart(healthChecks)}

        ${this.generateAlertsTable(alerts)}

        <div class="last-update">
            <strong>Last Check:</strong> ${lastCheck}
            <br>
            <small>Dashboard auto-refreshes every 30 seconds</small>
        </div>
    </div>

    <div class="footer">
        <p>Railway Monitor v1.0 | Generated at ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
        `;
    }

    async generateDashboard() {
        console.log('📊 Generating health dashboard...');
        
        try {
            const data = await this.loadMonitoringData();
            const html = this.generateDashboardHTML(data);
            
            const outputPath = path.join(this.config.outputDir, 'index.html');
            await fs.writeFile(outputPath, html);
            
            console.log(`✅ Dashboard generated: ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('❌ Failed to generate dashboard:', error.message);
            throw error;
        }
    }

    async startAutoGeneration() {
        console.log(`🔄 Starting auto-generation (every ${this.config.refreshInterval / 1000}s)`);
        
        // Generate initial dashboard
        await this.generateDashboard();
        
        // Set up interval
        setInterval(async () => {
            try {
                await this.generateDashboard();
            } catch (error) {
                console.error('❌ Auto-generation failed:', error.message);
            }
        }, this.config.refreshInterval);
    }
}

// CLI interface
if (require.main === module) {
    const dashboard = new HealthDashboard();
    
    async function main() {
        await dashboard.init();
        
        const command = process.argv[2];
        
        switch (command) {
            case 'generate':
                await dashboard.generateDashboard();
                break;
            case 'serve':
                await dashboard.startAutoGeneration();
                console.log('📊 Dashboard auto-generation started. Press Ctrl+C to stop.');
                process.on('SIGINT', () => {
                    console.log('\n🛑 Stopping dashboard generation...');
                    process.exit(0);
                });
                break;
            default:
                console.log('Usage:');
                console.log('  node health-dashboard.js generate  - Generate dashboard once');
                console.log('  node health-dashboard.js serve     - Start auto-generation');
        }
    }
    
    main().catch(console.error);
}

module.exports = HealthDashboard;
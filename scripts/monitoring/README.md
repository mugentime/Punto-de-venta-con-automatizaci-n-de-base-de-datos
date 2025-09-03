# Railway Deployment Monitoring System

Comprehensive monitoring solution for the POS Conejo Negro Railway deployment.

## 🚀 Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Test the monitoring system
npm run monitor:test

# Start monitoring service
npm run monitor:start

# Check service status
npm run monitor:status

# Generate dashboard
npm run monitor:dashboard

# View dashboard (opens in browser)
start logs/monitoring/dashboard/index.html  # Windows
open logs/monitoring/dashboard/index.html   # macOS
xdg-open logs/monitoring/dashboard/index.html  # Linux
```

## 📊 Components

### 1. Railway Monitor (`railway-monitor.js`)
- Monitors deployment health at: https://pos-conejonegro-production.up.railway.app
- Checks `/api/health` endpoint every 60 seconds
- Tracks uptime, response times, and deployment status
- Stores monitoring data in JSON format

### 2. Alert System (`alert-system.js`)
- Sends alerts when deployment issues are detected
- Supports multiple notification channels:
  - Console alerts (enabled by default)
  - File-based alerts (enabled by default)
  - Webhook alerts (Discord, Slack, custom - configure in config file)
- Cooldown periods to prevent alert spam

### 3. Health Dashboard (`health-dashboard.js`)
- Generates HTML dashboard with real-time metrics
- Shows uptime percentage, response times, error counts
- Interactive charts and recent alerts table
- Auto-refreshes every 30 seconds

### 4. Service Orchestrator (`monitor-service.js`)
- Manages all monitoring components as unified service
- Handles graceful startup/shutdown
- Coordinates alerts between components
- Maintains PID files for service management

## 📁 Directory Structure

```
scripts/monitoring/
├── railway-monitor.js      # Core monitoring engine
├── alert-system.js         # Alert handling and notifications
├── health-dashboard.js     # Dashboard generation
├── monitor-service.js      # Service orchestrator
├── install-service.js      # Service installation helper
├── start-monitor.bat       # Windows batch starter
└── README.md              # This file

config/monitoring/
└── monitor-config.json     # Configuration file

logs/monitoring/
├── health-YYYY-MM-DD.json  # Daily health check logs
├── monitoring.log          # Main log file
├── alerts.json            # Alert history
├── critical-alerts.log    # Critical alerts log
├── data/
│   ├── status.json        # Current service status
│   └── latest-report.json # Latest monitoring report
└── dashboard/
    └── index.html         # Generated dashboard
```

## ⚙️ Configuration

Edit `config/monitoring/monitor-config.json`:

```json
{
  "appUrl": "https://pos-conejonegro-production.up.railway.app",
  "healthEndpoint": "/api/health",
  "checkInterval": 60000,
  "timeout": 10000,
  "alertThreshold": 3,
  "enableDashboard": true,
  "enableAlerts": true,
  "webhookUrls": ["https://discord.com/api/webhooks/your-webhook"],
  "notifications": {
    "console": true,
    "file": true,
    "webhook": false
  }
}
```

## 🚨 Alert Types

- **deployment_down**: Application is not responding
- **consecutive_failures**: Multiple health check failures in a row
- **health_check_failed**: Health endpoint returned error
- **deployment_slow**: Response times above threshold
- **recovery**: Service recovered after failures

## 📈 Dashboard Features

- **Real-time Status**: Current deployment health and uptime
- **Metrics Cards**: Response times, successful checks, error counts
- **Interactive Chart**: Response time trends over time
- **Alerts Table**: Recent alerts with severity levels
- **Auto-refresh**: Updates every 30 seconds

## 🔧 Installation as Service

### Windows (using NSSM)
```bash
npm run monitor:install
# Follow Windows instructions
```

### Linux (systemd)
```bash
npm run monitor:install
# Follow Linux instructions
```

### macOS (LaunchAgent)
```bash
npm run monitor:install
# Follow macOS instructions
```

### Docker
```bash
npm run monitor:install
# Use generated docker-compose.monitor.yml
```

## 🎯 NPM Scripts

- `npm run monitor:start` - Start monitoring service
- `npm run monitor:stop` - Stop monitoring service  
- `npm run monitor:restart` - Restart monitoring service
- `npm run monitor:status` - Check service status
- `npm run monitor:test` - Test all components
- `npm run monitor:dashboard` - Generate dashboard once
- `npm run monitor:dashboard:serve` - Auto-generate dashboard
- `npm run monitor:alerts` - Test alert system
- `npm run monitor:install` - Show service installation instructions

## 🔍 Monitoring Endpoints

The system monitors these Railway endpoints:

- **Main Application**: https://pos-conejonegro-production.up.railway.app
- **Health Check**: https://pos-conejonegro-production.up.railway.app/api/health

Expected health check response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-03T...",
  "database": "connected",
  "uptime": 123456
}
```

## 📊 Metrics Collected

- **Uptime Percentage**: Overall service availability
- **Response Times**: Average, min, max response times
- **Error Rates**: HTTP errors, timeouts, connection failures
- **Deployment Status**: Application accessibility
- **Alert Frequency**: Number of alerts over time

## 🛠️ Troubleshooting

### Service Won't Start
```bash
# Check if already running
npm run monitor:status

# View logs
cat logs/monitoring/monitoring.log

# Test manually
node scripts/monitoring/railway-monitor.js
```

### Dashboard Not Updating
```bash
# Generate manually
npm run monitor:dashboard

# Check dashboard service
npm run monitor:dashboard:serve
```

### Alerts Not Working
```bash
# Test alert system
npm run monitor:alerts

# Check alert configuration
cat config/monitoring/monitor-config.json
```

### High Resource Usage
- Increase `checkInterval` in config (default: 60 seconds)
- Disable dashboard auto-generation
- Set up log rotation

## 🔐 Security Considerations

- Monitor logs may contain sensitive information
- Webhook URLs should be kept secure
- Dashboard contains deployment status information
- Consider restricting access to monitoring files

## 🚀 Advanced Features

### Custom Webhooks
Add Discord/Slack webhooks to `monitor-config.json`:

```json
{
  "webhookUrls": [
    "https://discord.com/api/webhooks/123/abc",
    "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
  ],
  "notifications": {
    "webhook": true
  }
}
```

### Performance Monitoring
The system tracks:
- Response time trends
- Deployment health over time
- Error patterns and recovery times
- Service availability metrics

### Integration with CI/CD
Monitor deployments automatically:
- Detect when new deployments are triggered
- Track deployment success/failure
- Alert on deployment issues
- Generate deployment reports

## 📞 Support

- Configuration issues: Check `monitor-config.json`
- Service issues: Check `logs/monitoring/monitoring.log`
- Dashboard issues: Check `logs/monitoring/dashboard/index.html`
- Alert issues: Check `logs/monitoring/alerts.json`
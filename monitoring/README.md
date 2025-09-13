# POS Conejo Negro - Monitoring System

Comprehensive monitoring solution for the Railway-deployed Point of Sale system.

## 🚀 Quick Start

```bash
# Install monitoring dependencies
cd monitoring
npm install

# Start all monitoring services
npm start

# Quick health check
npm run deploy:quick

# Generate monitoring report
npm run report
```

## 📊 Components

### Health Monitor
- **File**: `scripts/health-monitor.js`
- **Purpose**: Continuous health checking of all endpoints
- **Features**: Response time tracking, endpoint validation, automated alerting

### Performance Monitor
- **File**: `scripts/performance-monitor.js`
- **Purpose**: System performance metrics and analysis
- **Features**: Response time tracking, memory usage, performance trends

### Alert System
- **File**: `scripts/alert-system.js`
- **Purpose**: Multi-channel alerting system
- **Channels**: Console, Email, Webhook, Slack

### Error Tracker
- **File**: `scripts/error-tracker.js`
- **Purpose**: Error categorization, tracking, and analysis
- **Features**: Error patterns, spike detection, recommendations

### Railway Monitor
- **File**: `scripts/railway-monitor.js`
- **Purpose**: Railway-specific deployment monitoring
- **Features**: Resource usage, connectivity, git tracking

### Deployment Checker
- **File**: `scripts/deployment-checker.js`
- **Purpose**: Automated deployment verification
- **Features**: Full deployment validation, security checks

## 🎛️ Dashboard

Access the operational dashboard at:
```
http://your-deployment-url/monitoring/dashboard
```

## 🔧 Configuration

### Environment Variables

```bash
# Alert Configuration
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,ops@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Webhook Alerts
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URLS=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Slack Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts

# Authentication
MONITORING_AUTH_TOKEN=your-secure-token
```

### Configuration File

Main configuration is in `config/monitoring-config.js`. Key settings:

- **Health Check Interval**: 30 seconds
- **Performance Metrics**: 60 seconds  
- **Alert Thresholds**: Response time, error rates, memory usage
- **Retention Periods**: Raw data (24h), aggregated (30d)

## 📈 Metrics Collected

### System Metrics
- Memory usage (heap, RSS, external)
- CPU utilization
- Process uptime
- Load average

### Application Metrics
- Response times by endpoint
- Request success/failure rates
- Database connectivity
- Authentication performance

### Business Metrics
- Daily sales (if accessible)
- Active users
- Inventory status
- Backup operations

### Railway Metrics
- Deployment status
- Git commit tracking
- Resource allocation
- Network connectivity

## 🚨 Alert Rules

### Critical Alerts
- Application down (health check failed)
- Database connection lost
- High error rate (>5%)
- Memory usage critical (>95%)

### Warning Alerts
- High response time (>2s)
- Memory usage high (>80%)
- Authentication issues
- Performance degradation

### Info Alerts
- New deployment detected
- Monitoring system started/stopped
- Successful backup operations

## 📊 Commands

### Monitoring Service
```bash
# Start all monitoring
node scripts/monitoring-service.js start

# Check status
node scripts/monitoring-service.js status

# Test all components
node scripts/monitoring-service.js test

# Generate report
node scripts/monitoring-service.js report 24
```

### Health Monitor
```bash
# Single health check
node scripts/health-monitor.js test

# Start continuous monitoring
node scripts/health-monitor.js start
```

### Performance Monitor
```bash
# Performance test
node scripts/performance-monitor.js test

# Generate performance report
node scripts/performance-monitor.js report 24
```

### Alert System
```bash
# Initialize alerts
node scripts/alert-system.js init

# Test all channels
node scripts/alert-system.js test

# Trigger test alert
node scripts/alert-system.js trigger test_alert '{"test": true}'

# Show alert statistics
node scripts/alert-system.js stats 24
```

### Error Tracker
```bash
# Show error status
node scripts/error-tracker.js status

# Generate error report
node scripts/error-tracker.js report 24

# Search errors
node scripts/error-tracker.js search "database"

# Clean up old errors
node scripts/error-tracker.js cleanup
```

### Railway Monitor
```bash
# Railway deployment status
node scripts/railway-monitor.js status

# Railway metrics
node scripts/railway-monitor.js metrics

# Railway report
node scripts/railway-monitor.js report

# Test connectivity
node scripts/railway-monitor.js test
```

### Deployment Checker
```bash
# Full deployment verification
node scripts/deployment-checker.js verify

# Quick health check
node scripts/deployment-checker.js quick

# Test with custom URL
node scripts/deployment-checker.js verify https://your-app.railway.app
```

## 📋 Report Types

### Health Report
- Overall system health
- Endpoint availability
- Response time statistics
- Failed checks details

### Performance Report
- Response time trends
- Memory usage patterns
- Performance bottlenecks
- Optimization recommendations

### Error Report
- Error rate statistics
- Top error patterns
- Error classification
- Resolution recommendations

### Deployment Report
- Deployment status
- Railway integration health
- Security configuration
- Operational readiness

## 🔍 Troubleshooting

### Common Issues

1. **Health checks failing**
   ```bash
   # Test individual endpoint
   curl -f https://your-app.railway.app/api/health
   
   # Check logs
   node scripts/health-monitor.js test
   ```

2. **Alerts not sending**
   ```bash
   # Test alert system
   node scripts/alert-system.js test
   
   # Check configuration
   node scripts/alert-system.js init
   ```

3. **Performance issues**
   ```bash
   # Run performance analysis
   node scripts/performance-monitor.js test
   
   # Generate detailed report
   node scripts/performance-monitor.js report 1
   ```

4. **Database connectivity**
   ```bash
   # Test database
   curl https://your-app.railway.app/api/debug/users
   
   # Check Railway monitor
   node scripts/railway-monitor.js test
   ```

## 📁 File Structure

```
monitoring/
├── config/
│   └── monitoring-config.js     # Main configuration
├── scripts/
│   ├── monitoring-service.js    # Main orchestrator
│   ├── health-monitor.js        # Health checking
│   ├── performance-monitor.js   # Performance metrics
│   ├── alert-system.js          # Multi-channel alerts
│   ├── error-tracker.js         # Error management
│   ├── railway-monitor.js       # Railway-specific monitoring
│   └── deployment-checker.js    # Deployment verification
├── dashboards/
│   └── operational-dashboard.html # Web dashboard
├── logs/                        # Log files
├── data/                        # Metrics storage
├── reports/                     # Generated reports
└── README.md                    # This file
```

## 🔐 Security

- All sensitive configuration via environment variables
- No hardcoded credentials
- Rate limiting protection
- Security headers validation
- Access token authentication for protected endpoints

## 🎯 Integration

### With POS Application

The monitoring system integrates with the main POS application through:

1. **Health endpoints**: `/api/health`, `/api/version`, `/api/build-info`
2. **Debug endpoints**: `/api/debug/users`, `/api/debug/env`
3. **Sync endpoints**: `/api/sync/status`, `/api/sync/backup`

### With Railway Platform

- Automatic deployment detection via environment variables
- Git commit tracking
- Resource usage monitoring
- Network connectivity testing

## 📞 Support

For monitoring system issues:

1. Check component status: `npm run status`
2. Run component tests: `npm run test`
3. Review logs in `logs/` directory
4. Generate diagnostic report: `npm run report`

## 📄 License

MIT License - See main project LICENSE file.
# 🚄 Railway Deployment Guide - POS Conejo Negro

## Overview
This guide provides comprehensive instructions for deploying the POS Conejo Negro system to Railway with optimal performance, monitoring, and production-grade reliability.

## 📋 Prerequisites

### Required Railway Account Setup
1. **Railway Account**: [Sign up at railway.app](https://railway.app)
2. **GitHub Integration**: Connect your GitHub account to Railway
3. **PostgreSQL Addon**: Add PostgreSQL database service
4. **Domain Setup**: Configure custom domain (optional)

### Local Development Environment
- Node.js 18.x or higher
- npm 8.x or higher
- Git installed and configured
- Railway CLI (optional but recommended)

## 🏗️ Deployment Architecture

### Infrastructure Components
```
┌─────────────────────────────────────────────────────────────┐
│                        Railway Cloud                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Load Balancer │   POS App       │    PostgreSQL DB        │
│   + SSL/TLS     │   (Node.js)     │    (Managed Service)    │
├─────────────────┼─────────────────┼─────────────────────────┤
│   Health Checks │   Auto Scaling  │    Automated Backups    │
│   Monitoring    │   Deployments   │    High Availability    │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Key Features
- **Auto-scaling**: 1-3 instances based on CPU/Memory usage
- **Health monitoring**: Continuous health checks with alerts
- **Zero-downtime deployments**: Blue-green deployment strategy
- **SSL/TLS**: Automatic HTTPS certificates
- **Database**: Managed PostgreSQL with automated backups
- **Monitoring**: Real-time metrics and logging

## 🚀 Quick Start Deployment

### Method 1: GitHub Integration (Recommended)

1. **Fork or Clone Repository**
   ```bash
   git clone https://github.com/your-username/POS-CONEJONEGRO.git
   cd POS-CONEJONEGRO
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"
   - Choose your POS-CONEJONEGRO repository

3. **Add PostgreSQL Database**
   - In Railway dashboard, click "Add Service"
   - Select "PostgreSQL"
   - Railway will automatically create `DATABASE_URL` variable

4. **Configure Environment Variables**
   ```bash
   # Copy the template and configure
   cp railway.env.template railway.env
   
   # Edit railway.env with your values:
   NODE_ENV=production
   JWT_SECRET=your-64-character-secure-jwt-secret
   TZ=America/Mexico_City
   ```

5. **Deploy**
   - Railway will automatically detect the `Dockerfile`
   - Push to your main branch to trigger deployment
   - Monitor deployment in Railway dashboard

### Method 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secure-jwt-secret
railway variables set TZ=America/Mexico_City

# Deploy
railway up
```

## ⚙️ Configuration Files

### Core Configuration Files
- `Dockerfile`: Production-optimized container
- `railway.json`: Railway deployment configuration
- `railway.scaling.json`: Auto-scaling configuration
- `railway.env.template`: Environment variables template

### Health & Monitoring
- `scripts/healthcheck.sh`: Container health check script
- `scripts/monitor-railway.js`: Deployment monitoring system
- `scripts/deploy-verify.js`: Deployment verification & rollback

### Performance Optimization
- `scripts/build-optimize.sh`: Build optimization script
- Multi-stage Dockerfile for minimal image size
- Asset compression and minification
- Caching strategies

## 🔧 Environment Variables

### Required Variables
```bash
# Application
NODE_ENV=production
PORT=3000  # Set automatically by Railway
JWT_SECRET=your-64-character-secure-jwt-secret

# Database  
DATABASE_URL=${POSTGRESQL_URL}  # Set automatically by PostgreSQL addon

# Timezone
TZ=America/Mexico_City
```

### Optional Variables
```bash
# Performance
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12

# Features
ENABLE_AUTO_BACKUP=true
BACKUP_INTERVAL_HOURS=6
ENABLE_METRICS=true

# Business
BUSINESS_NAME="Conejo Negro Cafe"
CURRENCY=MXN
```

## 📊 Monitoring & Health Checks

### Built-in Health Endpoints
- `/api/health` - Application health status
- `/api/version` - Build and version information
- `/railway-monitor.html` - Real-time monitoring dashboard

### Monitoring Features
- **Automated Health Checks**: Every 30 seconds
- **Performance Metrics**: Response time, memory usage, CPU
- **Error Tracking**: Automatic error detection and alerting
- **Dashboard**: Real-time visual monitoring
- **Alerts**: Email/Slack notifications for issues

### Monitoring Commands
```bash
# Start continuous monitoring
node scripts/monitor-railway.js start

# Run single health check
node scripts/monitor-railway.js check

# Generate monitoring dashboard
node scripts/monitor-railway.js dashboard
```

## 🔄 Deployment Verification

### Automatic Verification
After each deployment, automatic verification runs:
```bash
# Verify deployment health
node scripts/deploy-verify.js verify
```

### Verification Tests
- ✅ Health endpoint availability
- ✅ Database connectivity
- ✅ Authentication system
- ✅ Static asset serving
- ✅ API response times
- ✅ Memory and CPU usage

### Automatic Rollback
If verification fails, automatic rollback is triggered:
- Reverts to previous working deployment
- Notifies team of rollback event
- Provides detailed failure analysis

## 🔀 Scaling Configuration

### Auto-scaling Triggers
- **CPU Usage**: Scale up at 80%, scale down at 30%
- **Memory Usage**: Scale up at 85%, scale down at 40%
- **Request Rate**: Scale up at 150 req/s, scale down at 50 req/s
- **Response Time**: Scale up at 2000ms, scale down at 500ms

### Scaling Limits
- **Minimum Instances**: 1
- **Maximum Instances**: 3
- **Cooldown Period**: 5 minutes
- **Warmup Period**: 2 minutes

## 🔐 Security Configuration

### Automatic Security Features
- **HTTPS/TLS**: Automatic SSL certificates
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Rate Limiting**: API and authentication protection
- **DDoS Protection**: Automatic traffic filtering
- **Input Validation**: SQL injection and XSS protection

### Security Best Practices
1. **JWT Secrets**: Use 64-character random strings
2. **Database**: Railway-managed PostgreSQL with encryption
3. **Environment Variables**: Never commit secrets to Git
4. **Access Control**: Role-based authentication system
5. **Audit Logs**: Track all administrative actions

## 🔧 Performance Optimization

### Built-in Optimizations
- **Multi-stage Docker Build**: Minimal production image
- **Asset Compression**: Gzip compression for static files
- **Caching**: In-memory and file-based caching
- **Connection Pooling**: Efficient database connections
- **Load Balancing**: Automatic traffic distribution

### Performance Monitoring
- Average response time tracking
- Memory usage optimization
- Database query performance
- Cache hit rate monitoring

## 📦 Backup & Recovery

### Automatic Backups
- **Database**: Daily automated PostgreSQL backups
- **File Storage**: Git-based data persistence
- **Retention**: 30 days for database, 7 days for files
- **Recovery**: Point-in-time restore capability

### Manual Backup
```bash
# Create manual backup
curl -X POST https://your-app.railway.app/api/sync/backup

# Check backup status
curl https://your-app.railway.app/api/sync/status
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in Railway dashboard
# Verify Dockerfile syntax
# Check node_modules and package-lock.json
```

#### 2. Database Connection Issues
```bash
# Verify DATABASE_URL is set
# Check PostgreSQL service status
# Test connection manually
```

#### 3. High Memory Usage
```bash
# Monitor memory usage in dashboard
# Check for memory leaks
# Optimize database queries
```

#### 4. Slow Response Times
```bash
# Enable performance monitoring
# Check database query performance
# Monitor external API calls
```

### Debug Commands
```bash
# View application logs
railway logs

# Check environment variables
railway variables

# Monitor service status
railway status

# Connect to database
railway connect postgresql
```

## 📞 Support & Maintenance

### Health Monitoring
- 24/7 automated monitoring
- Instant alerts for issues
- Performance trend analysis
- Capacity planning recommendations

### Maintenance Windows
- Automatic security updates
- Database maintenance handled by Railway
- Zero-downtime application updates
- Rollback capability for failed deployments

### Emergency Procedures
1. **Service Outage**: Automatic failover and recovery
2. **Data Issues**: Point-in-time database restore
3. **Security Incident**: Immediate service isolation
4. **Performance Issues**: Auto-scaling activation

## 🎯 Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] JWT secret generated (64 characters)
- [ ] PostgreSQL service added
- [ ] Health checks configured
- [ ] Monitoring enabled
- [ ] Backup strategy configured

### Post-Deployment
- [ ] Health endpoints responding
- [ ] Database connectivity verified
- [ ] Authentication system working
- [ ] Performance within acceptable ranges
- [ ] Monitoring dashboard accessible
- [ ] Backup jobs running

### Ongoing Monitoring
- [ ] Daily health check review
- [ ] Weekly performance analysis
- [ ] Monthly capacity planning
- [ ] Quarterly security audit

## 📚 Additional Resources

### Railway Documentation
- [Railway Docs](https://docs.railway.app/)
- [PostgreSQL on Railway](https://docs.railway.app/databases/postgresql)
- [Environment Variables](https://docs.railway.app/develop/variables)
- [Custom Domains](https://docs.railway.app/deploy/custom-domains)

### POS System Documentation
- `README.md` - General project information
- `SECURITY.md` - Security guidelines
- `API Documentation` - Available at `/api/docs` after deployment

---

## 🎉 Deployment Complete!

Your POS Conejo Negro system is now deployed with:
- ✅ Production-grade infrastructure
- ✅ Automated scaling and monitoring  
- ✅ Comprehensive security measures
- ✅ Backup and recovery systems
- ✅ Performance optimization
- ✅ Zero-downtime deployment capability

**Access your deployed application:**
- **Application**: https://your-app.railway.app
- **Health Check**: https://your-app.railway.app/api/health
- **Monitoring**: https://your-app.railway.app/railway-monitor.html

For support, monitoring, or questions, refer to the troubleshooting section or contact the development team.
# Hive-Mind Deployment Tracking System

## Overview
The Hive-Mind system provides automated tracking and memory management for git operations and Railway deployments. It creates persistent memory that survives sessions and maintains a complete audit trail of all deployments.

## Features Implemented

### 1. **Git Operation Tracking**
- Automatic tracking of git pushes with commit hash, timestamp, and metadata
- Git hooks integration for seamless automation
- Commit-to-deployment linking

### 2. **Railway Deployment Monitoring**
- Real-time monitoring of Railway deployment status
- Build log capture and storage
- Health check integration
- Deployment success/failure tracking

### 3. **Persistent Memory System**
- Cross-session deployment history storage
- JSON-based memory with structured data
- Queryable deployment records
- Audit trail for all operations

### 4. **Automated Triggers**
- Git hooks (post-commit, pre-push, post-push)
- Railway monitoring service
- Manual trigger scripts

## File Structure

```
├── src/
│   ├── memory/
│   │   └── deploymentTracker.js      # Core memory management
│   ├── hooks/
│   │   └── gitHooks.js               # Git hooks integration
│   └── services/
│       ├── railwayMonitor.js         # Railway deployment monitoring
│       └── automatedTrigger.js       # Orchestration system
├── .hive-mind/
│   └── memory/
│       └── deployment-history.json   # Persistent deployment data
├── hive-init.js                      # Initialization script
└── trigger-deployment.js             # Manual trigger script
```

## NPM Scripts

- `npm run hive:init` - Initialize the hive-mind system
- `npm run hive:track` - Manually trigger deployment tracking
- `npm run hive:status` - Check system status
- `npm run hive:stats` - Get deployment statistics
- `npm run hive:query` - Query recent deployments
- `npm run hive:install-hooks` - Reinstall git hooks

## Usage Examples

### Initialize System
```bash
npm run hive:init
```

### Track a Deployment
```bash
npm run hive:track
# or with specific commit
node trigger-deployment.js track-push abc123
```

### Check System Status
```bash
npm run hive:status
```

### Query Deployments
```bash
npm run hive:query 10  # Last 10 deployments
```

### Get Statistics
```bash
npm run hive:stats 30  # Last 30 days stats
```

## System Components

### Memory Tracker (`deploymentTracker.js`)
- Stores git operations and Railway deployments
- Provides query interface for deployment history
- Generates deployment statistics and audit trails
- Cross-session persistence via JSON storage

### Git Hooks Manager (`gitHooks.js`)
- Installs git hooks for automatic tracking
- Handles post-commit, pre-push, and post-push events
- Integrates with memory tracker for seamless operation

### Railway Monitor (`railwayMonitor.js`)
- Monitors Railway deployment status via API and health checks
- Updates deployment records with build logs and outcomes
- Handles success/failure status transitions

### Automated Trigger System (`automatedTrigger.js`)
- Orchestrates all components
- Provides unified initialization and management
- Handles system lifecycle and monitoring

## Data Structure

### Git Operation Record
```json
{
  "id": "unique-id",
  "type": "git-push",
  "commitHash": "abc123...",
  "branch": "main",
  "remote": "origin",
  "timestamp": "2025-09-03T15:30:00.000Z",
  "message": "commit message",
  "author": "User <email>",
  "files": ["file1.js", "file2.js"],
  "status": "completed"
}
```

### Railway Deployment Record
```json
{
  "id": "unique-id",
  "gitOperationId": "linked-git-op-id",
  "type": "railway-deployment",
  "timestamp": "2025-09-03T15:30:05.000Z",
  "status": "pending|building|success|failed",
  "buildId": "railway-build-id",
  "deploymentUrl": "https://app.railway.app",
  "buildLogs": [...],
  "buildDuration": 120000,
  "environment": "production"
}
```

## Automatic Tracking Flow

1. **Git Push** → Git hooks trigger → Record git operation
2. **Railway Detection** → Monitor starts deployment tracking
3. **Status Updates** → Monitor checks Railway API and health endpoints
4. **Completion** → Final status recorded with build logs and metrics
5. **Audit Trail** → All events logged with timestamps

## Configuration

The system reads configuration from:
- `railway.json` - Railway project settings
- Environment variables (`RAILWAY_*`)
- `.hive-mind/config.json` - Hive system settings

## Benefits

- **Complete Audit Trail**: Every deployment is tracked with full context
- **Cross-Session Memory**: History persists between coding sessions
- **Automated Operation**: No manual intervention required
- **Queryable History**: Easy access to deployment patterns and statistics
- **Integration Ready**: Works with existing git and Railway workflows

## Status

✅ **Initialized and Operational**
- Git hooks installed and functional
- Railway monitoring active
- Memory system configured
- Trigger scripts created
- NPM scripts integrated

The system is now automatically tracking all git operations and Railway deployments, storing the data in persistent memory for future reference and analysis.
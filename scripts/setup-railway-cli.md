# 🚀 Railway CLI Setup Guide

## ✅ Railway CLI Installed Successfully
- Version: `railway 4.6.3`
- Location: Global installation complete

## 🔑 Manual Login Required

Railway CLI requires **interactive login** which needs to be done manually:

### Step 1: Login to Railway
```bash
railway login
```
This will:
1. Open your browser
2. Redirect to Railway login page
3. Ask you to authenticate
4. Return authentication token to CLI

### Step 2: Link Project
```bash
railway link fed11c6d-a65a-4d93-90e6-955e16b6753f
```
Or interactively select project:
```bash
railway link
```

### Step 3: View Logs
```bash
# Real-time logs
railway logs

# Follow logs (live)
railway logs --follow

# Show recent logs
railway logs --tail 100
```

### Step 4: Check Environment Variables
```bash
# List all environment variables
railway vars

# Check specific variable
railway vars | grep DATABASE_URL
```

## 🔧 Alternative: Browserless Login

If browser login doesn't work:
```bash
railway login --browserless
```
This will provide a URL to visit manually.

## 🎯 Project Information
- **Project ID**: `fed11c6d-a65a-4d93-90e6-955e16b6753f`
- **App URL**: https://pos-conejonegro-production.up.railway.app
- **Service**: POS Conejo Negro

## 📊 Commands to Run After Setup

1. **Check deployment status:**
   ```bash
   railway status
   ```

2. **View environment variables:**
   ```bash
   railway vars
   ```

3. **Check PostgreSQL service:**
   ```bash
   railway ps
   ```

4. **View logs for DATABASE_URL issues:**
   ```bash
   railway logs | grep -i database
   ```

## 🚨 What We're Looking For

In the logs, we need to find:
- Environment variable loading messages
- DATABASE_URL injection attempts
- PostgreSQL connection errors
- Any "file-based" vs "postgresql" messages

This will help identify why DATABASE_URL isn't reaching the application process despite being configured in Railway Dashboard.
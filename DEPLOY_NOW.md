# 🚀 DEPLOY NOW - Step-by-Step Guide

**Current Status:** All code committed and pushed ✅
**Ready to Deploy:** Phases 1, 2, and 3
**Time Required:** 15-20 minutes

---

## Prerequisites Check ✅

Before starting, verify:
- [x] Railway CLI installed (`railway --version`)
- [x] Logged in to Railway (`railway whoami` shows: je2alvarela@gmail.com)
- [x] All commits pushed to GitHub (`git status` shows: up to date)

---

## 🎯 STEP 1: Link Railway Project (2 minutes)

### Command:
```bash
railway link
```

### What to do:
1. Terminal will show: "Select a workspace"
   - **Select:** `mugentime's Projects`
   - **Press:** Enter

2. Terminal will show: "Select a project"
   - **Select:** `POS.CLAUDE`
   - **Press:** Enter

### Verify it worked:
```bash
railway status
```

**Expected output:**
```
Project: POS.CLAUDE
Service: pos-conejo-negro
Environment: production
```

✅ **If you see this, continue to Step 2**
❌ **If error, run `railway link` again**

---

## 🗄️ STEP 2: Execute Database Migrations (5 minutes)

### ⚠️ IMPORTANT: Run migrations in THIS EXACT ORDER!

### Migration 1: Idempotency Table

**Command:**
```bash
railway run psql $DATABASE_URL -f database/migrations/001_add_idempotency_table.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\dt idempotency_keys"
```

**Expected output:**
```
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+----------
 public | idempotency_keys  | table | postgres
```

✅ **If you see this, continue to Migration 2**

---

### Migration 2: Stored Procedures

**Command:**
```bash
railway run psql $DATABASE_URL -f database/migrations/002_create_stored_procedures.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\df create_order_atomic"
```

**Expected output:**
```
 Schema |        Name         | Result data type | Argument data types
--------+---------------------+------------------+---------------------
 public | create_order_atomic | TABLE(...)       | p_id character varying, ...
```

✅ **If you see this, continue to Migration 3**

---

### Migration 3: Performance Indexes

**Command:**
```bash
railway run psql $DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\di idx_orders_created_at"
```

**Expected output:**
```
 Schema |         Name           | Type  |  Owner   |  Table
--------+------------------------+-------+----------+--------
 public | idx_orders_created_at  | index | postgres | orders
```

**Also verify:**
```bash
railway run psql $DATABASE_URL -c "\di idx_idempotency_expires"
```

**Expected output:**
```
 Schema |           Name            | Type  |  Owner   |      Table
--------+---------------------------+-------+----------+-----------------
 public | idx_idempotency_expires   | index | postgres | idempotency_keys
```

✅ **If both indexes appear, continue to Step 3**

---

## 🚢 STEP 3: Deploy Application (2 minutes)

### Command:
```bash
railway up --detach
```

**What happens:**
- Railway builds your app
- Deploys to production
- Starts the server

**Expected output:**
```
Building...
Deploying...
✅ Deployment successful
```

### Monitor Deployment:
```bash
railway logs --follow
```

**Press Ctrl+C to stop monitoring (deployment will continue)**

---

## ✅ STEP 4: Verify Deployment (5 minutes)

### Check 1: Server Started

**Look for in logs:**
```
✅ [WS] WebSocket server initialized
✅ Server running on port...
✅ Connected to PostgreSQL database
```

### Check 2: Get Your App URL

**Command:**
```bash
railway status
```

**Look for:**
```
URL: https://pos-conejo-negro-production.railway.app
```

**Copy this URL and open it in your browser**

---

## 🧪 STEP 5: Smoke Testing (5 minutes)

### Test 1: WebSocket Connection

1. **Open your Railway app URL in browser**
2. **Open DevTools** (F12 or Right-click → Inspect)
3. **Go to Console tab**
4. **Look for:**
   ```
   [WS] Connected to server
   ```
5. **Check top-right corner of app:**
   - Should show: **"En línea"** (green indicator)

✅ **If green, WebSocket is working!**

---

### Test 2: Idempotency (Duplicate Prevention)

1. **Login to your app**
2. **Add a product to cart**
3. **Click "Cobrar" button**
4. **Fill in customer details**
5. **RAPIDLY click "Pagar" button 5 times quickly**
6. **Check Console:**
   - Should see: `"Reusing existing request"`
7. **Check your orders:**
   - Should have **ONLY 1 ORDER** created

✅ **If only 1 order created, idempotency is working!**

---

### Test 3: Real-Time Coworking Sync

1. **Open app in TWO different browsers** (Chrome and Firefox, or 2 Chrome windows)
2. **Browser 1:** Go to Coworking tab → Click "Nueva Sesión"
3. **Browser 2:** **Watch the screen**
   - Session should appear **instantly** (<200ms)
4. **Browser 1:** Add an extra to the session
5. **Browser 2:** **Watch the screen**
   - Extra should appear **instantly**

✅ **If updates appear instantly, WebSocket sync is working!**

---

### Test 4: Network Resilience

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Change Throttling to "Offline"**
4. **Check top-right indicator:**
   - Should change to: **"Reconectando"** (amber color)
5. **Change Throttling back to "Online"**
6. **Check indicator:**
   - Should change back to: **"En línea"** (green)
7. **Check Console:**
   - Should see: `"Reconnected after N attempts"`

✅ **If it reconnects automatically, resilience is working!**

---

## 📊 STEP 6: Database Verification (2 minutes)

### Connect to database:
```bash
railway run psql $DATABASE_URL
```

### Check latest order:
```sql
SELECT id, client_name, total, created_at
FROM orders
ORDER BY created_at DESC
LIMIT 1;
```

**Should show the order you just created in Test 2**

### Check idempotency keys:
```sql
SELECT key, order_id, created_at
FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 5;
```

**Should show keys for recent order creations**

### Exit database:
```
\q
```

✅ **If data appears correctly, database is working!**

---

## 🎉 SUCCESS CRITERIA

Your deployment is successful if ALL of these are true:

- ✅ Railway deployment completed without errors
- ✅ Server logs show WebSocket initialized
- ✅ App URL loads in browser
- ✅ "En línea" indicator showing (green)
- ✅ Only 1 order created despite multiple clicks
- ✅ Coworking updates appear instantly (<200ms)
- ✅ Reconnects automatically after going offline
- ✅ Database shows correct data

---

## 🚨 If Something Goes Wrong

### Error: "Migration failed"

**Solution:**
```bash
# Check which migration failed
railway logs | grep -i error

# Drop the problematic table/function and retry
railway run psql $DATABASE_URL
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP FUNCTION IF EXISTS create_order_atomic CASCADE;
\q

# Re-run migrations from Step 2
```

---

### Error: "Deployment failed"

**Solution:**
```bash
# Check deployment logs
railway logs

# Common fixes:
# 1. Check package.json has correct start script
# 2. Verify all dependencies installed
# 3. Check for syntax errors in recent commits

# Rollback if needed:
git revert HEAD~3  # Revert last 3 commits
git push origin add-tip-field
railway up --detach
```

---

### Error: "WebSocket not connecting"

**Check:**
1. Railway logs: `railway logs | grep WS`
2. Browser console for connection errors
3. CORS settings in server.js

**If still not working:**
- App will fallback to polling automatically
- Coworking will still work (just slower, 5s updates instead of instant)

---

## 📋 Post-Deployment Checklist

Complete this after deployment:

- [ ] All 3 migrations executed successfully
- [ ] Railway deployment completed
- [ ] App URL accessible
- [ ] WebSocket connected (green indicator)
- [ ] Idempotency preventing duplicates
- [ ] Coworking real-time updates working (<200ms)
- [ ] Network resilience working (auto-reconnect)
- [ ] Database contains correct data
- [ ] No errors in Railway logs

---

## 📞 Quick Reference Commands

**View logs:**
```bash
railway logs --follow
```

**Check deployment status:**
```bash
railway status
```

**Restart service:**
```bash
railway restart
```

**Check database:**
```bash
railway run psql $DATABASE_URL
```

**View environment variables:**
```bash
railway variables
```

---

## 📅 Monitoring Schedule

### First Hour:
- Check logs every 15 minutes
- Verify no error spikes
- Test creating orders
- Monitor WebSocket connections

### First Day:
- Check logs 3-4 times
- Test with real usage
- Monitor for duplicate orders
- Check database growth

### First Week:
- Daily log review
- Monitor performance metrics
- Gather user feedback
- Check for any issues

---

## ✅ You're All Set!

Follow each step in order, verify each one before moving to the next.

**Estimated Total Time:** 15-20 minutes

**Good luck with your deployment!** 🚀

---

**Deployment Date:** _______________
**Deployed By:** je2alvarela@gmail.com
**Result:** ⬜ Success / ⬜ Partial / ⬜ Rolled Back
**Notes:** _______________

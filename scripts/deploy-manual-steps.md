# Manual Deployment Steps for Railway

Since Railway CLI requires interactive input, follow these steps:

## 🔗 Step 1: Link to Railway Project (2 minutes)

```bash
# In your terminal, run:
railway link

# When prompted:
# 1. Select workspace: "mugentime's Projects"
# 2. Select project: "POS.CLAUDE"
# 3. Press Enter
```

**Verify link:**
```bash
railway status
# Should show project details
```

---

## 🗄️ Step 2: Execute Database Migrations (5 minutes)

**IMPORTANT: Run migrations in this exact order!**

### Migration 1: Idempotency Table
```bash
railway run psql $DATABASE_URL -f database/migrations/001_add_idempotency_table.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\dt idempotency_keys"
# Should show: public | idempotency_keys | table | postgres
```

### Migration 2: Stored Procedures
```bash
railway run psql $DATABASE_URL -f database/migrations/002_create_stored_procedures.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\df create_order_atomic"
# Should show function definition
```

### Migration 3: Performance Indexes
```bash
railway run psql $DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
```

**Verify:**
```bash
railway run psql $DATABASE_URL -c "\di idx_orders_created_at"
railway run psql $DATABASE_URL -c "\di idx_idempotency_expires"
# Both should appear
```

---

## 🚢 Step 3: Deploy Application (2 minutes)

```bash
# Deploy to Railway
railway up --detach

# Monitor deployment logs
railway logs --follow
```

**Look for these success indicators:**
- ✅ `[WS] WebSocket server initialized`
- ✅ `Server running on port...`
- ✅ `Connected to PostgreSQL database`

---

## ✅ Step 4: Smoke Testing (10 minutes)

### Test 1: WebSocket Connection
1. Open your app in browser
2. Open DevTools → Console
3. Look for: `[WS] Connected to server`
4. Check top-right corner: Should show "En línea" (green)

### Test 2: Order Creation (Idempotency Test)
1. Add products to cart
2. Click "Cobrar"
3. **Rapidly click "Pagar" multiple times**
4. ✅ Should create ONLY ONE order
5. Console should show: "Reusing existing request"

### Test 3: Real-Time Coworking Sync
1. Open app in 2 different browsers/tabs
2. Browser 1: Create new coworking session
3. Browser 2: Should see session appear **instantly** (<200ms)
4. Browser 1: Add an extra
5. Browser 2: Extra should appear **instantly**

### Test 4: Fallback to Polling
1. DevTools → Network → Throttling → Offline
2. Indicator should change to "Reconectando" (amber)
3. Go back online
4. Should reconnect automatically
5. Console: "Reconnected after N attempts"

### Test 5: Database Verification
```bash
railway run psql $DATABASE_URL

# Check latest order
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

# Check idempotency keys
SELECT * FROM idempotency_keys ORDER BY created_at DESC LIMIT 5;

# Verify stock updates
SELECT id, name, stock FROM products WHERE id IN (...);
```

---

## 📊 Success Criteria

After 1 hour of monitoring:

- ✅ Zero duplicate orders
- ✅ All orders creating successfully
- ✅ WebSocket connected (or gracefully using polling fallback)
- ✅ Coworking updates < 200ms latency
- ✅ No critical errors in logs

---

## 🚨 If Something Goes Wrong

See `DEPLOYMENT_COMPLETE.md` for:
- Detailed troubleshooting steps
- Rollback procedures
- Common error solutions

**Rollback command (if needed):**
```bash
git revert 0807021  # Revert UI fix
git revert 616b277  # Revert WebSocket
git revert 3630c9a  # Revert Phases 1 & 2
railway up --detach
```

---

## 📝 Post-Deployment Checklist

- [ ] Railway project linked
- [ ] All 3 migrations executed successfully
- [ ] Application deployed
- [ ] WebSocket connecting
- [ ] Orders creating without duplicates
- [ ] Coworking real-time updates working
- [ ] All 5 smoke tests passed
- [ ] Monitoring logs for first hour

**Deployment Date:** _______________
**Deployed By:** je2alvarela@gmail.com
**Result:** ⬜ Success / ⬜ Partial / ⬜ Rolled Back
**Notes:** _______________

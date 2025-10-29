# Deployment Instructions - Bug Fixes

## ✅ Changes Deployed

All 4 critical bugs have been fixed and deployed to Railway:

1. ✅ **Bug 1 - Discount not applied in history** - FIXED
2. ✅ **Bug 2 - Payment method shows Efectivo instead of Crédito** - FIXED
3. ✅ **Bug 3 - Duplicate sales** - FIXED
4. ✅ **Bug 4 - Incorrect daily totals** - FIXED

---

## 🔧 Required: Database Migration

**IMPORTANT**: You MUST run the database migration to add the new columns to your production database.

### Step 1: Access Railway PostgreSQL

```bash
# Option A: Use Railway CLI
railway run psql

# Option B: Get connection string from Railway dashboard
# Then connect using any PostgreSQL client
```

### Step 2: Run Migration Script

Copy and paste the contents of `scripts/add-discount-tip-columns.sql` into your PostgreSQL client:

```sql
-- This will:
-- 1. Add discount column if not exists
-- 2. Add tip column if not exists
-- 3. Set default values for existing records
```

### Step 3: (Optional) Clean Up Duplicates

If you want to remove the duplicate orders from October 27:

1. First, REVIEW the duplicates:
   ```sql
   -- Run the SELECT statements from scripts/cleanup-duplicate-orders.sql
   -- This will show you which orders are duplicates
   ```

2. After verifying, uncomment and run the DELETE statement in `scripts/cleanup-duplicate-orders.sql`

---

## 🧪 Testing the Fixes

### Test 1: Discount Application
1. Go to Sales screen
2. Select customer "Mitzy" (with 30% discount)
3. Add items totaling $65
4. Verify checkout shows $45 (after discount)
5. Complete the sale
6. Check History - should show $45 with discount breakdown

### Test 2: Payment Method
1. Select a customer
2. Choose "Crédito" as payment method
3. Complete the sale
4. Check History - should show "Crédito" not "Efectivo"
5. Check Customer Credits section - should show the charge

### Test 3: No More Duplicates
1. Make a sale
2. Click "Pagar" button multiple times rapidly
3. Check History - should only show ONE order
4. Backend logs should show "⚠️ Duplicate order attempt detected"

### Test 4: Correct Daily Totals
1. Go to Reports or Dashboard
2. Check totals for any date
3. Duplicates are now automatically excluded from calculations
4. Numbers should match manual calculations

---

## 📊 What Changed

### Frontend
- **SalesScreen**: No longer converts Crédito to Efectivo; prevents duplicate submissions
- **AppContext**: Calculates discount properly; clears cart before async ops
- **HistoryScreen**: Shows discount breakdown (subtotal, discount, tip, total)
- **All Report Screens**: Apply deduplication before calculations

### Backend
- **server.js**: Stores discount and tip; implements idempotency validation
- **Database**: New columns `discount` and `tip` in orders table

### New Files
- `utils/deduplication.ts`: Utility functions to remove duplicate orders
- `scripts/add-discount-tip-columns.sql`: Database migration
- `scripts/cleanup-duplicate-orders.sql`: Remove existing duplicates

---

## 🚨 Important Notes

1. **Run the migration ASAP** - The app expects the new columns to exist
2. **Existing orders** will have `discount = 0` and `tip = 0` by default
3. **New orders** will properly store discount and tip values
4. **Duplicates** are now prevented at multiple levels (frontend + backend)
5. **Daily totals** automatically exclude duplicates from calculations

---

## 🐛 If You See Issues

### "Column 'discount' does not exist"
- You need to run the database migration: `scripts/add-discount-tip-columns.sql`

### Duplicates still appearing
- Clear your browser cache and reload
- Verify the deployment completed successfully
- Check Railway logs for idempotency warnings

### Discount not showing in history
- Only NEW orders will show discount breakdown
- Existing orders don't have discount data stored

---

## 📞 Support

If you encounter any issues:
1. Check Railway deployment logs
2. Check browser console for errors
3. Verify database migration completed successfully
4. Review the commit message for detailed changes

**Deployment Complete!** 🎉

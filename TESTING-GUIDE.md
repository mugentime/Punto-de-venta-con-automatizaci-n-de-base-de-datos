# 🧪 Testing Guide - Bug Fixes Verification

## Quick Test URL
**Production App**: https://posclaude-production.up.railway.app

---

## Test 1: Discount Application ✅

### Steps:
1. Navigate to **Sales** screen
2. Select customer: **Mitzy** (30% discount)
3. Add items that total **$65**
4. Click checkout
5. Verify display shows: **$45** (after 30% discount)
6. Click **"Pagar"** to complete sale
7. Go to **History** screen
8. Find the order you just created

### Expected Result:
```
Subtotal: $65.00
Descuento: -$19.50  (in green)
Total: $45.00
```

### ❌ Before Fix:
- History showed $65.00 (no discount)

### ✅ After Fix:
- History shows $45.00 with discount breakdown

---

## Test 2: Payment Method Correct ✅

### Steps:
1. Navigate to **Sales** screen
2. Select a customer with credit limit
3. Add any items to cart
4. Select **"Crédito"** as payment method
5. Complete the sale
6. Go to **History** screen
7. Check the payment method for that order

### Expected Result:
```
Pago: Crédito
```

### ❌ Before Fix:
- History showed "Efectivo" (wrong)

### ✅ After Fix:
- History shows "Crédito" (correct)

---

## Test 3: No Duplicate Sales ✅

### Steps:
1. Navigate to **Sales** screen
2. Add items to cart
3. Click checkout
4. Click **"Pagar"** button
5. **IMMEDIATELY** click "Pagar" button again **5-10 times rapidly**
6. Go to **History** screen
7. Count how many orders were created at the same timestamp

### Expected Result:
```
Only ONE order created
```

### ❌ Before Fix:
- Multiple orders with identical timestamps

### ✅ After Fix:
- Only one order, duplicate attempts logged in console
- Console shows: "⚠️ Order already being processed, ignoring duplicate click"

### Advanced Test (Check Server Logs):
```bash
railway logs
```
Look for: `⚠️ Duplicate order attempt detected via idempotency key`

---

## Test 4: Correct Daily Totals ✅

### Steps:
1. Navigate to **Reports** or **Dashboard** screen
2. Select date: **October 27, 2024**
3. Check the total sales amount

### Expected Result:
```
Total: $772.00
(Duplicates automatically excluded)
```

### ❌ Before Fix:
- Total: $859.00 (included duplicate of $87)

### ✅ After Fix:
- Total: $772.00 (duplicates excluded)
- Console shows: "🧹 Removed X duplicate order(s)"

---

## Comprehensive Test Scenario

### End-to-End Test:
1. **Create a sale for Mitzy**:
   - Item: $65
   - Discount: 30% (-$19.50)
   - Tip: $5
   - Payment: Crédito
   - Expected total: $50.50

2. **Rapidly click "Pagar" 10 times**
   - Only 1 order should be created

3. **Check History**:
   ```
   Subtotal: $65.00
   Descuento: -$19.50
   Propina: +$5.00
   Total: $50.50
   Pago: Crédito
   ```

4. **Check Reports**:
   - Today's total should include this $50.50
   - No duplicate orders should appear
   - Credit section should show $50.50 charge for Mitzy

---

## Database Verification (Optional)

If you have PostgreSQL client installed:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('discount', 'tip');

-- Should return:
-- discount | numeric | 0
-- tip      | numeric | 0

-- Check recent orders with discount
SELECT id, "clientName", subtotal, discount, tip, total, "paymentMethod", created_at
FROM orders
WHERE discount > 0 OR tip > 0
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: Discount not showing in history
**Solution**: This only affects NEW orders. Old orders don't have discount data.

### Issue: Still seeing "Efectivo" instead of "Crédito"
**Solution**: Clear browser cache and reload. Check that latest deployment is live.

### Issue: Duplicates still appearing
**Solution**:
1. Check Railway logs: `railway logs`
2. Verify deployment completed successfully
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: Totals still incorrect
**Solution**: Deduplication only affects calculations, not existing database records. Use the cleanup script to remove old duplicates.

---

## Verification Checklist

After testing, confirm:

- [  ] Discounts display correctly in history
- [ ] "Crédito" payment method shows correctly
- [ ] No duplicate orders when clicking rapidly
- [ ] Daily totals exclude duplicates
- [ ] New orders have discount and tip fields
- [ ] Browser console shows no errors
- [ ] Railway logs show successful deployment

---

## Success Criteria

**All 4 bugs are fixed if**:
✅ History shows discount breakdown
✅ Payment methods display correctly
✅ No duplicates created on rapid clicks
✅ Daily totals are accurate

**Deployment Complete!** 🎉

---

## Next Steps

1. Test all scenarios above
2. Monitor for 24 hours
3. Run cleanup script to remove old duplicates:
   - See `scripts/cleanup-duplicate-orders.sql`
4. Continue normal operations

**If any issues arise**: Check `DEPLOYMENT.md` and Railway logs

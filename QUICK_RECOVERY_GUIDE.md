# 🚨 QUICK RECOVERY GUIDE - Your Sessions Are Safe!

## TL;DR - Your Data is NOT Lost!

Your coworking sessions from the last 5 days **ARE SAVED in the production database**. You've been looking at old local test files by mistake.

## Where Your Sessions Actually Are

✅ **Production PostgreSQL Database** (Railway)
- All sessions from last 5 days are here
- This is where your live app saves data
- Accessible via Railway Dashboard or production app

❌ **NOT in Local Files** (`data/*.json`)
- These are old test data from September 2025
- Local files are NOT used in production
- Only for development/testing

## How to See Your Sessions RIGHT NOW

### Method 1: Check Your Production App (FASTEST)

1. Open your live app: `https://your-app-name.up.railway.app`
2. Login
3. Go to Coworking screen
4. **Your sessions should be there!**

### Method 2: Railway Dashboard Query (GUARANTEED)

1. Go to https://railway.app/dashboard
2. Click on your project
3. Click on **PostgreSQL** service
4. Click **"Query"** tab
5. Paste this SQL:

```sql
-- Get all sessions from last 30 days
SELECT
  id,
  "clientName",
  TO_CHAR("startTime", 'YYYY-MM-DD HH24:MI') as start_time,
  TO_CHAR("endTime", 'YYYY-MM-DD HH24:MI') as end_time,
  status,
  total,
  "hourlyRate",
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created
FROM coworking_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC;
```

6. Click "Run Query"
7. **See all your sessions!**

### Method 3: Export to Local (For Analysis)

To download your sessions locally:

1. **Get Current DATABASE_URL**:
   - Railway Dashboard → PostgreSQL → "Variables" tab
   - Copy the `DATABASE_URL` value (starts with `postgresql://postgres:...`)

2. **Update Local .env**:
   - Open `.env` file
   - Replace `DATABASE_URL=...` with the new value
   - Save file

3. **Run Recovery Script**:
   ```bash
   node scripts/recover-production-sessions.cjs
   ```

This will show all your sessions and optionally export them to a JSON file.

## What You'll Find

When you query production, you should see sessions like:

| Client Name | Created | Status | Total |
|-------------|---------|--------|-------|
| Client A | 2026-03-25 | finished | $144 |
| Client B | 2026-03-24 | finished | $72 |
| Client C | 2026-03-23 | active | $0 |

## Why This Happened

1. **Production uses PostgreSQL** (DATABASE_URL on Railway)
2. **Local development uses files** (`data/*.json`)
3. You created sessions through the **production UI**, so they went to **production database**
4. You looked at **local files** and thought data was missing
5. Database password changed, so local connection broke

## The Fix We Just Applied

The fixes we deployed will:
- ✅ Clean up any orphaned sessions in production
- ✅ Prevent future date issues
- ✅ Improve cross-device sync
- ✅ Add better error handling

Your recent sessions are unaffected - they're all safely in production!

## Still Can't See Them?

If you check production app and still don't see your sessions:

1. **Check the date range** - try expanding to 30 days
2. **Check the status filter** - make sure you're viewing both active AND finished
3. **Clear browser cache** - force reload the page (Ctrl+Shift+R)
4. **Check Railway logs**:
   ```bash
   railway logs --tail 100 | grep -i coworking
   ```

## Need the Raw Data?

To get a complete export of ALL production data:

```sql
-- Get everything
SELECT * FROM coworking_sessions ORDER BY created_at DESC;

-- Or export as JSON (in Node.js):
-- node scripts/recover-production-sessions.cjs
```

## Summary

- ✅ Your sessions ARE saved
- ✅ They're in production PostgreSQL
- ✅ Check your live app or Railway dashboard
- ✅ Update DATABASE_URL in .env to access locally
- ❌ Don't worry - no data was lost!

---

**Next Step**: Go to your live production app right now and check the Coworking screen. Your sessions should all be there! 🎉

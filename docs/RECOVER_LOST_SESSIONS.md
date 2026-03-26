# Recovering Lost Coworking Sessions

## Situation

Sessions created in the UI over the last 5 days are **not appearing** in the local `data/coworking_sessions.json` file. However, since you're using PostgreSQL in production (Railway), **the sessions are likely stored in the production database**.

## Why This Happened

1. Local `coworking_sessions.json` is only used for development
2. Production uses PostgreSQL database on Railway
3. Sessions created through the UI were saved to **production database**, not local files
4. Local files only show old test data from September 2025

## How to Recover Your Sessions

### Option 1: Check Production Database (Recommended)

1. **Get Current DATABASE_URL**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click on your PostgreSQL service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL` value

2. **Update Local .env**:
   ```bash
   # Replace the old DATABASE_URL in .env with the current one
   DATABASE_URL=postgresql://postgres:NEW_PASSWORD@caboose.proxy.rlwy.net:27640/railway
   ```

3. **Run Recovery Script**:
   ```bash
   node scripts/recover-production-sessions.cjs
   ```

   This will:
   - ✅ Connect to production database
   - ✅ Show all sessions from last 30 days
   - ✅ Identify sessions from last 5 days
   - ✅ Show detailed information
   - ✅ Optionally export to JSON

### Option 2: Query Production Database Directly

Use Railway Dashboard to run this SQL:

```sql
-- Get sessions from last 5 days
SELECT
  id,
  "clientName",
  "startTime",
  "endTime",
  status,
  total,
  created_at
FROM coworking_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '5 days'
ORDER BY created_at DESC;
```

### Option 3: Check Via Production API

If the production app is running, you can fetch from the API:

```bash
# Get your production URL
curl https://your-app.up.railway.app/api/coworking-sessions?limit=100

# Or in browser:
# https://your-app.up.railway.app/api/coworking-sessions
```

### Option 4: Check Browser Cache

Sessions might be cached in browser localStorage:

1. Open your production app in browser
2. Open DevTools (F12)
3. Go to "Application" or "Storage" tab
4. Check "Local Storage" and "Session Storage"
5. Look for keys like:
   - `coworking_sessions`
   - `sessionCache`
   - Any keys with session data

## What the Data Should Look Like

Recent sessions should have:
```json
{
  "id": "session_xyz123",
  "clientName": "Your Client Name",
  "startTime": "2026-03-21T10:00:00.000Z",
  "endTime": "2026-03-21T12:00:00.000Z",
  "status": "finished",
  "total": 144.00,
  "created_at": "2026-03-21T10:00:00.000Z"
}
```

## If Sessions Are Actually Missing

If you run the recovery script and find **0 sessions from the last 5 days**, it means:

### Possible Causes:

1. **API Errors During Creation**:
   - Check browser console for errors
   - Check Railway logs for failed POST requests
   - Sessions may have failed silently

2. **Sessions Only in Browser Cache**:
   - Never persisted to database
   - Lost when browser cache cleared
   - Check localStorage/sessionStorage

3. **Wrong Database/Environment**:
   - Using different database than expected
   - Sessions in a different environment
   - Check Railway environment variables

### Next Steps if Data is Lost:

1. **Check Railway Logs**:
   ```bash
   # If Railway CLI is installed
   railway logs --tail 1000 | grep -i "coworking\|session"
   ```

2. **Check for Related Orders**:
   - Sessions that were finalized become orders
   - Check `orders` table for recent coworking orders
   - Recovery script does this automatically

3. **Reconstruct from Memory** (last resort):
   - Manually recreate sessions if you remember details
   - Use the now-working system to re-enter data

## Prevention Going Forward

The fixes we just implemented will prevent this from happening again:

✅ **Future date validation** - Rejects invalid dates
✅ **Better error handling** - Shows clear error messages
✅ **Automatic refresh** - Syncs data across devices
✅ **Auto-migration** - Cleans up orphaned sessions
✅ **Proper logging** - Track when sessions are created/closed

## Need Help?

Run the recovery script first:
```bash
node scripts/recover-production-sessions.cjs
```

It will tell you exactly what's in the production database and guide you through recovery options.

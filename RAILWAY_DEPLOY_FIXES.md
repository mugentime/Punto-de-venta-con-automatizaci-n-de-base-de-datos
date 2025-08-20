# Railway Deployment Fixes for POS Conejo Negro

## Issues Fixed

### 1. Authentication Routes 404 Error
**Problem**: Circular dependency in auth middleware caused routes to not load
**Solution**: 
- Extracted auth middleware to separate file: `/middleware/auth-file.js`
- Updated all route files to import from the new location
- Removed circular dependency between auth routes and middleware

### 2. Non-Persistent Storage
**Problem**: Using `/tmp/pos-data` which gets wiped on Railway restarts
**Solution**:
- Updated storage path to `/app/data` for Railway persistence
- Configured `RAILWAY_VOLUME_MOUNT_PATH` environment variable
- Added fallback storage logic for both Railway and local development

### 3. Missing Environment Variables
**Problem**: JWT_SECRET and other required variables not configured
**Solution**:
- Created `.env.railway.example` with all required variables
- Updated `railway.json` with proper environment configuration
- Added documentation for secure JWT secret generation

## Required Railway Environment Variables

Set these in your Railway dashboard under Settings > Environment:

```env
NODE_ENV=production
JWT_SECRET=your-64-character-secure-jwt-secret-generate-new-one
RAILWAY_VOLUME_MOUNT_PATH=/app/data
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12
TZ=America/Mexico_City
```

## Generate JWT Secret

Run this command to generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment Steps

1. **Commit and push changes to your repository**
2. **Set environment variables in Railway dashboard**
3. **Redeploy the application**
4. **Verify endpoints are working**

## Testing After Deployment

### Test Authentication Endpoint
```bash
curl -X POST https://pos-conejonegro-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@conejonegro.com","password":"admin123"}'
```

### Test Products Endpoint (after login)
```bash
curl https://pos-conejonegro-production.up.railway.app/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Health Endpoint
```bash
curl https://pos-conejonegro-production.up.railway.app/api/health
```

## Expected Results

- `/api/auth/login` should return 200 with JWT token
- `/api/products` should return 401 without auth, 200 with valid token
- `/api/health` should show persistent storage path `/app/data`
- Data should persist between Railway restarts

## File Structure Changes

```
middleware/
├── auth-file.js          # NEW: Extracted auth middleware

routes/
├── auth-file.js          # UPDATED: Removed circular dependency
├── products-file.js      # UPDATED: Import from middleware/
├── records-file.js       # UPDATED: Import from middleware/
└── backup-file.js        # UPDATED: Import from middleware/

utils/
└── fileDatabase.js       # UPDATED: Railway storage path

.env.railway.example      # NEW: Environment variable template
railway.json              # UPDATED: Environment configuration
```

## Troubleshooting

### If auth routes still return 404:
1. Check Railway logs for import errors
2. Verify all files were uploaded correctly
3. Ensure environment variables are set

### If data is still not persistent:
1. Verify `RAILWAY_VOLUME_MOUNT_PATH=/app/data` is set
2. Check if Railway plan supports persistent storage
3. Monitor storage usage in Railway dashboard

### If JWT errors occur:
1. Ensure JWT_SECRET is set and 32+ characters
2. Check for special characters in the secret
3. Regenerate secret if needed

## Admin Login Credentials

After successful deployment, use these credentials:
- Email: `admin@conejonegro.com`
- Password: `admin123`

**Important**: Change the admin password after first login!
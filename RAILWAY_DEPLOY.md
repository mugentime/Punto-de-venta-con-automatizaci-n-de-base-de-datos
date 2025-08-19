# Railway Deployment Guide for Conejo Negro POS

This guide will help you deploy your POS system to Railway with MongoDB Atlas and persistent cloud storage.

## 🚀 Railway Deployment Steps

### 1. Prerequisites

- Railway account at [railway.app](https://railway.app)
- MongoDB Atlas account at [cloud.mongodb.com](https://cloud.mongodb.com)
- GitHub repository with your code

### 2. Set Up MongoDB Atlas

#### Create MongoDB Database:

1. **Sign up for MongoDB Atlas**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a free account
   - Create a new cluster (use M0 free tier)

2. **Configure Database Access**
   ```bash
   # Create database user:
   # Username: conejonegro
   # Password: Generate a strong password
   # Role: Read and write to any database
   ```

3. **Configure Network Access**
   - Add IP Address: `0.0.0.0/0` (Allow access from anywhere)
   - Or add Railway IP ranges for better security

4. **Get Connection String**
   ```
   mongodb+srv://conejonegro:<password>@cluster0.xxxxx.mongodb.net/conejo-negro-pos?retryWrites=true&w=majority
   ```

### 3. Prepare for Railway

#### Update CORS Configuration:

Edit `server.js` to handle Railway domain:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://your-app.railway.app',
        'https://yourdomain.com'  // If you have a custom domain
      ]
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
```

### 4. Deploy to Railway

#### Option A: Deploy from GitHub

1. **Connect GitHub Repository**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" 
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Railway will automatically:**
   - Detect Node.js project
   - Install dependencies with `npm install`
   - Start with `npm start`

#### Option B: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy**
   ```bash
   railway login
   railway init
   railway up
   ```

### 5. Configure Environment Variables

In Railway Dashboard > Your Project > Variables, add:

```env
# Database
MONGODB_URI=mongodb+srv://conejonegro:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/conejo-negro-pos?retryWrites=true&w=majority

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-here

# Server
NODE_ENV=production
PORT=3000

# Railway Storage
RAILWAY_VOLUME_MOUNT_PATH=/app/storage

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timezone
TZ=America/Mexico_City
```

### 6. Set Up Persistent Storage (Optional)

Railway provides ephemeral storage by default. For persistent storage:

#### Option A: Use Railway Volumes (Paid Plans)
- Enable persistent volumes in Railway dashboard
- Set `RAILWAY_VOLUME_MOUNT_PATH=/app/storage`

#### Option B: External Storage
- Use AWS S3, Cloudinary, or similar
- Update the `cloudStorage.js` to use external API

### 7. Initialize Database

After deployment, initialize your database:

1. **Find your Railway App URL**
   - Go to Railway Dashboard
   - Your app URL: `https://your-app.railway.app`

2. **Run Setup via API**
   ```bash
   # Method 1: Add a setup route
   curl -X POST https://your-app.railway.app/api/setup

   # Method 2: Use Railway CLI
   railway run npm run setup
   ```

### 8. Configure Custom Domain (Optional)

1. **In Railway Dashboard:**
   - Go to Settings > Domains
   - Add your custom domain
   - Configure DNS records as instructed

2. **Update CORS origins** in environment variables

### 9. Enable Automatic Backups

The system will automatically create backups if properly configured:

- **Daily backups**: 2 AM UTC
- **Weekly backups**: Sunday 3 AM UTC  
- **Monthly backups**: 1st of month 4 AM UTC

Check logs to ensure backups are working:
```bash
railway logs
```

## 🔧 Railway Configuration Files

The following files configure Railway deployment:

### `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 60
  }
}
```

### `railway.toml` 
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 60
restartPolicyType = "always"

[[services]]
name = "web"
port = 3000
```

## 📊 Storage Architecture

### Local/Railway Storage:
```
/app/storage/
├── backups/          # Daily/weekly/monthly backups
├── exports/          # CSV/JSON exports for download
└── cache/           # Temporary cached data
```

### Backup Strategy:
1. **Database backups** stored in Railway volume or local storage
2. **File-based backups** with checksums for integrity
3. **Automatic cleanup** of old files
4. **Export functionality** for manual downloads

## 🛠️ Post-Deployment Checklist

- [ ] ✅ App deploys successfully  
- [ ] ✅ Database connection works
- [ ] ✅ Admin user can login (admin@conejonegro.com)
- [ ] ✅ Can create products and records
- [ ] ✅ Backups are being created
- [ ] ✅ Health check endpoint works: `/api/health`
- [ ] ✅ Storage directory is writable
- [ ] ✅ Scheduled tasks are running

## 🔍 Troubleshooting

### Common Issues:

1. **MongoDB Connection Error**
   ```bash
   # Check MongoDB Atlas:
   - IP whitelist includes 0.0.0.0/0
   - Database user has correct permissions
   - Connection string is correct
   ```

2. **Storage Permission Errors**
   ```bash
   # Check Railway logs:
   railway logs
   
   # Ensure storage path is writable
   # Railway automatically handles permissions
   ```

3. **Environment Variables Not Set**
   ```bash
   # Verify all required environment variables are set
   # Check Railway Dashboard > Variables
   ```

4. **CORS Issues**
   ```bash
   # Update CORS origins to include Railway domain
   # Check browser console for CORS errors
   ```

### Debug Commands:

```bash
# View deployment logs
railway logs

# Connect to Railway shell
railway shell

# Check environment variables
railway variables

# Redeploy
railway up --detach
```

## 📈 Monitoring

### Health Check:
- URL: `https://your-app.railway.app/api/health`
- Returns server status and uptime

### Database Stats:
- Monitor MongoDB Atlas dashboard
- Check connection metrics

### Storage Usage:
- Check backup file sizes
- Monitor storage growth
- Clean up old files regularly

## 💰 Cost Considerations

### Railway:
- **Hobby Plan**: $5/month (512MB RAM, no persistent volume)
- **Pro Plan**: $20/month (8GB RAM, persistent volumes)

### MongoDB Atlas:
- **Free M0**: 512MB storage, shared CPU
- **Paid M2+**: More storage and dedicated resources

### Recommendations:
- Start with free tiers for testing
- Upgrade when you need persistent storage
- Monitor usage to optimize costs

---

## 🚀 Quick Deploy

To deploy quickly:

1. Fork this repository
2. Create Railway account
3. Connect GitHub repo to Railway  
4. Set environment variables
5. Deploy automatically

Your POS system will be live at `https://your-app.railway.app`!

---

**Need help?** Check Railway docs at [docs.railway.app](https://docs.railway.app)
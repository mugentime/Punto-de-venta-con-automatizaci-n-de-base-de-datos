# Conejo Negro POS System

> Deploy trigger: auth fix verification at 2025-09-10T16:26Z

A complete Point of Sale system for Conejo Negro Café with authentication, inventory management, sales tracking, and automated Google Drive backups.

## 🚀 Features

- **🔐 User Authentication**: Secure login system with role-based permissions
- **📦 Inventory Management**: Track products for both cafetería and refrigerador
- **💰 Sales Recording**: Register client transactions with service types
- **💸 Cash Cuts (Cortes de Caja)**: Complete cash flow management system
- **📊 Reporting**: Daily, weekly, and monthly reports with statistics
- **☁️ Cloud Backup**: Automated Google Drive backups with scheduling
- **🔄 Real-time Sync**: Multi-user support with data synchronization
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices
- **🛡️ Security**: JWT authentication, input validation, and rate limiting

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **MongoDB** (v5.0 or higher)
- **npm** or **yarn**

## 🛠️ Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/conejo-negro-pos

# JWT Secret (Generate a strong secret key)
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=3000
NODE_ENV=development

# Google Drive API Credentials (See Google Drive Setup below)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Set Up Google Drive Integration

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API

#### Step 2: Create Credentials
1. Go to "Credentials" in Google Cloud Console
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Set application type as "Desktop application"
4. Download the credentials JSON file

#### Step 3: Get Refresh Token
Run this script to get your refresh token:

```javascript
// get-refresh-token.js
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost'
);

const scopes = ['https://www.googleapis.com/auth/drive'];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('Visit this URL:', url);
console.log('Enter the authorization code:');

// After getting the code, exchange it for tokens:
// oauth2Client.getToken(code, (err, token) => {
//   console.log('Refresh Token:', token.refresh_token);
// });
```

### 4. Initialize Database

Run the setup script to create the admin user and sample data:

```bash
npm run setup
```

This will:
- Create an admin user (admin@conejonegro.com / admin123)
- Add sample products for cafetería and refrigerador
- Set up the database indexes

### 5. Start the Server

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## 🎭 Playwright MCP Server

The project includes a Playwright MCP (Model Context Protocol) server for browser automation and testing. This enables AI agents like Claude to interact with the POS system through web automation.

### Prerequisites

- **@playwright/mcp**: Installed as dev dependency
- **Chromium Browser**: Automatically installed with Playwright
- **Port 3001**: Must be available (used by MCP server)

### Quick Start

#### Start MCP Server
```bash
# Option 1: Direct npm script
npm run mcp:playwright

# Option 2: Using management script
npm run mcp:playwright:start
# or
powershell -File scripts/manage-playwright-mcp.ps1 start
```

#### Check Status
```bash
npm run mcp:playwright:status
```

#### Stop Server
```bash
npm run mcp:playwright:stop
```

### Configuration

The MCP server is configured in `.mcp.json` alongside other MCP servers:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "sse",
      "url": "http://localhost:3001/mcp",
      "enabled": true,
      "description": "Playwright MCP server for POS at http://localhost:3000"
    }
  }
}
```

### Features

- **🎯 Browser Automation**: Control Chrome/Chromium programmatically
- **📷 Screenshots**: Capture visual state of the POS system
- **🔍 Element Interaction**: Click, type, and navigate through the interface
- **⚡ Real-time Testing**: Live browser automation for testing and debugging
- **🤖 AI Integration**: Works with Claude and other MCP-compatible AI clients

### Architecture Integration

The Playwright MCP server integrates with the existing Task Master architecture:

- **Task Master**: Main orchestrator and architect for project workflows
- **Claude-Flow**: Handles development workflows and task management
- **Ruv-Swarm**: Manages multi-agent coordination
- **Playwright MCP**: Provides browser automation capabilities

### Testing

Run the smoke test to verify Playwright can interact with the POS:

```bash
node scripts/playwright.smoke.js
```

### Troubleshooting

#### Port Issues
- Ensure port 3001 is not in use by other applications
- Check Windows Firewall settings if connecting from external machines

#### Browser Issues
- Run `npx playwright install chromium` to reinstall browser
- Check if antivirus software is blocking browser execution

#### Log Files
Logs are stored in `./logs/` directory:
- `playwright-mcp.out.log`: Server output
- `playwright-mcp.err.log`: Error messages
- `smoke-test-screenshot.png`: Test screenshots

## 🌐 Usage

### Access Points

- **Main POS**: `http://localhost:3000`
- **Online Version**: `http://localhost:3000/online` (with authentication)

### Default Admin Account

- **Email**: `admin@conejonegro.com`
- **Password**: `admin123`

**⚠️ IMPORTANT**: Change the admin password immediately after first login!

### User Roles

- **Admin**: Full access to all features including user management
- **Manager**: Can manage inventory, view reports, export data
- **Employee**: Can register clients and manage inventory

## 📁 Project Structure

```
conejo-negro-pos/
├── models/              # Database models
│   ├── User.js         # User authentication & permissions
│   ├── Product.js      # Inventory products
│   ├── Record.js       # Sales records
│   └── Backup.js       # Backup management
├── routes/              # API endpoints
│   ├── auth.js         # Authentication routes
│   ├── products.js     # Product management
│   ├── records.js      # Sales recording
│   └── backup.js       # Backup operations
├── middleware/          # Express middleware
│   └── auth.js         # Authentication middleware
├── utils/               # Utility services
│   ├── googleDrive.js  # Google Drive integration
│   ├── backupService.js # Backup management
│   └── scheduler.js    # Automated tasks
├── temp/                # Temporary files (created automatically)
├── server.js           # Main server file
├── setup.js            # Database initialization
└── package.json        # Dependencies & scripts
```

## 💸 Cash Cuts (Cortes de Caja)

Complete cash flow management system for tracking daily cash operations.

### Features

- **🆕 Cash Cut Creation**: Open cash drawer with initial amount
- **📝 Movement Tracking**: Record sales, expenses, and adjustments
- **🔒 Cash Cut Closing**: Final count with automatic difference calculation  
- **🤖 Automated Cuts**: Scheduled cash cuts using cron jobs
- **🔒 Constraints**: Prevents multiple open cash cuts simultaneously
- **📊 Real-time Status**: Live tracking of cash flow and expected amounts

### Quick Start

#### 1. Environment Setup
```bash
# Optional: Set automated cash cuts (daily at 11 PM)
CASHCUT_CRON="0 23 * * *"

# Set timezone
TZ="America/Mexico_City"
```

#### 2. API Usage
```bash
# Create cash cut
curl -X POST http://localhost:3000/api/cashcuts \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"openingAmount": 1000, "openedBy": "user-id"}'

# Add movement  
curl -X POST http://localhost:3000/api/cashcuts/CASH_CUT_ID/entries \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "sale", "amount": 250.50, "note": "Coffee sale"}'

# Close cash cut
curl -X POST http://localhost:3000/api/cashcuts/CASH_CUT_ID/close \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"closingAmount": 1245.50, "closedBy": "user-id"}'
```

#### 3. Frontend Integration

Access cash cut management through:
- **Main POS Interface**: Integrated cash cut buttons and status indicators
- **Detailed Modal**: Complete cash cut information with movement history
- **Real-time Updates**: Live status of open/closed cash cuts

### Configuration

#### Cron Schedule Examples
- **Disabled**: `CASHCUT_CRON=off`
- **Daily 11 PM**: `CASHCUT_CRON="0 23 * * *"`
- **Every 4 hours**: `CASHCUT_CRON="0 */4 * * *"`
- **Development (every 2 min)**: `CASHCUT_CRON="*/2 * * * *"`

#### Database Support
- **PostgreSQL**: Full support with constraints and transactions
- **File-based**: JSON storage with atomic operations

### Documentation

For detailed API documentation, troubleshooting, and PowerShell examples:
➡️ **[Complete Cash Cuts Documentation](./docs/cashcut.md)**

---

## 🔄 Backup System

### Automated Backups

The system automatically creates backups:
- **Daily**: Every day at 2:00 AM
- **Weekly**: Every Sunday at 3:00 AM
- **Monthly**: 1st of each month at 4:00 AM

### Manual Backups

Create manual backups via the API:

```bash
curl -X POST http://localhost:3000/api/backup/create \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "manual"}'
```

### Backup Management

- All backups are stored in Google Drive
- Old backups are automatically cleaned up (30-day retention)
- Backups include users, products, sales records, and statistics
- Restore functionality available for admins

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with configurable rounds
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin requests
- **Helmet Security**: HTTP security headers

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify token
- `GET /api/auth/profile` - Get user profile

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/stock` - Update stock

### Records
- `GET /api/records` - List sales records
- `POST /api/records` - Create sale record
- `GET /api/records/today/summary` - Today's summary
- `GET /api/records/stats/range` - Statistics by date range

### Backups
- `POST /api/backup/create` - Create backup
- `GET /api/backup/list` - List backups
- `GET /api/backup/:id/download` - Download backup
- `POST /api/backup/cleanup` - Cleanup old backups

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/conejo-negro-pos` |
| `JWT_SECRET` | JWT signing secret | Required |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Google Drive Configuration

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 Refresh Token |
| `GOOGLE_DRIVE_FOLDER_ID` | Backup folder ID (optional) |

## 🚀 Production Deployment

### 1. Environment Setup
```bash
NODE_ENV=production
# Update all environment variables for production
```

### 2. Database
- Use a production MongoDB instance
- Set up MongoDB Atlas or self-hosted MongoDB
- Configure backup and monitoring

### 3. Reverse Proxy
Set up nginx or similar:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Process Management
Use PM2 for production:

```bash
npm install -g pm2
pm2 start server.js --name "conejo-negro-pos"
pm2 startup
pm2 save
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`

2. **Google Drive Authentication Failed**
   - Verify OAuth2 credentials
   - Check refresh token validity
   - Ensure Drive API is enabled

3. **JWT Token Invalid**
   - Check JWT_SECRET in environment
   - Clear browser storage/cookies

4. **Permission Denied Errors**
   - Check user role and permissions
   - Verify authentication middleware

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run dev
```

### Logs

Check application logs:
- Console output for development
- PM2 logs for production: `pm2 logs conejo-negro-pos`

## 📞 Support

For support or questions:

1. Check the troubleshooting section
2. Review environment configuration
3. Verify Google Drive setup
4. Check MongoDB connection

## 🔄 Updates

To update the system:

1. Pull latest code
2. Run `npm install` for new dependencies
3. Run `npm run setup` if database changes are needed
4. Restart the server

---

**🏪 Conejo Negro POS System** - Built with ❤️ for efficient café managementForce redeploy

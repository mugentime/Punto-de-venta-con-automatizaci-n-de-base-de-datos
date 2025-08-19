# Security Setup Guide

This guide explains how to securely configure your POS system with Google Drive integration.

## 🔐 Important Security Notes

**NEVER commit real credentials to version control!**

## 🛠️ Secure Setup Process

### 1. Create Your Environment File

Copy the example and customize it:
```bash
cp .env.example .env
```

### 2. Generate Strong JWT Secret

Use a strong, random JWT secret:
```bash
# On Linux/Mac:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Google Drive Setup (Secure Method)

#### Option A: Use Service Account (Recommended)
1. Go to Google Cloud Console
2. Create a service account
3. Download the service account key JSON
4. Share your Google Drive backup folder with the service account email
5. Use service account credentials instead of OAuth2

#### Option B: OAuth2 Setup
If you must use OAuth2, follow these steps:

1. **Create OAuth2 Credentials**:
   - Go to Google Cloud Console
   - Enable Drive API
   - Create OAuth2 credentials
   - Set authorized redirect URIs

2. **Get Refresh Token Securely**:
   ```javascript
   // secure-setup.js
   const { google } = require('googleapis');
   const readline = require('readline');
   
   const oauth2Client = new google.auth.OAuth2(
     process.env.GOOGLE_CLIENT_ID,
     process.env.GOOGLE_CLIENT_SECRET,
     'urn:ietf:wg:oauth:2.0:oob' // For installed applications
   );
   
   const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
   
   async function getAccessToken() {
     const authUrl = oauth2Client.generateAuthUrl({
       access_type: 'offline',
       scope: SCOPES,
     });
   
     console.log('Authorize this app by visiting this url:', authUrl);
     
     const rl = readline.createInterface({
       input: process.stdin,
       output: process.stdout,
     });
   
     return new Promise((resolve) => {
       rl.question('Enter the code from that page here: ', (code) => {
         rl.close();
         oauth2Client.getToken(code, (err, token) => {
           if (err) return console.error('Error retrieving access token', err);
           console.log('Refresh token:', token.refresh_token);
           resolve(token);
         });
       });
     });
   }
   
   getAccessToken();
   ```

### 4. Environment Variables Security

Your `.env` file should look like this:

```env
# Database - Use strong password in production
MONGODB_URI=mongodb://username:strongpassword@localhost:27017/conejo-negro-pos

# JWT - Use output from step 2
JWT_SECRET=your-very-strong-secret-key-here

# Server Configuration
PORT=3000
NODE_ENV=production  # Set to production for deployment

# Google Drive - Use your actual credentials
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REFRESH_TOKEN=your-actual-refresh-token

# Optional: Pre-created folder ID
GOOGLE_DRIVE_FOLDER_ID=your-backup-folder-id

# Security Settings
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. File Permissions

Set proper file permissions:

```bash
# Make .env readable only by owner
chmod 600 .env

# Secure the application directory
chmod -R 755 .
chmod 600 .env
```

### 6. Database Security

#### MongoDB Security:
1. **Enable Authentication**:
   ```javascript
   // In MongoDB
   use admin
   db.createUser({
     user: "conejonegro",
     pwd: "very-strong-password",
     roles: [ { role: "readWrite", db: "conejo-negro-pos" } ]
   })
   ```

2. **Update Connection String**:
   ```env
   MONGODB_URI=mongodb://conejonegro:very-strong-password@localhost:27017/conejo-negro-pos?authSource=admin
   ```

### 7. Production Security Checklist

- [ ] Use HTTPS in production (SSL/TLS certificate)
- [ ] Set `NODE_ENV=production`
- [ ] Use strong passwords for all accounts
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Use firewall to restrict access
- [ ] Regular backups verification
- [ ] Use process manager (PM2) with proper logging
- [ ] Set up monitoring and alerts

### 8. Google Drive Folder Setup

1. **Create Backup Folder**:
   - Create a dedicated folder for backups
   - Copy the folder ID from the URL
   - Add it to `GOOGLE_DRIVE_FOLDER_ID`

2. **Set Proper Permissions**:
   - Only grant access to necessary accounts
   - Use service account when possible
   - Regularly review access permissions

### 9. User Account Security

1. **Change Default Admin Password**:
   ```bash
   # After first login, immediately change password
   # Default: admin@conejonegro.com / admin123
   ```

2. **Create Proper User Roles**:
   - Only give necessary permissions
   - Regular employees shouldn't have admin access
   - Use principle of least privilege

## 🚨 Security Warnings

### Never Do This:
- ❌ Use the example credentials provided in documentation
- ❌ Commit `.env` file to git
- ❌ Use weak passwords
- ❌ Share credentials via email/chat
- ❌ Use production credentials in development
- ❌ Leave default passwords unchanged

### Always Do This:
- ✅ Use environment variables for sensitive data
- ✅ Generate strong, unique passwords
- ✅ Enable HTTPS in production
- ✅ Regular security updates
- ✅ Monitor access logs
- ✅ Use proper file permissions
- ✅ Backup encryption keys securely

## 🔄 Credential Rotation

Regularly rotate your credentials:

1. **Monthly**: Rotate JWT secrets
2. **Quarterly**: Rotate database passwords
3. **Annually**: Rotate Google Drive credentials
4. **Immediately**: If any credential is compromised

## 📋 Security Testing

Before going live:

1. **Test Authentication**:
   ```bash
   # Try invalid tokens
   curl -H "Authorization: Bearer invalid-token" http://localhost:3000/api/auth/verify
   ```

2. **Test Rate Limiting**:
   ```bash
   # Send many requests rapidly
   for i in {1..150}; do curl http://localhost:3000/api/health; done
   ```

3. **Test Input Validation**:
   - Try SQL injection attempts
   - Test with malformed JSON
   - Send oversized requests

## 🆘 Incident Response

If credentials are compromised:

1. **Immediately**:
   - Revoke compromised credentials
   - Change all passwords
   - Generate new JWT secrets
   - Check access logs

2. **Within 24 hours**:
   - Audit all user accounts
   - Review recent activities
   - Update all systems
   - Notify relevant parties

3. **Long term**:
   - Improve security measures
   - Update procedures
   - Additional monitoring

---

**Remember**: Security is not a one-time setup, it's an ongoing process!
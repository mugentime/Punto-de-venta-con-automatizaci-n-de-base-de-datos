const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.initialized = false;
  }

  // Initialize Google Drive API
  async initialize() {
    try {
      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost' // Redirect URL (not used for server-side)
      );

      // Set refresh token
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      this.auth = oauth2Client;
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;

      // Test the connection
      await this.testConnection();
      
      console.log('✅ Google Drive API initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Test Google Drive connection
  async testConnection() {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const response = await this.drive.about.get({ fields: 'user' });
      console.log('📱 Connected to Google Drive as:', response.data.user.emailAddress);
      return response.data.user;
    } catch (error) {
      throw new Error(`Google Drive connection test failed: ${error.message}`);
    }
  }

  // Create backup folder if it doesn't exist
  async ensureBackupFolder() {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      // Check if folder exists
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      if (folderId) {
        // Verify the folder exists and we have access
        try {
          await this.drive.files.get({ fileId: folderId });
          return folderId;
        } catch (error) {
          console.warn('⚠️ Specified folder not accessible, creating new one');
        }
      }

      // Create new backup folder
      const folderMetadata = {
        name: 'Conejo Negro POS Backups',
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Automated backups from Conejo Negro POS System'
      };

      const response = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id'
      });

      console.log('📁 Created backup folder with ID:', response.data.id);
      return response.data.id;
    } catch (error) {
      throw new Error(`Failed to ensure backup folder: ${error.message}`);
    }
  }

  // Upload file to Google Drive
  async uploadFile(filePath, fileName, folderId) {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
        description: `Backup created on ${new Date().toISOString()}`
      };

      const media = {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,name,size,createdTime'
      });

      console.log('📤 File uploaded successfully:', {
        id: response.data.id,
        name: response.data.name,
        size: response.data.size
      });

      return {
        fileId: response.data.id,
        name: response.data.name,
        size: parseInt(response.data.size) || 0,
        createdTime: response.data.createdTime
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Download file from Google Drive
  async downloadFile(fileId, destinationPath) {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      });

      const writer = fs.createWriteStream(destinationPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('📥 File downloaded successfully to:', destinationPath);
          resolve(destinationPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  // List files in backup folder
  async listBackupFiles(folderId, maxResults = 50) {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const query = folderId ? `'${folderId}' in parents` : "name contains 'conejo-negro-backup'";
      
      const response = await this.drive.files.list({
        q: query,
        pageSize: maxResults,
        fields: 'files(id,name,size,createdTime,modifiedTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Failed to list backup files: ${error.message}`);
    }
  }

  // Delete old backup files
  async deleteOldBackups(folderId, retentionDays = 30) {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const files = await this.listBackupFiles(folderId, 100);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const file of files) {
        const fileDate = new Date(file.createdTime);
        
        if (fileDate < cutoffDate) {
          try {
            await this.drive.files.delete({ fileId: file.id });
            console.log(`🗑️ Deleted old backup: ${file.name}`);
            deletedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete file ${file.name}:`, error.message);
          }
        }
      }

      console.log(`🧹 Cleanup completed. Deleted ${deletedCount} old backup files.`);
      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to delete old backups: ${error.message}`);
    }
  }

  // Get storage quota information
  async getStorageInfo() {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      const quota = response.data.storageQuota;
      return {
        used: parseInt(quota.usage) || 0,
        total: parseInt(quota.limit) || 0,
        usedByBackups: parseInt(quota.usageInDrive) || 0
      };
    } catch (error) {
      throw new Error(`Failed to get storage info: ${error.message}`);
    }
  }

  // Create shareable link for a file
  async createShareableLink(fileId) {
    if (!this.initialized) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      // Make file accessible via link
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get the webViewLink
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'webViewLink'
      });

      return response.data.webViewLink;
    } catch (error) {
      throw new Error(`Failed to create shareable link: ${error.message}`);
    }
  }
}

// Export singleton instance
const googleDriveService = new GoogleDriveService();

module.exports = googleDriveService;
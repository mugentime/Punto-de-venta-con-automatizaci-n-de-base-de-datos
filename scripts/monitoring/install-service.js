#!/usr/bin/env node

/**
 * Service Installation Helper
 * Creates system service configurations for different platforms
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ServiceInstaller {
    constructor() {
        this.projectRoot = path.join(__dirname, '../..');
        this.serviceName = 'railway-monitor';
        this.serviceDescription = 'Railway Monitor for POS Conejo Negro';
        this.serviceScript = path.join(__dirname, 'monitor-service.js');
    }

    async generateSystemdService() {
        const serviceContent = `[Unit]
Description=${this.serviceDescription}
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=${this.projectRoot}
ExecStart=/usr/bin/node ${this.serviceScript} start
ExecStop=/usr/bin/node ${this.serviceScript} stop
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${this.serviceName}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

        const servicePath = `/etc/systemd/system/${this.serviceName}.service`;
        
        console.log('🐧 Linux Systemd Service Configuration:');
        console.log('');
        console.log('1. Save the following content to:', servicePath);
        console.log('');
        console.log(serviceContent);
        console.log('');
        console.log('2. Run these commands as root:');
        console.log(`   sudo systemctl daemon-reload`);
        console.log(`   sudo systemctl enable ${this.serviceName}`);
        console.log(`   sudo systemctl start ${this.serviceName}`);
        console.log('');
        console.log('3. Check status:');
        console.log(`   sudo systemctl status ${this.serviceName}`);
        console.log(`   sudo journalctl -u ${this.serviceName} -f`);

        return servicePath;
    }

    async generateWindowsService() {
        const batchContent = `@echo off
REM Railway Monitor Windows Service
REM Install using NSSM (Non-Sucking Service Manager)

set SERVICE_NAME=${this.serviceName}
set SERVICE_DISPLAY_NAME=${this.serviceDescription}
set NODE_PATH=${process.execPath}
set SCRIPT_PATH=${this.serviceScript}
set WORK_DIR=${this.projectRoot}

echo Installing Railway Monitor as Windows Service...

REM Download NSSM if not present
if not exist "nssm.exe" (
    echo Please download NSSM from https://nssm.cc/download
    echo Extract nssm.exe to this directory
    pause
    exit /b 1
)

REM Install service
nssm install "%SERVICE_NAME%" "%NODE_PATH%" "%SCRIPT_PATH%" start
nssm set "%SERVICE_NAME%" DisplayName "%SERVICE_DISPLAY_NAME%"
nssm set "%SERVICE_NAME%" Description "Monitors Railway deployment health for POS Conejo Negro"
nssm set "%SERVICE_NAME%" AppDirectory "%WORK_DIR%"
nssm set "%SERVICE_NAME%" Start SERVICE_AUTO_START
nssm set "%SERVICE_NAME%" ObjectName LocalSystem

echo Service installed successfully!
echo.
echo To manage the service:
echo   net start %SERVICE_NAME%
echo   net stop %SERVICE_NAME%
echo   nssm remove %SERVICE_NAME% confirm
echo.
echo Service will start automatically on system boot.

pause
`;

        console.log('🪟 Windows Service Configuration:');
        console.log('');
        console.log('1. Download NSSM from: https://nssm.cc/download');
        console.log('2. Extract nssm.exe to the monitoring directory');
        console.log('3. Run the batch file as Administrator');
        console.log('');
        console.log('Batch file content:');
        console.log(batchContent);

        const batchPath = path.join(__dirname, 'install-windows-service.bat');
        await fs.writeFile(batchPath, batchContent);
        console.log(`📄 Batch file created: ${batchPath}`);

        return batchPath;
    }

    async generateMacOSService() {
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.conejonegro.${this.serviceName}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${this.serviceScript}</string>
        <string>start</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${this.projectRoot}</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>${this.projectRoot}/logs/monitoring/service.log</string>
    
    <key>StandardErrorPath</key>
    <string>${this.projectRoot}/logs/monitoring/service-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
`;

        const plistPath = `~/Library/LaunchAgents/com.conejonegro.${this.serviceName}.plist`;
        
        console.log('🍎 macOS LaunchAgent Configuration:');
        console.log('');
        console.log('1. Save the following content to:', plistPath);
        console.log('');
        console.log(plistContent);
        console.log('');
        console.log('2. Run these commands:');
        console.log(`   launchctl load ${plistPath}`);
        console.log(`   launchctl start com.conejonegro.${this.serviceName}`);
        console.log('');
        console.log('3. Check status:');
        console.log(`   launchctl list | grep ${this.serviceName}`);
        console.log('');
        console.log('To uninstall:');
        console.log(`   launchctl unload ${plistPath}`);

        return plistPath;
    }

    async generateDockerCompose() {
        const dockerComposeContent = `version: '3.8'

services:
  railway-monitor:
    build: .
    container_name: ${this.serviceName}
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
      - ./config:/app/config
    working_dir: /app
    command: node scripts/monitoring/monitor-service.js start
    networks:
      - monitoring

  # Optional: Add a simple web server to serve the dashboard
  dashboard:
    image: nginx:alpine
    container_name: railway-monitor-dashboard
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./logs/monitoring/dashboard:/usr/share/nginx/html:ro
    depends_on:
      - railway-monitor
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge
`;

        const dockerfilContent = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs/monitoring

# Set permissions
RUN chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "scripts/monitoring/monitor-service.js", "start"]
`;

        console.log('🐳 Docker Configuration:');
        console.log('');
        console.log('docker-compose.yml:');
        console.log(dockerComposeContent);
        console.log('');
        console.log('Dockerfile:');
        console.log(dockerfilContent);
        console.log('');
        console.log('To run:');
        console.log('  docker-compose up -d');
        console.log('  docker-compose logs -f railway-monitor');

        const composePath = path.join(this.projectRoot, 'docker-compose.monitor.yml');
        await fs.writeFile(composePath, dockerComposeContent);
        
        const dockerfilePath = path.join(this.projectRoot, 'Dockerfile.monitor');
        await fs.writeFile(dockerfilePath, dockerfilContent);

        return { composePath, dockerfilePath };
    }

    async generatePackageJsonScripts() {
        const scripts = {
            "monitor:start": "node scripts/monitoring/monitor-service.js start",
            "monitor:stop": "node scripts/monitoring/monitor-service.js stop",
            "monitor:restart": "node scripts/monitoring/monitor-service.js restart",
            "monitor:status": "node scripts/monitoring/monitor-service.js status",
            "monitor:test": "node scripts/monitoring/monitor-service.js test",
            "monitor:dashboard": "node scripts/monitoring/health-dashboard.js generate",
            "monitor:alerts": "node scripts/monitoring/alert-system.js test"
        };

        console.log('📦 Add these scripts to your package.json:');
        console.log('');
        console.log(JSON.stringify({ scripts }, null, 2));

        return scripts;
    }

    async generateCronJob() {
        const cronContent = `# Railway Monitor Cron Jobs
# Add these lines to your crontab (crontab -e)

# Check service every 5 minutes and restart if not running
*/5 * * * * /usr/bin/node ${this.serviceScript} status > /dev/null || /usr/bin/node ${this.serviceScript} start

# Generate daily report at 6 AM
0 6 * * * /usr/bin/node ${path.join(__dirname, 'health-dashboard.js')} generate

# Clean old logs weekly (Sundays at 2 AM)
0 2 * * 0 find ${this.projectRoot}/logs/monitoring -name "*.log" -mtime +30 -delete

# Send test alert monthly (1st of month at 9 AM)
0 9 1 * * /usr/bin/node ${path.join(__dirname, 'alert-system.js')} test
`;

        console.log('⏰ Cron Job Configuration:');
        console.log('');
        console.log('Add these lines to your crontab (run: crontab -e):');
        console.log('');
        console.log(cronContent);

        return cronContent;
    }

    async install() {
        console.log(`🔧 Railway Monitor Service Installer`);
        console.log(`📍 Project: ${this.projectRoot}`);
        console.log(`🎯 Service: ${this.serviceDescription}`);
        console.log('');

        const platform = os.platform();
        
        switch (platform) {
            case 'linux':
                await this.generateSystemdService();
                break;
            case 'win32':
                await this.generateWindowsService();
                break;
            case 'darwin':
                await this.generateMacOSService();
                break;
            default:
                console.log(`❓ Platform ${platform} not specifically supported`);
                console.log('🐳 Consider using Docker instead:');
                await this.generateDockerCompose();
                break;
        }

        console.log('');
        console.log('📦 Package.json scripts:');
        await this.generatePackageJsonScripts();
        
        console.log('');
        console.log('⏰ Cron job alternative:');
        await this.generateCronJob();
        
        console.log('');
        console.log('🐳 Docker option:');
        await this.generateDockerCompose();
    }
}

// CLI interface
if (require.main === module) {
    const installer = new ServiceInstaller();
    installer.install().catch(console.error);
}

module.exports = ServiceInstaller;
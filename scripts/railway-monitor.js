#!/usr/bin/env node

/**
 * Railway Real-time Monitoring Script
 * Project ID: fed11c6d-a65a-4d93-90e6-955e16b6753f
 */

const https = require('https');
const { exec } = require('child_process');

class RailwayMonitor {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.baseUrl = `https://${this.projectId}.railway.app`;
        this.healthEndpoints = ['/api/health', '/api/status', '/api/version'];
        this.checkInterval = 30000; // 30 seconds
        this.isRunning = false;
    }
    
    async startMonitoring() {
        console.log('🔍 Starting Railway deployment monitoring...');
        console.log(`📊 Project: ${this.projectId}`);
        console.log(`🌐 Base URL: ${this.baseUrl}`);
        console.log(`⏱️  Check interval: ${this.checkInterval / 1000}s\n`);
        
        this.isRunning = true;
        
        while (this.isRunning) {
            await this.performHealthCheck();
            await this.sleep(this.checkInterval);
        }
    }
    
    async performHealthCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\n🏥 Health check at ${timestamp}`);
        console.log('=' .repeat(50));
        
        for (const endpoint of this.healthEndpoints) {
            try {
                const result = await this.checkEndpoint(endpoint);
                const status = result.ok ? '✅' : '❌';
                console.log(`${status} ${endpoint}: HTTP ${result.status} (${result.responseTime}ms)`);
                
                if (result.data) {
                    console.log(`   Data: ${result.data.substring(0, 100)}...`);
                }
            } catch (error) {
                console.log(`❌ ${endpoint}: ${error.message}`);
            }
        }
        
        // Check Railway CLI status if available
        try {
            const { stdout } = await this.execAsync('railway status --json');
            const status = JSON.parse(stdout);
            console.log(`🚂 Railway Status: ${status.status}`);
        } catch (error) {
            // Railway CLI not available or not logged in
        }
    }
    
    checkEndpoint(endpoint) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const url = `${this.baseUrl}${endpoint}`;
            
            const req = https.get(url, { timeout: 10000 }, (res) => {
                const responseTime = Date.now() - start;
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        responseTime,
                        data: data ? JSON.stringify(JSON.parse(data)) : null
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    execAsync(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
        });
    }
    
    stop() {
        console.log('\n🛑 Stopping monitoring...');
        this.isRunning = false;
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

if (require.main === module) {
    const monitor = new RailwayMonitor();
    monitor.startMonitoring().catch(console.error);
}

module.exports = { RailwayMonitor };

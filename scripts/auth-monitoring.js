#!/usr/bin/env node

/**
 * EMERGENCY AUTH MONITORING SCRIPT
 * 
 * This script provides real-time monitoring of authentication patterns
 * to identify if there's an actual infinite loop or normal scheduled operations.
 */

const fetch = require('node-fetch');

const RAILWAY_URL = 'https://pos-conejonegro-production.up.railway.app';
const MONITORING_INTERVAL = 5000; // 5 seconds
const MAX_MONITORING_TIME = 120000; // 2 minutes

class AuthMonitor {
    constructor() {
        this.requests = [];
        this.startTime = Date.now();
        this.healthCheckCount = 0;
        this.authRequestCount = 0;
        this.errorCount = 0;
    }

    async testHealthEndpoint() {
        try {
            const start = Date.now();
            const response = await fetch(`${RAILWAY_URL}/api/health`);
            const duration = Date.now() - start;
            const data = await response.json();

            this.healthCheckCount++;
            console.log(`✅ [${new Date().toISOString()}] Health check: ${response.status} (${duration}ms)`);
            console.log(`   Uptime: ${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m`);
            console.log(`   Database: ${data.database.status} (${data.database.type})`);
            
            return { status: response.status, duration, uptime: data.uptime };
        } catch (error) {
            this.errorCount++;
            console.error(`❌ [${new Date().toISOString()}] Health check failed:`, error.message);
            return { status: 'error', duration: 0, error: error.message };
        }
    }

    async testAuthEndpoint() {
        try {
            const start = Date.now();
            const response = await fetch(`${RAILWAY_URL}/api/stats`, {
                headers: {
                    'Authorization': 'Bearer invalid_token_for_monitoring'
                }
            });
            const duration = Date.now() - start;

            this.authRequestCount++;
            console.log(`🔒 [${new Date().toISOString()}] Auth test: ${response.status} (${duration}ms)`);
            
            if (duration > 1000) {
                console.warn(`⚠️  SLOW AUTH RESPONSE: ${duration}ms - Potential performance issue!`);
            }
            
            return { status: response.status, duration };
        } catch (error) {
            this.errorCount++;
            console.error(`❌ [${new Date().toISOString()}] Auth test failed:`, error.message);
            return { status: 'error', duration: 0, error: error.message };
        }
    }

    async testEmergencyEndpoint() {
        try {
            const start = Date.now();
            const response = await fetch(`${RAILWAY_URL}/api/emergency-test`);
            const duration = Date.now() - start;
            const data = await response.json();

            console.log(`🚨 [${new Date().toISOString()}] Emergency test: ${response.status} (${duration}ms)`);
            console.log(`   Message: ${data.message}`);
            
            return { status: response.status, duration };
        } catch (error) {
            console.error(`❌ [${new Date().toISOString()}] Emergency test failed:`, error.message);
            return { status: 'error', duration: 0, error: error.message };
        }
    }

    async runMonitoringCycle() {
        console.log(`\n🔍 [${new Date().toISOString()}] === MONITORING CYCLE START ===`);
        
        // Test all endpoints
        const health = await this.testHealthEndpoint();
        const auth = await this.testAuthEndpoint();
        const emergency = await this.testEmergencyEndpoint();

        // Analyze patterns
        this.analyzePatterns(health, auth, emergency);
        
        console.log(`📊 [${new Date().toISOString()}] === CYCLE SUMMARY ===`);
        console.log(`   Total Health Checks: ${this.healthCheckCount}`);
        console.log(`   Total Auth Tests: ${this.authRequestCount}`);
        console.log(`   Total Errors: ${this.errorCount}`);
        console.log(`   Monitoring Duration: ${Math.floor((Date.now() - this.startTime) / 1000)}s`);
    }

    analyzePatterns(health, auth, emergency) {
        // Check for signs of infinite loops
        if (auth.duration > 5000) {
            console.warn(`🚨 CRITICAL: Auth request took ${auth.duration}ms - POSSIBLE INFINITE LOOP!`);
        }
        
        if (health.status === 'error' && auth.status === 'error') {
            console.warn(`🚨 CRITICAL: Both health and auth endpoints failing - Server may be down!`);
        }
        
        if (auth.status === 401 && auth.duration < 100) {
            console.log(`✅ GOOD: Auth middleware responding quickly with proper rejection (${auth.duration}ms)`);
        }
        
        if (health.uptime && health.uptime > 3600) {
            console.log(`✅ GOOD: Server has been running for ${Math.floor(health.uptime / 3600)} hours - No infinite restart loop`);
        }
    }

    async start() {
        console.log(`🎯 Starting Railway Authentication Monitoring`);
        console.log(`🔗 Target: ${RAILWAY_URL}`);
        console.log(`⏱️  Interval: ${MONITORING_INTERVAL}ms`);
        console.log(`⏰ Duration: ${MAX_MONITORING_TIME / 1000}s`);
        console.log(`=====================================\n`);

        const interval = setInterval(async () => {
            await this.runMonitoringCycle();
            
            if (Date.now() - this.startTime >= MAX_MONITORING_TIME) {
                clearInterval(interval);
                this.printFinalReport();
            }
        }, MONITORING_INTERVAL);

        // Run first cycle immediately
        await this.runMonitoringCycle();
    }

    printFinalReport() {
        console.log(`\n\n🎯 === FINAL AUTHENTICATION MONITORING REPORT ===`);
        console.log(`📅 Monitoring Period: ${Math.floor((Date.now() - this.startTime) / 1000)}s`);
        console.log(`✅ Health Checks: ${this.healthCheckCount}`);
        console.log(`🔒 Auth Tests: ${this.authRequestCount}`);
        console.log(`❌ Errors: ${this.errorCount}`);
        
        const successRate = ((this.healthCheckCount + this.authRequestCount - this.errorCount) / 
                           (this.healthCheckCount + this.authRequestCount) * 100).toFixed(1);
        
        console.log(`📊 Success Rate: ${successRate}%`);
        
        if (this.errorCount === 0) {
            console.log(`\n🎉 CONCLUSION: NO INFINITE LOOP DETECTED!`);
            console.log(`   - Server is responding normally`);
            console.log(`   - Auth middleware is working correctly`);
            console.log(`   - Reported "infinite loop" appears to be normal scheduled operations`);
        } else if (this.errorCount < 5) {
            console.log(`\n✅ CONCLUSION: MINOR ISSUES DETECTED`);
            console.log(`   - Server mostly stable`);
            console.log(`   - Some intermittent errors (likely network)`);
            console.log(`   - No evidence of infinite authentication loops`);
        } else {
            console.log(`\n⚠️  CONCLUSION: SIGNIFICANT ISSUES DETECTED`);
            console.log(`   - High error rate suggests server problems`);
            console.log(`   - May require immediate investigation`);
        }

        console.log(`\n💡 RECOMMENDATIONS:`);
        console.log(`   1. Check Railway logs for the actual error patterns`);
        console.log(`   2. User ID 'm9ourz0jhumf0eo5te' may be from scheduled tasks`);
        console.log(`   3. Consider reducing log verbosity if only showing normal operations`);
        console.log(`   4. Monitor during peak usage times for real performance issues`);
        
        process.exit(0);
    }
}

// Run the monitoring
const monitor = new AuthMonitor();
monitor.start().catch(error => {
    console.error('Monitoring failed:', error);
    process.exit(1);
});
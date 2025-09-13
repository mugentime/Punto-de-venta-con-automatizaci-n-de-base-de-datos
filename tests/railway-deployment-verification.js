#!/usr/bin/env node

/**
 * Railway Deployment Verification Script
 * Tests critical health endpoints required for Railway autopilot monitoring
 * 
 * Usage: node tests/railway-deployment-verification.js [BASE_URL]
 * Example: node tests/railway-deployment-verification.js https://your-app.railway.app
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds

/**
 * Make HTTP/HTTPS request and return promise
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const client = isHttps ? https : http;
        
        const req = client.get(url, { timeout: TIMEOUT }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: jsonData
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        parseError: error.message
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Test health endpoints
 */
async function testHealthEndpoints() {
    console.log('🚂 Railway Deployment Verification');
    console.log('==================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log();
    
    const endpoints = [
        '/api/health',
        '/api/status'
    ];
    
    let allPassed = true;
    
    for (const endpoint of endpoints) {
        const url = `${BASE_URL}${endpoint}`;
        console.log(`Testing: ${endpoint}`);
        
        try {
            const result = await makeRequest(url);
            
            if (result.statusCode === 200) {
                console.log(`✅ ${endpoint} - Status: ${result.statusCode}`);
                
                // Validate response structure
                if (endpoint === '/api/health') {
                    const required = ['status', 'isDatabaseReady', 'environment', 'uptime'];
                    const missing = required.filter(field => !(field in result.body));
                    
                    if (missing.length > 0) {
                        console.log(`   ⚠️  Missing fields: ${missing.join(', ')}`);
                        allPassed = false;
                    } else {
                        console.log('   ✅ All required fields present');
                        console.log(`   📊 Database: ${result.body.isDatabaseReady ? 'Ready' : 'Not Ready'}`);
                        console.log(`   🌍 Environment: ${result.body.environment}`);
                        console.log(`   ⏱️  Uptime: ${Math.round(result.body.uptime)}s`);
                    }
                }
                
                if (endpoint === '/api/status') {
                    const required = ['status', 'timestamp', 'service', 'uptime'];
                    const missing = required.filter(field => !(field in result.body));
                    
                    if (missing.length > 0) {
                        console.log(`   ⚠️  Missing fields: ${missing.join(', ')}`);
                        allPassed = false;
                    } else {
                        console.log('   ✅ All required fields present');
                        console.log(`   🏥 Status: ${result.body.status}`);
                        console.log(`   🎯 Service: ${result.body.service}`);
                        console.log(`   💾 Memory: ${result.body.memory?.used}MB / ${result.body.memory?.total}MB`);
                    }
                }
                
            } else {
                console.log(`❌ ${endpoint} - Status: ${result.statusCode}`);
                console.log(`   Response: ${JSON.stringify(result.body, null, 2)}`);
                allPassed = false;
            }
            
        } catch (error) {
            console.log(`❌ ${endpoint} - Error: ${error.message}`);
            allPassed = false;
        }
        
        console.log();
    }
    
    // Summary
    console.log('Summary');
    console.log('=======');
    if (allPassed) {
        console.log('✅ All health checks passed!');
        console.log('🚂 Railway autopilot should detect the service as healthy');
        console.log();
        console.log('Railway Health Check Configuration:');
        console.log('- Health Check Path: /api/health');
        console.log('- Status Check Path: /api/status');
        console.log('- Both endpoints return 200 status codes');
        console.log('- JSON responses include required fields');
        process.exit(0);
    } else {
        console.log('❌ Some health checks failed!');
        console.log('🚨 Railway autopilot may not detect the service correctly');
        console.log('Please fix the issues above before deploying');
        process.exit(1);
    }
}

// Run the test
testHealthEndpoints().catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
});
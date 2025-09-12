/**
 * TaskMaster Automated Cash Cut System Validation
 * Tests the complete cash cut service functionality
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const TEST_RESULTS = [];

// Test utilities
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    const logMessage = `${emoji} [${timestamp}] ${message}`;
    console.log(logMessage);
    
    TEST_RESULTS.push({
        timestamp,
        type,
        message,
        emoji
    });
}

async function makeRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return { success: true, data, status: response.status };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Test Suite
async function runTests() {
    log('🚀 TaskMaster Cash Cut System Validation Started', 'info');
    
    // Test 1: Health Check
    log('Test 1: Server Health Check', 'info');
    const healthCheck = await makeRequest('/api/health');
    
    if (healthCheck.success) {
        log(`Server is healthy - Uptime: ${healthCheck.data.uptime}s`, 'success');
        log(`Database Status: ${healthCheck.data.database.status}`, 'success');
    } else {
        log(`Health check failed: ${healthCheck.error}`, 'error');
        return;
    }
    
    // Test 2: Cash Cut Service Status
    log('Test 2: Cash Cut Service Status', 'info');
    const serviceStatus = await makeRequest('/api/cashcuts/service/status');
    
    if (serviceStatus.success && serviceStatus.data.success) {
        const status = serviceStatus.data.serviceStatus;
        log(`Service initialized: ${status.initialized}`, 'success');
        log(`TaskMaster active: ${status.taskMasterActive}`, 'success');
        log(`Schedule: ${status.schedule}`, 'success');
        log(`Timezone: ${status.timezone}`, 'success');
        log(`Version: ${status.version}`, 'success');
        log(`Last cut time: ${status.lastCutTime}`, 'info');
        
        if (!status.initialized || !status.taskMasterActive) {
            log('Cash cut service is not properly initialized!', 'error');
        }
    } else {
        log(`Cash cut service status failed: ${serviceStatus.error || 'Unknown error'}`, 'error');
    }
    
    // Test 3: Recent Cash Cuts
    log('Test 3: Recent Cash Cuts Verification', 'info');
    const recentCuts = await makeRequest('/api/cashcuts/recent');
    
    if (recentCuts.success) {
        if (recentCuts.data.cuts && recentCuts.data.cuts.length > 0) {
            log(`Found ${recentCuts.data.cuts.length} recent cash cuts`, 'success');
            const lastCut = recentCuts.data.cuts[0];
            log(`Last cut: ${lastCut.timestamp} - Total: $${lastCut.total}`, 'info');
        } else {
            log('No recent cash cuts found (this might be normal for new installations)', 'warning');
        }
    } else {
        log(`Recent cuts check failed: ${recentCuts.error}`, 'warning');
    }
    
    // Test 4: Cash Cut Statistics
    log('Test 4: Cash Cut Statistics', 'info');
    const stats = await makeRequest('/api/cashcuts/stats');
    
    if (stats.success) {
        log(`Statistics retrieved successfully`, 'success');
        if (stats.data.totalCuts !== undefined) {
            log(`Total cuts: ${stats.data.totalCuts}`, 'info');
        }
    } else {
        log(`Statistics check failed: ${stats.error}`, 'warning');
    }
    
    // Test 5: Manual Cash Cut Trigger (Testing)
    log('Test 5: Manual Cash Cut Trigger Test', 'info');
    const manualCut = await makeRequest('/api/cashcuts/manual', {
        method: 'POST',
        body: JSON.stringify({
            reason: 'TaskMaster validation test',
            testMode: true
        })
    });
    
    if (manualCut.success) {
        log('Manual cash cut test completed successfully', 'success');
        if (manualCut.data.cut) {
            log(`Test cut total: $${manualCut.data.cut.total}`, 'info');
        }
    } else {
        log(`Manual cash cut test failed: ${manualCut.error}`, 'warning');
    }
    
    // Generate Report
    await generateReport();
    
    log('🎯 TaskMaster Cash Cut System Validation Complete', 'success');
}

async function generateReport() {
    const report = {
        timestamp: new Date().toISOString(),
        testResults: TEST_RESULTS,
        summary: {
            total: TEST_RESULTS.length,
            success: TEST_RESULTS.filter(r => r.type === 'success').length,
            errors: TEST_RESULTS.filter(r => r.type === 'error').length,
            warnings: TEST_RESULTS.filter(r => r.type === 'warning').length
        }
    };
    
    try {
        const reportPath = path.join(__dirname, 'cash-cut-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log(`Test report saved to: ${reportPath}`, 'success');
    } catch (error) {
        log(`Failed to save test report: ${error.message}`, 'error');
    }
}

// Run tests
if (require.main === module) {
    runTests().catch(error => {
        log(`Test execution failed: ${error.message}`, 'error');
        process.exit(1);
    });
}

module.exports = { runTests, makeRequest, log };

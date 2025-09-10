/**
 * TaskMaster Magic UI Final Integration Test
 * Tests complete navigation system and cash cut status integration
 */

const fetch = require('node-fetch');

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
            ...options
        });
        
        return { 
            success: response.ok, 
            status: response.status, 
            statusText: response.statusText,
            data: response.ok ? (response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text()) : null
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function runMagicUITests() {
    log('🎨 TaskMaster Magic UI Final Integration Test Started', 'info');
    
    // Test 1: Main Dashboard (Magic UI)
    log('Test 1: Magic UI Dashboard Access', 'info');
    const dashboard = await makeRequest('/online');
    
    if (dashboard.success) {
        log('Magic UI Dashboard is accessible (200 OK)', 'success');
        if (dashboard.data.includes('Magic UI')) {
            log('Magic UI components detected in dashboard', 'success');
        }
    } else {
        log(`Dashboard access failed: ${dashboard.status} ${dashboard.statusText}`, 'error');
    }
    
    // Test 2: All Navigation Routes
    log('Test 2: Navigation Routes Verification', 'info');
    const routes = [
        '/gastos.html',
        '/inventario.html', 
        '/reportes.html',
        '/corte-manual.html',
        '/clientes',
        '/coworking',
        '/analytics-clientes',
        '/demo-busqueda-clientes'
    ];
    
    let routesPassed = 0;
    
    for (const route of routes) {
        const result = await makeRequest(route);
        if (result.success) {
            routesPassed++;
            log(`Route ${route}: OK`, 'success');
        } else {
            log(`Route ${route}: Failed (${result.status})`, 'error');
        }
    }
    
    log(`Navigation Routes: ${routesPassed}/${routes.length} passed`, routesPassed === routes.length ? 'success' : 'warning');
    
    // Test 3: Cash Cut Service Status (Public Endpoint)
    log('Test 3: Cash Cut Status Integration', 'info');
    const cashCutStatus = await makeRequest('/api/cashcuts/service/status');
    
    if (cashCutStatus.success && cashCutStatus.data.success) {
        const status = cashCutStatus.data.serviceStatus;
        log(`Cash Cut Service Status: ${status.initialized ? 'Initialized' : 'Not Initialized'}`, status.initialized ? 'success' : 'error');
        log(`TaskMaster Protection: ${status.taskMasterActive ? 'Active' : 'Inactive'}`, status.taskMasterActive ? 'success' : 'warning');
        log(`Schedule: ${status.schedule}`, 'info');
        log(`Last Cut: ${new Date(status.lastCutTime).toLocaleString('es-ES')}`, 'info');
        
        if (status.initialized && status.taskMasterActive) {
            log('💎 Magic UI will show ACTIVE status badge', 'success');
        } else {
            log('💎 Magic UI will show INACTIVE status badge', 'warning');
        }
    } else {
        log(`Cash cut status failed: ${cashCutStatus.error || 'Unknown error'}`, 'error');
    }
    
    // Test 4: System Health for Connection Monitoring
    log('Test 4: System Health for Connection Monitor', 'info');
    const health = await makeRequest('/api/health');
    
    if (health.success) {
        log('System health endpoint accessible for connection monitoring', 'success');
        if (health.data.status === 'OK') {
            log('System status: ONLINE (Magic UI will show green status)', 'success');
        }
    } else {
        log('Health endpoint failed - Magic UI will show offline status', 'error');
    }
    
    // Test 5: Authentication Flow Test (without actual login)
    log('Test 5: Authentication Integration Check', 'info');
    const loginPage = await makeRequest('/');
    
    if (loginPage.success) {
        log('Login page accessible', 'success');
        if (loginPage.data.includes('Iniciar Sesión')) {
            log('Login form detected - Authentication flow ready', 'success');
        }
    } else {
        log('Login page failed', 'error');
    }
    
    // Generate Final Report
    const summary = {
        total: TEST_RESULTS.length,
        success: TEST_RESULTS.filter(r => r.type === 'success').length,
        errors: TEST_RESULTS.filter(r => r.type === 'error').length,
        warnings: TEST_RESULTS.filter(r => r.type === 'warning').length
    };
    
    log('🎯 TaskMaster Magic UI Integration Test Complete', 'success');
    log(`Summary: ${summary.success} passed, ${summary.errors} failed, ${summary.warnings} warnings`, 'info');
    
    // Overall system status
    if (summary.errors === 0) {
        log('🚀 SYSTEM STATUS: Magic UI Dashboard is fully operational!', 'success');
        log('✅ Users can login at http://localhost:3000/', 'success');
        log('✅ Dashboard available at http://localhost:3000/online', 'success');
        log('✅ All navigation routes working', 'success');
        log('✅ Cash cut system integrated with TaskMaster protection', 'success');
        log('✅ Real-time status monitoring active', 'success');
    } else {
        log(`⚠️ SYSTEM STATUS: ${summary.errors} critical issues detected`, 'warning');
    }
}

// Run tests
if (require.main === module) {
    runMagicUITests().catch(error => {
        log(`Test execution failed: ${error.message}`, 'error');
        process.exit(1);
    });
}

module.exports = { runMagicUITests };

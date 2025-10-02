/**
 * Test Runner - Execute coworking integration tests with proper setup
 */

// Import fetch for Node.js if needed
let fetch;
if (typeof globalThis.fetch === 'undefined') {
    try {
        fetch = require('node-fetch');
        globalThis.fetch = fetch;
    } catch (e) {
        console.log('node-fetch not available, trying built-in fetch...');
        try {
            const { fetch: nodeFetch } = require('node:fetch');
            fetch = nodeFetch;
            globalThis.fetch = nodeFetch;
        } catch (e2) {
            console.log('No fetch available, will use basic HTTP requests');
        }
    }
}

// Alternative HTTP request function if fetch is not available
async function makeRequest(endpoint, options = {}) {
    if (globalThis.fetch) {
        const response = await globalThis.fetch(`http://localhost:3001${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        return await response.json();
    } else {
        // Fallback to http module
        const http = require('http');
        const url = require('url');

        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(`http://localhost:3001${endpoint}`);
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = http.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                });
            });

            req.on('error', reject);

            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }
}

// Simple test runner
class SimpleTestRunner {
    constructor() {
        this.results = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
        this.results.push({ timestamp, type, message });
    }

    async testServerConnection() {
        this.log('🔍 Testing server connection...');
        try {
            const data = await makeRequest('/api/products');
            this.log(`✅ Server connected - Found ${data.length} products`);
            return true;
        } catch (error) {
            this.log(`❌ Server connection failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testCoworkingAPIs() {
        this.log('🔍 Testing Coworking APIs...');
        try {
            // Get coworking sessions
            const sessions = await makeRequest('/api/coworking-sessions');
            this.log(`✅ GET coworking sessions: ${sessions.length} found`);

            // Get orders
            const orders = await makeRequest('/api/orders');
            this.log(`✅ GET orders: ${orders.length} found`);

            // Check for coworking orders
            const coworkingOrders = orders.filter(order =>
                order.items.some(item =>
                    item.name.toLowerCase().includes('coworking') ||
                    item.name.toLowerCase().includes('servicio')
                )
            );

            this.log(`📊 Coworking orders found: ${coworkingOrders.length}`);

            if (coworkingOrders.length > 0) {
                coworkingOrders.forEach((order, i) => {
                    this.log(`   Order ${i+1}: ${order.clientName} - $${order.total}`);
                });
            }

            // Check finished sessions
            const finishedSessions = sessions.filter(s => s.status === 'finished');
            this.log(`📊 Finished coworking sessions: ${finishedSessions.length}`);

            // CRITICAL: Check if finished sessions have corresponding orders
            if (finishedSessions.length > 0 && coworkingOrders.length === 0) {
                this.log('❌ CRITICAL ISSUE: Finished coworking sessions exist but no coworking orders found!', 'error');
                this.log('   This means coworking revenue is not being tracked in profit calculations!', 'error');
            } else if (finishedSessions.length === coworkingOrders.length) {
                this.log('✅ Coworking integration appears to be working correctly');
            }

            return true;
        } catch (error) {
            this.log(`❌ Coworking API test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testProfitCalculations() {
        this.log('🔍 Testing profit calculations...');
        try {
            const orders = await makeRequest('/api/orders');
            const expenses = await makeRequest('/api/expenses');

            // Calculate profits manually
            const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
            const totalCosts = orders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
            const grossProfit = totalRevenue - totalCosts;
            const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const netProfit = grossProfit - totalExpenses;

            this.log(`📊 Profit Analysis:`);
            this.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
            this.log(`   Total Costs: $${totalCosts.toFixed(2)}`);
            this.log(`   Gross Profit: $${grossProfit.toFixed(2)}`);
            this.log(`   Total Expenses: $${totalExpenses.toFixed(2)}`);
            this.log(`   Net Profit: $${netProfit.toFixed(2)}`);

            // Check for coworking revenue specifically
            const coworkingRevenue = orders
                .filter(order => order.items.some(item =>
                    item.name.toLowerCase().includes('coworking') ||
                    item.name.toLowerCase().includes('servicio')
                ))
                .reduce((sum, order) => sum + order.total, 0);

            this.log(`   Coworking Revenue: $${coworkingRevenue.toFixed(2)}`);

            if (coworkingRevenue === 0 && orders.length > 0) {
                this.log('⚠️  WARNING: No coworking revenue detected in profit calculations!', 'warning');
            }

            return true;
        } catch (error) {
            this.log(`❌ Profit calculation test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async createTestCoworkingSession() {
        this.log('🔍 Creating test coworking session...');
        try {
            // Create a test session
            const sessionData = {
                clientName: 'Test Client Integration',
                startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                hourlyRate: 50
            };

            const newSession = await makeRequest('/api/coworking-sessions', {
                method: 'POST',
                body: JSON.stringify(sessionData)
            });

            this.log(`✅ Created test session: ${newSession.id}`);

            // Add some extras
            const extrasData = {
                consumedExtras: [
                    {
                        id: 'test-latte',
                        name: 'Test Latte',
                        price: 55,
                        cost: 18,
                        quantity: 1,
                        category: 'Cafetería'
                    }
                ]
            };

            await makeRequest(`/api/coworking-sessions/${newSession.id}`, {
                method: 'PUT',
                body: JSON.stringify(extrasData)
            });

            this.log('✅ Added extras to session');

            // Finish the session
            const finishData = {
                endTime: new Date().toISOString(),
                duration: 120, // 2 hours
                total: 128, // 58 + 35 + 35 (2 hours)
                paymentMethod: 'Efectivo',
                status: 'finished'
            };

            await makeRequest(`/api/coworking-sessions/${newSession.id}`, {
                method: 'PUT',
                body: JSON.stringify(finishData)
            });

            this.log('✅ Finished test session');

            // Wait a moment and check if order was created
            await new Promise(resolve => setTimeout(resolve, 1000));

            const updatedOrders = await makeRequest('/api/orders');
            const testOrder = updatedOrders.find(order =>
                order.clientName === 'Test Client Integration'
            );

            if (testOrder) {
                this.log(`✅ Test session created order: ${testOrder.id} - $${testOrder.total}`);
                this.log('✅ COWORKING INTEGRATION IS WORKING!');
            } else {
                this.log('❌ CRITICAL: Test session did NOT create an order!', 'error');
                this.log('❌ This confirms the coworking integration issue!', 'error');
            }

            return newSession.id;
        } catch (error) {
            this.log(`❌ Test session creation failed: ${error.message}`, 'error');
            return null;
        }
    }

    async runAllTests() {
        this.log('🚀 Starting Coworking Integration Diagnostic Tests...');

        const tests = [
            { name: 'Server Connection', fn: () => this.testServerConnection() },
            { name: 'Coworking APIs', fn: () => this.testCoworkingAPIs() },
            { name: 'Profit Calculations', fn: () => this.testProfitCalculations() },
            { name: 'Test Session Creation', fn: () => this.createTestCoworkingSession() }
        ];

        let passed = 0;
        for (const test of tests) {
            try {
                const result = await test.fn();
                if (result !== false) {
                    passed++;
                    this.log(`✅ ${test.name}: PASSED`);
                } else {
                    this.log(`❌ ${test.name}: FAILED`, 'error');
                }
            } catch (error) {
                this.log(`❌ ${test.name}: ERROR - ${error.message}`, 'error');
            }

            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.log(`🎯 Test Summary: ${passed}/${tests.length} tests passed`);

        // Generate recommendations
        this.generateRecommendations();

        return { passed, total: tests.length, results: this.results };
    }

    generateRecommendations() {
        this.log('🔧 RECOMMENDATIONS:', 'info');

        const hasCoworkingIssues = this.results.some(r =>
            r.message.includes('CRITICAL ISSUE') ||
            r.message.includes('coworking integration issue')
        );

        if (hasCoworkingIssues) {
            this.log('1. CHECK AppContext.tsx finishCoworkingSession function (lines 437-508)', 'info');
            this.log('2. Verify that finishing a coworking session creates an order', 'info');
            this.log('3. Ensure the order appears in the /api/orders endpoint', 'info');
            this.log('4. Check that coworking orders have proper totalCost calculation', 'info');
        } else {
            this.log('✅ No critical issues detected - system appears to be working', 'info');
        }
    }
}

// Run the tests
(async () => {
    console.log('Starting Coworking Integration Tests...\n');

    const runner = new SimpleTestRunner();
    const results = await runner.runAllTests();

    console.log('\n📋 FINAL RESULTS:');
    console.log(`   Tests Passed: ${results.passed}/${results.total}`);
    console.log(`   Total Log Entries: ${results.results.length}`);

    if (results.passed < results.total) {
        console.log('\n❌ ISSUES DETECTED - Check the logs above for details');
        process.exit(1);
    } else {
        console.log('\n✅ ALL TESTS PASSED');
        process.exit(0);
    }
})().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
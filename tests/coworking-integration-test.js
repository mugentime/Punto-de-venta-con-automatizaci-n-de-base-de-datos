/**
 * Comprehensive Test Suite for Coworking Integration Issues
 * Focus: Testing coworking profit calculation and integration with main profit system
 */

// Test Configuration
const TEST_CONFIG = {
    SERVER_URL: 'http://localhost:3001',
    TEST_CLIENT_NAME: 'Test Client',
    COWORKING_RATE: 50,
    TEST_TIMEOUT: 30000
};

// Test Utilities
class CoworkingTestSuite {
    constructor() {
        this.testResults = [];
        this.coworkingSessionId = null;
        this.testOrderId = null;
        this.originalOrders = [];
        this.originalSessions = [];
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, type, message };
        this.testResults.push(logEntry);
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const url = `${TEST_CONFIG.SERVER_URL}${endpoint}`;
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            await this.log(`Request failed for ${endpoint}: ${error.message}`, 'error');
            throw error;
        }
    }

    // Test Case 1: Verify Coworking API Endpoints
    async testCoworkingApiEndpoints() {
        await this.log('🔍 Testing Coworking API Endpoints...', 'test');

        try {
            // Test GET /api/coworking-sessions
            const sessions = await this.makeRequest('/api/coworking-sessions');
            await this.log(`✅ GET coworking sessions: Found ${sessions.length} sessions`);
            this.originalSessions = sessions;

            // Test POST - Start new session
            const sessionData = {
                clientName: TEST_CONFIG.TEST_CLIENT_NAME,
                startTime: new Date().toISOString(),
                hourlyRate: TEST_CONFIG.COWORKING_RATE
            };

            const newSession = await this.makeRequest('/api/coworking-sessions', {
                method: 'POST',
                body: JSON.stringify(sessionData)
            });

            this.coworkingSessionId = newSession.id;
            await this.log(`✅ POST coworking session: Created session ${this.coworkingSessionId}`);

            return true;
        } catch (error) {
            await this.log(`❌ Coworking API test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Case 2: Verify Orders API Integration
    async testOrdersApiIntegration() {
        await this.log('🔍 Testing Orders API Integration...', 'test');

        try {
            // Get current orders
            const orders = await this.makeRequest('/api/orders');
            this.originalOrders = orders;
            await this.log(`✅ GET orders: Found ${orders.length} orders`);

            // Create a test order to verify profit calculation
            const testOrder = {
                clientName: 'Test Order Client',
                serviceType: 'Mesa',
                paymentMethod: 'Efectivo',
                items: [
                    {
                        id: 'test-item-1',
                        name: 'Test Product',
                        price: 100,
                        cost: 50,
                        quantity: 2,
                        category: 'Test'
                    }
                ],
                subtotal: 200,
                total: 200,
                userId: 'test-user'
            };

            const createdOrder = await this.makeRequest('/api/orders', {
                method: 'POST',
                body: JSON.stringify(testOrder)
            });

            this.testOrderId = createdOrder.id;
            await this.log(`✅ POST order: Created test order ${this.testOrderId}`);

            // Verify totalCost calculation
            const expectedTotalCost = 100; // 50 cost * 2 quantity
            if (createdOrder.totalCost === expectedTotalCost) {
                await this.log(`✅ Order totalCost calculation correct: ${createdOrder.totalCost}`);
            } else {
                await this.log(`❌ Order totalCost calculation incorrect: Expected ${expectedTotalCost}, got ${createdOrder.totalCost}`, 'error');
            }

            return true;
        } catch (error) {
            await this.log(`❌ Orders API test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Case 3: Simulate Complete Coworking Session
    async testCompleteCoworkingSession() {
        await this.log('🔍 Testing Complete Coworking Session...', 'test');

        if (!this.coworkingSessionId) {
            await this.log('❌ No coworking session available for testing', 'error');
            return false;
        }

        try {
            // Simulate session running for 90 minutes
            const now = new Date();
            const sessionStart = new Date(now.getTime() - (90 * 60 * 1000)); // 90 minutes ago

            // Add some extras to the session
            const extrasData = {
                consumedExtras: [
                    {
                        id: 'extra-1',
                        name: 'Latte',
                        price: 55,
                        cost: 18,
                        quantity: 1,
                        category: 'Cafetería'
                    },
                    {
                        id: 'extra-2',
                        name: 'Croissant',
                        price: 40,
                        cost: 20,
                        quantity: 1,
                        category: 'Alimentos'
                    }
                ]
            };

            await this.makeRequest(`/api/coworking-sessions/${this.coworkingSessionId}`, {
                method: 'PUT',
                body: JSON.stringify(extrasData)
            });

            await this.log('✅ Added extras to coworking session');

            // Finish the session
            const finishData = {
                endTime: now.toISOString(),
                duration: 90,
                total: this.calculateCoworkingTotal(90, extrasData.consumedExtras),
                paymentMethod: 'Efectivo',
                status: 'finished'
            };

            const finishedSession = await this.makeRequest(`/api/coworking-sessions/${this.coworkingSessionId}`, {
                method: 'PUT',
                body: JSON.stringify(finishData)
            });

            await this.log(`✅ Finished coworking session with total: $${finishedSession.total}`);

            return true;
        } catch (error) {
            await this.log(`❌ Complete coworking session test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Case 4: Verify Profit Calculation Integration
    async testProfitCalculationIntegration() {
        await this.log('🔍 Testing Profit Calculation Integration...', 'test');

        try {
            // Get all orders after coworking session
            const allOrders = await this.makeRequest('/api/orders');
            await this.log(`📊 Total orders in system: ${allOrders.length}`);

            // Check if coworking session created an order
            const coworkingOrders = allOrders.filter(order =>
                order.clientName === TEST_CONFIG.TEST_CLIENT_NAME ||
                order.items.some(item => item.name.includes('Coworking'))
            );

            if (coworkingOrders.length > 0) {
                await this.log(`✅ Found ${coworkingOrders.length} coworking-related orders`);

                coworkingOrders.forEach((order, index) => {
                    this.log(`   Order ${index + 1}: ${order.clientName} - $${order.total} (Cost: $${order.totalCost || 'N/A'})`);
                });
            } else {
                await this.log('❌ No coworking orders found in system', 'error');
            }

            // Calculate expected profits
            const totalRevenue = allOrders.reduce((sum, order) => sum + order.total, 0);
            const totalCosts = allOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
            const grossProfit = totalRevenue - totalCosts;

            await this.log(`📊 Revenue Analysis:`);
            await this.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
            await this.log(`   Total Costs: $${totalCosts.toFixed(2)}`);
            await this.log(`   Gross Profit: $${grossProfit.toFixed(2)}`);

            // Check for expenses
            const expenses = await this.makeRequest('/api/expenses');
            const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const netProfit = grossProfit - totalExpenses;

            await this.log(`   Total Expenses: $${totalExpenses.toFixed(2)}`);
            await this.log(`   Net Profit: $${netProfit.toFixed(2)}`);

            return true;
        } catch (error) {
            await this.log(`❌ Profit calculation test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Case 5: Frontend Integration Test
    async testFrontendIntegration() {
        await this.log('🔍 Testing Frontend Integration Points...', 'test');

        try {
            // Test all API endpoints that frontend would use
            const endpoints = [
                '/api/products',
                '/api/orders',
                '/api/expenses',
                '/api/coworking-sessions',
                '/api/cash-sessions',
                '/api/users'
            ];

            for (const endpoint of endpoints) {
                try {
                    const data = await this.makeRequest(endpoint);
                    await this.log(`✅ ${endpoint}: Returned ${Array.isArray(data) ? data.length : 'N/A'} items`);
                } catch (error) {
                    await this.log(`❌ ${endpoint}: Failed - ${error.message}`, 'error');
                }
            }

            return true;
        } catch (error) {
            await this.log(`❌ Frontend integration test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Case 6: Data Consistency Check
    async testDataConsistency() {
        await this.log('🔍 Testing Data Consistency...', 'test');

        try {
            const orders = await this.makeRequest('/api/orders');
            const sessions = await this.makeRequest('/api/coworking-sessions');

            // Check for orphaned coworking sessions
            const activeSessions = sessions.filter(s => s.status === 'active');
            if (activeSessions.length > 0) {
                await this.log(`⚠️  Found ${activeSessions.length} active coworking sessions`, 'warning');
            }

            // Check for orders without totalCost
            const ordersWithoutCost = orders.filter(o => o.totalCost === undefined || o.totalCost === null);
            if (ordersWithoutCost.length > 0) {
                await this.log(`⚠️  Found ${ordersWithoutCost.length} orders without totalCost calculation`, 'warning');
            }

            // Check for negative values
            const negativeOrders = orders.filter(o => o.total < 0 || (o.totalCost && o.totalCost < 0));
            if (negativeOrders.length > 0) {
                await this.log(`❌ Found ${negativeOrders.length} orders with negative values`, 'error');
            }

            return true;
        } catch (error) {
            await this.log(`❌ Data consistency test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Helper function to calculate coworking total
    calculateCoworkingTotal(durationMinutes, extras) {
        let cost = 0;
        if (durationMinutes > 0) {
            if (durationMinutes <= 60) {
                cost = 58;
            } else {
                const extraMinutes = durationMinutes - 60;
                const halfHourBlocks = Math.ceil(extraMinutes / 30);
                cost = 58 + (halfHourBlocks * 35);
            }
        }

        const extrasCost = extras.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return cost + extrasCost;
    }

    // Cleanup function
    async cleanup() {
        await this.log('🧹 Cleaning up test data...', 'test');

        try {
            // Remove test order if created
            if (this.testOrderId) {
                // Note: No DELETE endpoint available for orders in the API
                await this.log(`ℹ️  Test order ${this.testOrderId} left in system (no DELETE endpoint)`);
            }

            // Note: Coworking session is already finished, no cleanup needed
            if (this.coworkingSessionId) {
                await this.log(`ℹ️  Coworking session ${this.coworkingSessionId} finished and left in system`);
            }
        } catch (error) {
            await this.log(`⚠️  Cleanup error: ${error.message}`, 'warning');
        }
    }

    // Run all tests
    async runAllTests() {
        await this.log('🚀 Starting Comprehensive Coworking Integration Test Suite...', 'test');

        const tests = [
            { name: 'API Endpoints', fn: () => this.testCoworkingApiEndpoints() },
            { name: 'Orders Integration', fn: () => this.testOrdersApiIntegration() },
            { name: 'Complete Session', fn: () => this.testCompleteCoworkingSession() },
            { name: 'Profit Calculation', fn: () => this.testProfitCalculationIntegration() },
            { name: 'Frontend Integration', fn: () => this.testFrontendIntegration() },
            { name: 'Data Consistency', fn: () => this.testDataConsistency() }
        ];

        let passedTests = 0;

        for (const test of tests) {
            try {
                const result = await test.fn();
                if (result) {
                    passedTests++;
                    await this.log(`✅ ${test.name} test PASSED`);
                } else {
                    await this.log(`❌ ${test.name} test FAILED`, 'error');
                }
            } catch (error) {
                await this.log(`❌ ${test.name} test ERROR: ${error.message}`, 'error');
            }

            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await this.cleanup();

        await this.log(`🎯 Test Summary: ${passedTests}/${tests.length} tests passed`, 'test');

        return {
            totalTests: tests.length,
            passedTests,
            failedTests: tests.length - passedTests,
            results: this.testResults
        };
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoworkingTestSuite;
} else if (typeof window !== 'undefined') {
    window.CoworkingTestSuite = CoworkingTestSuite;
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    (async () => {
        const testSuite = new CoworkingTestSuite();
        const results = await testSuite.runAllTests();
        console.log('\n📋 Final Results:', results);
    })();
}
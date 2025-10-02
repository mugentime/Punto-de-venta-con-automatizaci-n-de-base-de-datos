/**
 * Profit Calculation Validator
 * Specifically tests the integration between coworking sessions and profit reporting
 */

class ProfitCalculationValidator {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.validationResults = {};
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);

        if (type === 'error') {
            this.issues.push({ timestamp, message, type });
        } else if (type === 'warning') {
            this.warnings.push({ timestamp, message, type });
        }
    }

    async makeRequest(endpoint) {
        try {
            const response = await fetch(`http://localhost:3001${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.log(`Request failed for ${endpoint}: ${error.message}`, 'error');
            throw error;
        }
    }

    // Validate coworking session profit integration
    async validateCoworkingProfitIntegration() {
        this.log('🔍 Validating Coworking Profit Integration...');

        try {
            // Get all orders and coworking sessions
            const orders = await this.makeRequest('/api/orders');
            const coworkingSessions = await this.makeRequest('/api/coworking-sessions');

            this.log(`📊 Found ${orders.length} orders and ${coworkingSessions.length} coworking sessions`);

            // Check if finished coworking sessions have corresponding orders
            const finishedSessions = coworkingSessions.filter(s => s.status === 'finished');
            this.log(`📊 Found ${finishedSessions.length} finished coworking sessions`);

            const coworkingOrders = orders.filter(order => {
                return order.items.some(item =>
                    item.name.toLowerCase().includes('coworking') ||
                    item.name.toLowerCase().includes('servicio')
                );
            });

            this.log(`📊 Found ${coworkingOrders.length} orders that appear to be coworking-related`);

            // CRITICAL CHECK: Are coworking sessions creating orders?
            if (finishedSessions.length > 0 && coworkingOrders.length === 0) {
                this.log('❌ CRITICAL ISSUE: Finished coworking sessions exist but no coworking orders found!', 'error');
                this.issues.push({
                    type: 'MISSING_COWORKING_ORDERS',
                    message: 'Coworking sessions are not creating orders in the system',
                    impact: 'Revenue from coworking is not being tracked in profit calculations',
                    finishedSessions: finishedSessions.length,
                    coworkingOrders: coworkingOrders.length
                });
            }

            // Check order structure for coworking orders
            coworkingOrders.forEach((order, index) => {
                this.log(`📋 Coworking Order ${index + 1}:`);
                this.log(`   Client: ${order.clientName}`);
                this.log(`   Total: $${order.total}`);
                this.log(`   Items: ${order.items.length}`);
                this.log(`   Total Cost: $${order.totalCost || 'MISSING'}`);

                if (!order.totalCost && order.totalCost !== 0) {
                    this.log(`⚠️  Order ${order.id} missing totalCost calculation`, 'warning');
                }

                order.items.forEach((item, itemIndex) => {
                    this.log(`     Item ${itemIndex + 1}: ${item.name} - $${item.price} x${item.quantity}`);
                    if (item.cost === undefined || item.cost === null) {
                        this.log(`     ⚠️  Item ${item.name} missing cost data`, 'warning');
                    }
                });
            });

            this.validationResults.coworkingIntegration = {
                finishedSessions: finishedSessions.length,
                coworkingOrders: coworkingOrders.length,
                integrationWorking: coworkingOrders.length > 0 || finishedSessions.length === 0
            };

            return true;
        } catch (error) {
            this.log(`❌ Coworking profit integration validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Validate profit calculation logic
    async validateProfitCalculations() {
        this.log('🔍 Validating Profit Calculations...');

        try {
            const orders = await this.makeRequest('/api/orders');
            const expenses = await this.makeRequest('/api/expenses');

            // Manual profit calculation
            let totalRevenue = 0;
            let totalCosts = 0;
            let ordersWithMissingCosts = 0;

            orders.forEach(order => {
                totalRevenue += order.total;

                if (order.totalCost !== undefined && order.totalCost !== null) {
                    totalCosts += order.totalCost;
                } else {
                    ordersWithMissingCosts++;
                    // Calculate cost manually from items
                    const manualCost = order.items.reduce((sum, item) => {
                        if (item.cost !== undefined && item.cost !== null) {
                            return sum + (item.cost * item.quantity);
                        }
                        return sum;
                    }, 0);
                    totalCosts += manualCost;

                    if (manualCost === 0 && order.items.length > 0) {
                        this.log(`⚠️  Order ${order.id} has items but zero calculated cost`, 'warning');
                    }
                }
            });

            const grossProfit = totalRevenue - totalCosts;
            const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const netProfit = grossProfit - totalExpenses;

            this.log(`📊 Profit Analysis:`);
            this.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
            this.log(`   Total Costs: $${totalCosts.toFixed(2)}`);
            this.log(`   Gross Profit: $${grossProfit.toFixed(2)}`);
            this.log(`   Total Expenses: $${totalExpenses.toFixed(2)}`);
            this.log(`   Net Profit: $${netProfit.toFixed(2)}`);

            if (ordersWithMissingCosts > 0) {
                this.log(`⚠️  ${ordersWithMissingCosts} orders missing totalCost field`, 'warning');
            }

            // Check for data quality issues
            const negativeRevenue = orders.filter(o => o.total < 0);
            const negativeCosts = orders.filter(o => o.totalCost < 0);

            if (negativeRevenue.length > 0) {
                this.log(`❌ Found ${negativeRevenue.length} orders with negative revenue`, 'error');
            }

            if (negativeCosts.length > 0) {
                this.log(`❌ Found ${negativeCosts.length} orders with negative costs`, 'error');
            }

            this.validationResults.profitCalculations = {
                totalRevenue,
                totalCosts,
                grossProfit,
                totalExpenses,
                netProfit,
                ordersWithMissingCosts,
                dataQualityIssues: negativeRevenue.length + negativeCosts.length
            };

            return true;
        } catch (error) {
            this.log(`❌ Profit calculation validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test coworking billing logic specifically
    async testCoworkingBillingLogic() {
        this.log('🔍 Testing Coworking Billing Logic...');

        // Test different duration scenarios
        const testCases = [
            { minutes: 30, expected: 58, description: 'First hour (30 min)' },
            { minutes: 60, expected: 58, description: 'Exactly one hour' },
            { minutes: 90, expected: 93, description: 'One hour + 30 min' }, // 58 + 35
            { minutes: 120, expected: 128, description: 'Two hours' }, // 58 + 35 + 35
            { minutes: 150, expected: 163, description: 'Two and half hours' }, // 58 + 35 + 35 + 35
            { minutes: 300, expected: 270, description: 'Five hours (should be day rate)' },
            { minutes: 360, expected: 270, description: 'Six hours (should be day rate)' }
        ];

        testCases.forEach(testCase => {
            const result = this.calculateCoworkingCost(testCase.minutes);

            if (result.cost === testCase.expected) {
                this.log(`✅ ${testCase.description}: $${result.cost} ✓`);
            } else {
                this.log(`❌ ${testCase.description}: Expected $${testCase.expected}, got $${result.cost}`, 'error');
            }
        });

        return true;
    }

    // Helper function matching the actual coworking calculation
    calculateCoworkingCost(durationMinutes) {
        const durationHours = durationMinutes / 60;

        let cost = 0;
        if (durationMinutes > 0) {
            if (durationHours > 5) {
                // More than 5 hours = full day
                cost = 270;
            } else if (durationMinutes <= 60) {
                // First hour
                cost = 58;
            } else if (durationMinutes <= 90) {
                // 1 hour + 30 minutes
                cost = 58 + 30;
            } else {
                // 2 or more full hours
                const fullHours = Math.ceil(durationHours);
                cost = 58 * fullHours;
            }
        }

        return { cost, minutes: durationMinutes };
    }

    // Validate Reports Screen logic
    async validateReportsScreenLogic() {
        this.log('🔍 Validating Reports Screen Logic...');

        try {
            const orders = await this.makeRequest('/api/orders');
            const expenses = await this.makeRequest('/api/expenses');

            // Simulate the exact logic from ReportsScreen.tsx
            const totalRevenue = orders.reduce((acc, order) => acc + order.total, 0);
            const totalCOGS = orders.reduce((acc, order) => acc + (order.totalCost || 0), 0);
            const grossProfit = totalRevenue - totalCOGS;
            const totalExpensesAmount = expenses.reduce((acc, expense) => acc + expense.amount, 0);
            const netProfit = grossProfit - totalExpensesAmount;
            const averageTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

            this.log(`📊 Reports Screen Calculations:`);
            this.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
            this.log(`   Total COGS: $${totalCOGS.toFixed(2)}`);
            this.log(`   Gross Profit: $${grossProfit.toFixed(2)}`);
            this.log(`   Total Expenses: $${totalExpensesAmount.toFixed(2)}`);
            this.log(`   Net Profit: $${netProfit.toFixed(2)}`);
            this.log(`   Average Ticket: $${averageTicket.toFixed(2)}`);

            // Check if coworking revenue is included
            const coworkingRevenue = orders
                .filter(order => order.items.some(item =>
                    item.name.toLowerCase().includes('coworking') ||
                    item.name.toLowerCase().includes('servicio')
                ))
                .reduce((sum, order) => sum + order.total, 0);

            this.log(`   Coworking Revenue: $${coworkingRevenue.toFixed(2)}`);

            if (coworkingRevenue === 0 && orders.length > 0) {
                this.log('⚠️  No coworking revenue detected in profit calculations', 'warning');
            }

            this.validationResults.reportsScreen = {
                totalRevenue,
                totalCOGS,
                grossProfit,
                totalExpensesAmount,
                netProfit,
                averageTicket,
                coworkingRevenue,
                coworkingIncluded: coworkingRevenue > 0
            };

            return true;
        } catch (error) {
            this.log(`❌ Reports screen validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Generate comprehensive report
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalIssues: this.issues.length,
                totalWarnings: this.warnings.length,
                validationsPassed: Object.keys(this.validationResults).length
            },
            issues: this.issues,
            warnings: this.warnings,
            validationResults: this.validationResults,
            recommendations: []
        };

        // Generate recommendations based on findings
        if (this.validationResults.coworkingIntegration && !this.validationResults.coworkingIntegration.integrationWorking) {
            report.recommendations.push({
                priority: 'HIGH',
                issue: 'Coworking sessions not creating orders',
                recommendation: 'Check the finishCoworkingSession function in AppContext.tsx - it should create an order when a session is finished',
                codeLocation: 'AppContext.tsx:437-508'
            });
        }

        if (this.validationResults.profitCalculations && this.validationResults.profitCalculations.ordersWithMissingCosts > 0) {
            report.recommendations.push({
                priority: 'MEDIUM',
                issue: 'Orders missing totalCost calculation',
                recommendation: 'Ensure all orders have proper totalCost calculation for accurate profit reporting',
                codeLocation: 'server.js:384-385, AppContext.tsx:315-353'
            });
        }

        if (this.validationResults.reportsScreen && !this.validationResults.reportsScreen.coworkingIncluded) {
            report.recommendations.push({
                priority: 'HIGH',
                issue: 'Coworking revenue not appearing in profit calculations',
                recommendation: 'Verify that finished coworking sessions are properly creating orders that appear in the orders API',
                codeLocation: 'AppContext.tsx:437-508, ReportsScreen.tsx:50-82'
            });
        }

        return report;
    }

    // Run all validations
    async runAllValidations() {
        this.log('🚀 Starting Profit Calculation Validation Suite...');

        const validations = [
            { name: 'Coworking Integration', fn: () => this.validateCoworkingProfitIntegration() },
            { name: 'Profit Calculations', fn: () => this.validateProfitCalculations() },
            { name: 'Coworking Billing Logic', fn: () => this.testCoworkingBillingLogic() },
            { name: 'Reports Screen Logic', fn: () => this.validateReportsScreenLogic() }
        ];

        for (const validation of validations) {
            try {
                await validation.fn();
                this.log(`✅ ${validation.name} validation completed`);
            } catch (error) {
                this.log(`❌ ${validation.name} validation failed: ${error.message}`, 'error');
            }
        }

        const report = this.generateReport();
        this.log(`🎯 Validation Summary: ${report.summary.totalIssues} issues, ${report.summary.totalWarnings} warnings`);

        return report;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfitCalculationValidator;
} else if (typeof window !== 'undefined') {
    window.ProfitCalculationValidator = ProfitCalculationValidator;
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    (async () => {
        const validator = new ProfitCalculationValidator();
        const report = await validator.runAllValidations();
        console.log('\n📋 Validation Report:', JSON.stringify(report, null, 2));
    })();
}
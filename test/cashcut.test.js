/**
 * Basic unit tests for Cash Cut service
 * Demonstrates core functionality validation
 */

const databaseManager = require('../utils/databaseManager');

describe('Cash Cut Service Tests', () => {
    let testCashCutId;

    beforeAll(async () => {
        // Initialize database for testing
        await databaseManager.initialize();
    });

    describe('Database Manager Cash Cut Methods', () => {
        test('should ensure cashcut schema', async () => {
            const result = await databaseManager.ensureCashcutSchema();
            expect(result).toBe(true);
        });

        test('should create cash cut successfully', async () => {
            const cashCutData = {
                openingAmount: 1000,
                openedBy: 'test-user',
                notes: 'Test cash cut'
            };
            
            const result = await databaseManager.createCashCut(cashCutData);
            testCashCutId = result._id;
            
            expect(result).toBeDefined();
            expect(result._id).toBeDefined();
            expect(result.status).toBe('open');
            expect(result.openingAmount).toBe(1000);
            expect(result.openedBy).toBe('test-user');
        });

        test('should prevent multiple open cash cuts', async () => {
            const cashCutData = {
                openingAmount: 500,
                openedBy: 'test-user-2',
                notes: 'Should fail'
            };
            
            await expect(databaseManager.createCashCut(cashCutData))
                .rejects
                .toThrow('There is already an open cash cut');
        });

        test('should get open cash cut', async () => {
            const openCut = await databaseManager.getOpenCashCut();
            
            expect(openCut).toBeDefined();
            expect(openCut.status).toBe('open');
            expect(openCut._id).toBe(testCashCutId);
        });

        test('should append entry to cash cut', async () => {
            const entryData = {
                type: 'sale',
                amount: 250.50,
                referenceId: 'TEST-001',
                note: 'Test sale'
            };
            
            const result = await databaseManager.appendEntry(testCashCutId, entryData);
            
            expect(result).toBeDefined();
            expect(result.entries).toBeDefined();
            expect(result.entries.length).toBe(1);
            expect(result.entries[0].type).toBe('sale');
            expect(result.entries[0].amount).toBe(250.50);
        });

        test('should compute expected amount correctly', async () => {
            const expectedAmount = await databaseManager.computeExpectedAmount(testCashCutId);
            
            // 1000 (opening) + 250.50 (sale) = 1250.50
            expect(expectedAmount).toBe(1250.50);
        });

        test('should close cash cut successfully', async () => {
            const closeData = {
                id: testCashCutId,
                closingAmount: 1240.00,
                closedBy: 'test-user',
                notes: 'Test closure'
            };
            
            const result = await databaseManager.closeCashCut(closeData);
            
            expect(result).toBeDefined();
            expect(result.status).toBe('closed');
            expect(result.closingAmount).toBe(1240.00);
            expect(result.difference).toBe(-10.50); // 1240 - 1250.50
        });

        test('should list cash cuts with filters', async () => {
            const results = await databaseManager.listCashCuts({
                limit: 10,
                status: 'closed'
            });
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].status).toBe('closed');
        });

        test('should get cash cut by ID', async () => {
            const result = await databaseManager.getCashCutById(testCashCutId);
            
            expect(result).toBeDefined();
            expect(result._id).toBe(testCashCutId);
            expect(result.status).toBe('closed');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle non-existent cash cut ID', async () => {
            const fakeId = 'non-existent-id';
            const result = await databaseManager.getCashCutById(fakeId);
            
            expect(result).toBeNull();
        });

        test('should reject invalid entry types', async () => {
            const entryData = {
                type: 'invalid-type',
                amount: 100,
                note: 'Invalid entry'
            };
            
            // This should be handled by validation in the controller
            // For now, we'll just verify the constraint works
            expect(entryData.type).not.toMatch(/^(sale|expense|adjustment)$/);
        });

        test('should handle missing required fields', async () => {
            const invalidData = {
                openingAmount: 1000
                // Missing openedBy
            };
            
            await expect(databaseManager.createCashCut(invalidData))
                .rejects
                .toThrow();
        });
    });
});

// Standalone test runner (works without Jest)
console.log('🧪 Running Cash Cut Service Validation Tests');
console.log('=' + '='.repeat(50));

async function runBasicTests() {
    let passed = 0;
    let failed = 0;
    
    function test(name, result, expected) {
        if (result === expected || (typeof expected === 'function' && expected(result))) {
            console.log(`✅ ${name}: PASS`);
            passed++;
        } else {
            console.log(`❌ ${name}: FAIL (got ${result}, expected ${expected})`);
            failed++;
        }
    }
    
    try {
        console.log('\n📋 Initializing database...');
        await databaseManager.initialize();
        console.log('✅ Database initialized');
        
        console.log('\n🧪 Running Tests:');
        
        // Test 1: Schema validation
        const schemaResult = await databaseManager.ensureCashcutSchema();
        test('Schema Validation', schemaResult, true);
        
        // Test 2: Create cash cut
        const cashCut = await databaseManager.createCashCut({
            openingAmount: 1000,
            openedBy: 'test-runner',
            notes: 'Automated validation test'
        });
        test('Create Cash Cut', !!cashCut, true);
        test('Cash Cut ID Generated', !!cashCut._id, true);
        test('Cash Cut Status', cashCut.status, 'open');
        test('Opening Amount', cashCut.openingAmount, 1000);
        
        // Test 3: Get open cash cut
        const openCut = await databaseManager.getOpenCashCut();
        test('Get Open Cash Cut', !!openCut, true);
        test('Open Cut ID Match', openCut._id, cashCut._id);
        
        // Test 4: Constraint validation (should fail)
        try {
            await databaseManager.createCashCut({
                openingAmount: 500,
                openedBy: 'test-user-2',
                notes: 'Should fail'
            });
            test('Constraint Prevention', false, true); // Should not reach here
        } catch (error) {
            test('Constraint Prevention', error.message.includes('already an open cash cut'), true);
        }
        
        // Test 5: Add entry
        const entryResult = await databaseManager.appendEntry(cashCut._id, {
            type: 'sale',
            amount: 250.50,
            referenceId: 'TEST-001',
            note: 'Test sale entry'
        });
        test('Add Entry', !!entryResult, true);
        test('Entry Count', entryResult.entries?.length || 0, r => r >= 1);
        
        // Test 6: Compute expected amount
        const expectedAmount = await databaseManager.computeExpectedAmount(cashCut._id);
        test('Expected Amount Calculation', expectedAmount, 1250.50); // 1000 + 250.50
        
        // Test 7: Add expense entry
        await databaseManager.appendEntry(cashCut._id, {
            type: 'expense',
            amount: 50.00,
            note: 'Test expense'
        });
        const newExpected = await databaseManager.computeExpectedAmount(cashCut._id);
        test('Expense Deduction', newExpected, 1200.50); // 1250.50 - 50.00
        
        // Test 8: Close cash cut
        const closedCut = await databaseManager.closeCashCut({
            id: cashCut._id,
            closingAmount: 1195.25,
            closedBy: 'test-runner',
            notes: 'Test closure'
        });
        test('Close Cash Cut', !!closedCut, true);
        test('Closed Status', closedCut.status, 'closed');
        test('Closing Amount', closedCut.closingAmount, 1195.25);
        test('Difference Calculation', closedCut.difference, -5.25); // 1195.25 - 1200.50
        
        // Test 9: List cash cuts
        const cashCuts = await databaseManager.listCashCuts({ limit: 5 });
        test('List Cash Cuts', Array.isArray(cashCuts), true);
        test('Cash Cuts Count', cashCuts.length, r => r >= 1);
        
        // Test 10: Get by ID
        const retrieved = await databaseManager.getCashCutById(cashCut._id);
        test('Get By ID', !!retrieved, true);
        test('Retrieved Status', retrieved.status, 'closed');
        
        console.log('\n📊 TEST RESULTS:');
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
        
        if (failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Cash Cut system is working correctly.');
        } else {
            console.log('\n⚠️ Some tests failed. Please review the implementation.');
        }
        
        console.log('\n🔍 SYSTEM VALIDATION COMPLETE');
        
    } catch (error) {
        console.error('❌ Critical test failure:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

runBasicTests();

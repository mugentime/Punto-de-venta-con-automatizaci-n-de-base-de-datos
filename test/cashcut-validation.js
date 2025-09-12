const databaseManager = require('../utils/databaseManager');

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
        
        // Test 2: Handle existing open cash cut or create new one
        let cashCut = await databaseManager.getOpenCashCut();
        if (cashCut) {
            console.log('⚠️ Found existing open cash cut, closing it first...');
            await databaseManager.closeCashCut({
                id: cashCut._id,
                closingAmount: cashCut.expectedAmount || cashCut.openingAmount,
                closedBy: 'test-runner',
                notes: 'Auto-closed for testing'
            });
        }
        
        // Now create new cash cut for testing
        cashCut = await databaseManager.createCashCut({
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

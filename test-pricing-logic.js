// Test script to validate unified coworking pricing logic
// New pricing: $58/hour, $29/half-hour after first hour, $180/day after 4 hours

console.log('🧮 COWORKING PRICING LOGIC TEST\n');

// Simulate the new pricing algorithm
function calculateCoworkingCost(durationMinutes) {
    const durationHours = durationMinutes / 60;
    let cost = 0;

    if (durationMinutes > 0) {
        if (durationHours >= 4) {
            // 4+ hours = day rate
            cost = 180;
        } else if (durationMinutes <= 60) {
            // First hour: $58
            cost = 58;
        } else {
            // After first hour: $29 per half-hour block
            const extraMinutes = durationMinutes - 60;
            const halfHourBlocks = Math.ceil(extraMinutes / 30);
            cost = 58 + (halfHourBlocks * 29);
        }
    }
    return cost;
}

// Test cases
const testCases = [
    { minutes: 30, expected: 58, description: "30 minutes (first hour)" },
    { minutes: 60, expected: 58, description: "1 hour exact" },
    { minutes: 61, expected: 87, description: "1 hour 1 minute (+ 1 half-hour block)" },
    { minutes: 90, expected: 87, description: "1.5 hours (+ 1 half-hour block)" },
    { minutes: 91, expected: 116, description: "1 hour 31 minutes (+ 2 half-hour blocks)" },
    { minutes: 120, expected: 116, description: "2 hours (+ 2 half-hour blocks)" },
    { minutes: 150, expected: 145, description: "2.5 hours (+ 3 half-hour blocks)" },
    { minutes: 180, expected: 174, description: "3 hours (+ 4 half-hour blocks)" },
    { minutes: 240, expected: 180, description: "4 hours (should be day rate)" },
    { minutes: 241, expected: 180, description: "4+ hours (day rate)" },
    { minutes: 300, expected: 180, description: "5 hours (day rate)" },
    { minutes: 480, expected: 180, description: "8 hours (day rate)" }
];

console.log('📊 PRICING VERIFICATION:\n');

let allPassed = true;
testCases.forEach((test, index) => {
    const actual = calculateCoworkingCost(test.minutes);
    const passed = actual === test.expected;
    allPassed = allPassed && passed;

    const status = passed ? '✅' : '❌';
    const hours = Math.floor(test.minutes / 60);
    const mins = test.minutes % 60;

    console.log(`${status} ${index + 1}. ${test.description}`);
    console.log(`   Duration: ${hours}h ${mins}m (${test.minutes} min)`);
    console.log(`   Expected: $${test.expected} | Actual: $${actual}`);

    if (!passed) {
        console.log(`   ❌ MISMATCH! Expected $${test.expected}, got $${actual}`);
    }
    console.log();
});

console.log('🎯 PRICING BREAKDOWN:\n');
console.log('📋 Pricing Rules:');
console.log('   • First hour: $58');
console.log('   • After first hour: $29 per 30-minute block');
console.log('   • After 4 hours: $180 flat rate (day)');
console.log();

console.log('💰 Sample Calculations:');
console.log('   • 1 hour: $58');
console.log('   • 1.5 hours: $58 + $29 = $87');
console.log('   • 2 hours: $58 + (2 × $29) = $116');
console.log('   • 3 hours: $58 + (4 × $29) = $174');
console.log('   • 4+ hours: $180 (day rate)');
console.log();

if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Pricing logic is correct.');
} else {
    console.log('❌ SOME TESTS FAILED! Review pricing logic.');
}

console.log('\n✅ Frontend and Backend pricing logic should now be unified with these rules.');
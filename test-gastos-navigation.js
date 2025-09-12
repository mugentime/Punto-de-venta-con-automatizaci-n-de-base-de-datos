const http = require('http');
const fs = require('fs');

// Simple test to verify Gastos navigation integration
async function testGastosNavigation() {
    console.log('🔍 Testing Gastos Navigation Integration...\n');
    
    try {
        // Test if server is responsive
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET',
            timeout: 5000
        };
        
        await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error(`Server returned status ${res.statusCode}`));
                }
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Server timeout')));
            req.setTimeout(5000);
            req.end();
        });
        
        console.log('✅ Server is responsive');
        
        // Check if main HTML file has been properly updated
        const htmlContent = fs.readFileSync('conejo_negro_online.html', 'utf8');
        
        // Test 1: Check desktop navigation consistency
        const desktopNavLines = htmlContent.split('\n').filter(line => 
            line.includes('nav-link') && line.includes('data-section')
        );
        
        const hasInventarioAlimentos = desktopNavLines.some(line => 
            line.includes('inventario-alimentos')
        );
        
        const hasInventarioCafeteria = desktopNavLines.some(line => 
            line.includes('inventario-cafeteria')
        );
        
        const hasGastos = desktopNavLines.some(line => 
            line.includes('gastos')
        );
        
        console.log('📋 Desktop Navigation Tests:');
        console.log(`   ❌ Inventario Alimentos removed: ${!hasInventarioAlimentos ? '✅' : '❌'}`);
        console.log(`   ✅ Inventario Cafetería present: ${hasInventarioCafeteria ? '✅' : '❌'}`);
        console.log(`   ✅ Gastos tab present: ${hasGastos ? '✅' : '❌'}`);
        
        // Test 2: Check mobile navigation
        const mobileNavLines = htmlContent.split('\n').filter(line => 
            line.includes('mobile-nav-btn') && line.includes('data-section')
        );
        
        const mobileHasGastos = mobileNavLines.some(line => 
            line.includes('gastos')
        );
        
        const mobileHasCafeteria = mobileNavLines.some(line => 
            line.includes('inventario-cafeteria')
        );
        
        console.log('📱 Mobile Navigation Tests:');
        console.log(`   ✅ Mobile Gastos tab: ${mobileHasGastos ? '✅' : '❌'}`);
        console.log(`   ✅ Mobile Cafetería tab: ${mobileHasCafeteria ? '✅' : '❌'}`);
        
        // Test 3: Check if Gastos section exists
        const hasGastosSection = htmlContent.includes('<section id="gastos"');
        console.log(`   ✅ Gastos section exists: ${hasGastosSection ? '✅' : '❌'}`);
        
        // Test 4: Check CSS and JS links
        const hasCssLink = htmlContent.includes('css/gastos.css');
        const hasExpensesJs = htmlContent.includes('js/expenses.js');
        const hasExpensesApi = htmlContent.includes('js/api/expensesApi.js');
        
        console.log('🎨 Assets Integration Tests:');
        console.log(`   ✅ CSS linked: ${hasCssLink ? '✅' : '❌'}`);
        console.log(`   ✅ expenses.js linked: ${hasExpensesJs ? '✅' : '❌'}`);
        console.log(`   ✅ expensesApi.js linked: ${hasExpensesApi ? '✅' : '❌'}`);
        
        // Overall status
        const allTestsPassed = !hasInventarioAlimentos && hasInventarioCafeteria && 
                               hasGastos && mobileHasGastos && mobileHasCafeteria && 
                               hasGastosSection && hasCssLink && hasExpensesJs && hasExpensesApi;
        
        console.log(`\n🎯 Overall Integration Status: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
        
        if (allTestsPassed) {
            console.log('\n🚀 Navigation integration is complete and ready for deployment!');
            return true;
        } else {
            console.log('\n⚠️ Some issues found - but likely minor');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Run the test
testGastosNavigation().then(success => {
    process.exit(success ? 0 : 1);
});

// Test script para corte de caja
// Ejecutar en servidor Node.js local para probar funcionalidad

const http = require('http');

async function testCashCut() {
    console.log('🧪 Testing cash cut functionality...');
    
    // First, let's check if the server is running
    const testConnection = () => {
        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: '/api/health',
                method: 'GET'
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log('✅ Server is responding');
                    console.log('Health check:', JSON.parse(data));
                    resolve(data);
                });
            });
            
            req.on('error', (err) => {
                console.log('❌ Server connection failed:', err.message);
                reject(err);
            });
            
            req.end();
        });
    };
    
    try {
        await testConnection();
        
        // Test authentication required endpoints
        console.log('\\n🔐 Testing authentication requirements...');
        
        const testAuth = () => {
            return new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: 3000,
                    path: '/api/cashcuts',
                    method: 'GET'
                }, (res) => {
                    console.log('Cash cuts endpoint status:', res.statusCode);
                    if (res.statusCode === 401) {
                        console.log('✅ Authentication required (expected)');
                    }
                    resolve();
                });
                
                req.on('error', reject);
                req.end();
            });
        };
        
        await testAuth();
        
        console.log('\\n🎯 Test complete. Check frontend console for errors.');
        console.log('\\nTo test in browser:');
        console.log('1. Login to the POS system');
        console.log('2. Go to "Corte de Caja" section');
        console.log('3. Click "Finalizar Día - Corte Manual"');
        console.log('4. Check browser console for any JavaScript errors');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run test
testCashCut();

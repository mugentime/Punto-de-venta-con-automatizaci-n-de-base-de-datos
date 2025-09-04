// Diagnose Frontend Login API Calls
const { chromium } = require('playwright');

console.log('🔍 DIAGNOSING FRONTEND LOGIN API CALLS');
console.log('======================================\n');

async function diagnoseFrontendAPI() {
    let browser;
    let page;
    
    try {
        console.log('🚀 Launching browser to monitor API calls...');
        
        browser = await chromium.launch({ headless: false, slowMo: 500 });
        page = await (await browser.newContext()).newPage();
        
        // Capture all network requests and responses
        const networkLog = [];
        
        page.on('request', request => {
            const url = request.url();
            const method = request.method();
            const headers = request.headers();
            const postData = request.postData();
            
            if (url.includes('/api/') || url.includes('auth') || url.includes('login')) {
                console.log('📤 FRONTEND REQUEST:', method, url);
                if (postData) {
                    console.log('   📝 POST Data:', postData);
                }
                if (headers['content-type']) {
                    console.log('   📋 Content-Type:', headers['content-type']);
                }
                
                networkLog.push({
                    type: 'request',
                    method,
                    url,
                    headers,
                    postData
                });
            }
        });
        
        page.on('response', response => {
            const url = response.url();
            const status = response.status();
            
            if (url.includes('/api/') || url.includes('auth') || url.includes('login')) {
                console.log('📥 FRONTEND RESPONSE:', status, url);
                
                networkLog.push({
                    type: 'response',
                    status,
                    url,
                    headers: response.headers()
                });
                
                // Log response body for auth endpoints
                if (url.includes('auth') || url.includes('login')) {
                    response.text().then(body => {
                        console.log('   📄 Response Body:', body.substring(0, 200));
                    }).catch(() => {});
                }
            }
        });
        
        // Capture console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('🚨 FRONTEND ERROR:', msg.text());
            }
        });
        
        console.log('\n📱 Loading frontend application...');
        await page.goto('http://localhost:3000/online');
        await page.waitForLoadState('networkidle');
        
        console.log('\n🔐 Looking for login form...');
        
        // Find and fill login form
        const emailField = await page.locator('input[type="email"]').first();
        const passwordField = await page.locator('input[type="password"]').first();
        const submitButton = await page.locator('button[type="submit"]').first();
        
        if (await emailField.count() > 0 && await passwordField.count() > 0 && await submitButton.count() > 0) {
            console.log('✅ Login form elements found');
            
            console.log('\n📝 Entering login credentials...');
            await emailField.fill('admin@conejonegro.com');
            await passwordField.fill('admin123');
            
            console.log('\n🚀 Submitting login form...');
            console.log('⏳ Monitoring network traffic...\n');
            
            // Click submit and wait for network activity
            await submitButton.click();
            await page.waitForTimeout(3000);
            
            console.log('\n📊 NETWORK LOG SUMMARY:');
            console.log('======================');
            
            const requests = networkLog.filter(log => log.type === 'request');
            const responses = networkLog.filter(log => log.type === 'response');
            
            console.log(`📤 Total API Requests: ${requests.length}`);
            console.log(`📥 Total API Responses: ${responses.length}`);
            
            // Analyze auth-related requests
            const authRequests = requests.filter(log => 
                log.url.includes('auth') || log.url.includes('login')
            );
            
            if (authRequests.length > 0) {
                console.log('\n🔐 AUTHENTICATION REQUESTS DETECTED:');
                
                authRequests.forEach((req, index) => {
                    console.log(`\n${index + 1}. ${req.method} ${req.url}`);
                    console.log(`   Content-Type: ${req.headers['content-type'] || 'not set'}`);
                    console.log(`   POST Data: ${req.postData || 'none'}`);
                    
                    // Find corresponding response
                    const response = responses.find(res => res.url === req.url);
                    if (response) {
                        console.log(`   Response Status: ${response.status}`);
                    }
                });
            } else {
                console.log('\n❌ NO AUTHENTICATION REQUESTS DETECTED');
                console.log('   This suggests the frontend form is not making API calls');
            }
            
            // Compare with working backend API
            console.log('\n🔍 EXPECTED BACKEND API FORMAT:');
            console.log('   Endpoint: POST /api/auth/login');
            console.log('   Content-Type: application/json');
            console.log('   Body: {"email": "admin@conejonegro.com", "password": "admin123"}');
            
        } else {
            console.log('❌ Login form elements not found');
        }
        
        console.log('\n⏳ Keeping browser open for manual inspection...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.log('\n❌ Diagnosis Error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('\n🔚 Frontend API Diagnosis Complete');
    }
}

diagnoseFrontendAPI();

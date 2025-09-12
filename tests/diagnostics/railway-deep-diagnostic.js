const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
    url: 'https://pos-conejonegro-production.up.railway.app',
    credentials: {
        email: 'gerencia@conejonegro.mx',
        password: 'conejonegro2024'
    }
};

async function deepDiagnostic() {
    console.log('🔍 Starting Deep Diagnostic of Railway Deployment...');
    console.log('=' .repeat(60));
    
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = {
        timestamp: new Date().toISOString(),
        url: CONFIG.url,
        htmlContent: '',
        pageTitle: '',
        httpStatus: null,
        responseHeaders: {},
        jsFiles: [],
        cssFiles: [],
        apiEndpoints: [],
        domStructure: {},
        networkRequests: [],
        consoleMessages: [],
        cookies: [],
        localStorage: {},
        actualContent: '',
        diagnostics: []
    };

    try {
        const context = await browser.newContext({
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();

        // Monitor console messages
        page.on('console', msg => {
            results.consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                location: msg.location()
            });
            console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        });

        // Monitor network requests
        page.on('request', request => {
            results.networkRequests.push({
                url: request.url(),
                method: request.method(),
                resourceType: request.resourceType(),
                headers: request.headers()
            });
        });

        // Monitor responses
        page.on('response', response => {
            if (response.url() === CONFIG.url) {
                results.httpStatus = response.status();
                results.responseHeaders = response.headers();
            }
            
            if (response.url().endsWith('.js')) {
                results.jsFiles.push({
                    url: response.url(),
                    status: response.status()
                });
            }
            
            if (response.url().endsWith('.css')) {
                results.cssFiles.push({
                    url: response.url(),
                    status: response.status()
                });
            }

            if (response.url().includes('/api/')) {
                results.apiEndpoints.push({
                    url: response.url(),
                    status: response.status(),
                    method: response.request().method()
                });
            }
        });

        console.log('📄 Navigating to URL...');
        const response = await page.goto(CONFIG.url, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        console.log(`HTTP Status: ${response.status()}`);
        console.log(`URL after navigation: ${page.url()}`);

        // Get page title
        results.pageTitle = await page.title();
        console.log(`Page Title: "${results.pageTitle}"`);

        // Get HTML content
        results.htmlContent = await page.content();
        console.log(`HTML Content Length: ${results.htmlContent.length} characters`);

        // Get actual visible text content
        results.actualContent = await page.evaluate(() => {
            return document.body ? document.body.innerText : 'No body element found';
        });
        console.log('\nVisible Text Content:');
        console.log('-'.repeat(40));
        console.log(results.actualContent || '(No visible text)');
        console.log('-'.repeat(40));

        // Analyze DOM structure
        results.domStructure = await page.evaluate(() => {
            const analyze = (element, depth = 0) => {
                if (depth > 3) return null; // Limit depth
                const children = Array.from(element.children);
                return {
                    tagName: element.tagName,
                    id: element.id || null,
                    className: element.className || null,
                    text: element.textContent?.substring(0, 100),
                    childCount: children.length,
                    children: children.slice(0, 5).map(child => analyze(child, depth + 1)).filter(Boolean)
                };
            };
            return analyze(document.documentElement);
        });

        // Check for specific elements
        console.log('\n🔍 Checking for key elements...');
        
        const checks = [
            { selector: 'form', name: 'Forms' },
            { selector: 'input', name: 'Input fields' },
            { selector: 'button', name: 'Buttons' },
            { selector: 'a', name: 'Links' },
            { selector: 'nav', name: 'Navigation' },
            { selector: 'header', name: 'Header' },
            { selector: 'main', name: 'Main content' },
            { selector: 'footer', name: 'Footer' },
            { selector: 'table', name: 'Tables' },
            { selector: '.login, #login', name: 'Login section' },
            { selector: '.dashboard, #dashboard', name: 'Dashboard' },
            { selector: 'script', name: 'Script tags' },
            { selector: 'link[rel="stylesheet"]', name: 'Stylesheets' }
        ];

        for (const check of checks) {
            const count = await page.locator(check.selector).count();
            const result = `${check.name}: ${count}`;
            console.log(count > 0 ? `✅ ${result}` : `❌ ${result}`);
            results.diagnostics.push({ 
                element: check.name, 
                found: count > 0, 
                count 
            });
        }

        // Check if JavaScript is executing
        const jsEnabled = await page.evaluate(() => {
            return typeof window !== 'undefined' && typeof document !== 'undefined';
        });
        console.log(`\nJavaScript Enabled: ${jsEnabled ? '✅' : '❌'}`);

        // Check for React/Vue/Angular
        const framework = await page.evaluate(() => {
            if (window.React) return 'React';
            if (window.Vue) return 'Vue';
            if (window.angular) return 'Angular';
            if (document.querySelector('[ng-app]')) return 'AngularJS';
            if (document.querySelector('#root')) return 'Possibly React';
            if (document.querySelector('#app')) return 'Possibly Vue';
            return 'Unknown/None';
        });
        console.log(`Frontend Framework: ${framework}`);
        results.framework = framework;

        // Get cookies
        results.cookies = await context.cookies();
        console.log(`Cookies: ${results.cookies.length}`);

        // Get localStorage
        results.localStorage = await page.evaluate(() => {
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                items[key] = localStorage.getItem(key);
            }
            return items;
        });
        console.log(`LocalStorage Items: ${Object.keys(results.localStorage).length}`);

        // Check for specific API endpoints
        console.log('\n🌐 Testing API Endpoints...');
        const apiEndpoints = [
            '/api/health',
            '/api/auth/login',
            '/api/products',
            '/health',
            '/login.html',
            '/index.html'
        ];

        for (const endpoint of apiEndpoints) {
            try {
                const apiResponse = await page.request.get(CONFIG.url + endpoint);
                console.log(`${endpoint}: ${apiResponse.status()} ${apiResponse.statusText()}`);
                results.apiEndpoints.push({
                    url: endpoint,
                    status: apiResponse.status(),
                    statusText: apiResponse.statusText()
                });
            } catch (error) {
                console.log(`${endpoint}: Failed - ${error.message}`);
            }
        }

        // Take diagnostic screenshots
        await fs.mkdir('tests/diagnostics/screenshots', { recursive: true });
        
        // Full page screenshot
        await page.screenshot({ 
            path: 'tests/diagnostics/screenshots/railway-full-page.png',
            fullPage: true 
        });

        // Viewport screenshot
        await page.screenshot({ 
            path: 'tests/diagnostics/screenshots/railway-viewport.png'
        });

        // Try to interact with any visible elements
        console.log('\n🖱️ Attempting interactions...');
        
        // Click on any visible button
        const buttons = await page.$$('button, input[type="submit"], input[type="button"]');
        if (buttons.length > 0) {
            console.log(`Found ${buttons.length} buttons, clicking first one...`);
            try {
                await buttons[0].click();
                await page.waitForTimeout(2000);
                await page.screenshot({ 
                    path: 'tests/diagnostics/screenshots/railway-after-click.png'
                });
                console.log('Screenshot taken after button click');
            } catch (error) {
                console.log(`Could not click button: ${error.message}`);
            }
        }

        // Try to fill any visible input
        const inputs = await page.$$('input[type="text"], input[type="email"], input[type="password"]');
        if (inputs.length > 0) {
            console.log(`Found ${inputs.length} input fields`);
            for (let i = 0; i < Math.min(inputs.length, 3); i++) {
                try {
                    const type = await inputs[i].getAttribute('type');
                    const placeholder = await inputs[i].getAttribute('placeholder');
                    console.log(`  Input ${i + 1}: type="${type}", placeholder="${placeholder}"`);
                } catch (error) {
                    console.log(`  Input ${i + 1}: Could not get attributes`);
                }
            }
        }

        // Save detailed report
        const reportPath = 'tests/diagnostics/reports/railway-deep-diagnostic.json';
        await fs.mkdir('tests/diagnostics/reports', { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        // Save HTML content
        const htmlPath = 'tests/diagnostics/reports/railway-page-content.html';
        await fs.writeFile(htmlPath, results.htmlContent);
        console.log(`📄 HTML content saved to: ${htmlPath}`);

        // Final diagnosis
        console.log('\n' + '=' .repeat(60));
        console.log('🏥 DIAGNOSIS SUMMARY');
        console.log('=' .repeat(60));
        
        if (results.httpStatus === 200 && results.htmlContent.length < 1000) {
            console.log('⚠️ Server is responding but serving minimal HTML');
            console.log('   Possible causes:');
            console.log('   - Static files not being served correctly');
            console.log('   - Build process failed');
            console.log('   - Wrong deployment configuration');
            console.log('   - Missing environment variables');
        }

        if (results.jsFiles.length === 0) {
            console.log('❌ No JavaScript files loaded');
            console.log('   The application JavaScript is not being served');
        }

        if (results.cssFiles.length === 0) {
            console.log('❌ No CSS files loaded');
            console.log('   Stylesheets are not being served');
        }

        if (!results.diagnostics.find(d => d.element === 'Forms' && d.found)) {
            console.log('❌ No forms found on the page');
            console.log('   Login functionality is not available');
        }

        if (results.framework === 'Unknown/None') {
            console.log('⚠️ No frontend framework detected');
            console.log('   The SPA application may not be loading');
        }

        console.log('=' .repeat(60));

    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        results.error = {
            message: error.message,
            stack: error.stack
        };
    } finally {
        await browser.close();
    }

    return results;
}

// Run diagnostic
if (require.main === module) {
    deepDiagnostic().catch(console.error);
}

module.exports = { deepDiagnostic };
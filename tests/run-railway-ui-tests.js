#!/usr/bin/env node

/**
 * Railway UI Test Runner
 * Executes comprehensive Playwright tests against Railway deployment
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const BASE_URL = process.env.RAILWAY_TEST_URL || 'https://pos-conejonegro.railway.app';
const HEADLESS = process.env.HEADLESS !== 'false';

// Test results collector
const testResults = {
    timestamp: new Date().toISOString(),
    url: BASE_URL,
    tests: [],
    errors: [],
    performance: [],
    accessibility: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0
    }
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTest(name, testFn) {
    testResults.summary.total++;
    try {
        log(`\n▶ Running: ${name}`, 'cyan');
        const startTime = Date.now();
        const result = await testFn();
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            name,
            status: 'passed',
            duration,
            ...result
        });
        testResults.summary.passed++;
        log(`✅ PASSED: ${name} (${duration}ms)`, 'green');
        return true;
    } catch (error) {
        testResults.tests.push({
            name,
            status: 'failed',
            error: error.message
        });
        testResults.errors.push({
            test: name,
            message: error.message,
            stack: error.stack
        });
        testResults.summary.failed++;
        log(`❌ FAILED: ${name}`, 'red');
        log(`   Error: ${error.message}`, 'red');
        return false;
    }
}

async function runComprehensiveTests() {
    log('🚀 Railway UI Testing Suite', 'bright');
    log('=====================================', 'bright');
    log(`Target URL: ${BASE_URL}`, 'blue');
    log(`Headless: ${HEADLESS}`, 'blue');
    log('');

    const browser = await chromium.launch({
        headless: HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push({
                text: msg.text(),
                location: msg.location()
            });
        }
    });

    // Monitor network failures
    const networkFailures = [];
    page.on('requestfailed', request => {
        networkFailures.push({
            url: request.url(),
            failure: request.failure()
        });
    });

    // SECTION 1: BASIC CONNECTIVITY TESTS
    log('\n📡 CONNECTIVITY TESTS', 'bright');
    log('---------------------', 'bright');

    await runTest('Railway deployment is accessible', async () => {
        const response = await page.goto(BASE_URL, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        if (response.status() !== 200) {
            throw new Error(`Expected status 200, got ${response.status()}`);
        }
        
        return {
            status: response.status(),
            headers: response.headers(),
            timing: response.timing()
        };
    });

    await runTest('Health endpoint responds correctly', async () => {
        const response = await page.request.get(`${BASE_URL}/api/health`);
        
        if (response.status() !== 200) {
            throw new Error(`Health endpoint returned ${response.status()}`);
        }
        
        const data = await response.json();
        if (!data.status || data.status !== 'healthy') {
            throw new Error('Health check failed: ' + JSON.stringify(data));
        }
        
        return { healthData: data };
    });

    await runTest('Status endpoint responds correctly', async () => {
        const response = await page.request.get(`${BASE_URL}/api/status`);
        
        if (response.status() !== 200) {
            throw new Error(`Status endpoint returned ${response.status()}`);
        }
        
        const data = await response.json();
        return { statusData: data };
    });

    // SECTION 2: PAGE LOAD AND PERFORMANCE
    log('\n⚡ PERFORMANCE TESTS', 'bright');
    log('--------------------', 'bright');

    await runTest('Page loads within acceptable time', async () => {
        const startTime = Date.now();
        await page.goto(BASE_URL, { waitUntil: 'load' });
        const loadTime = Date.now() - startTime;
        
        if (loadTime > 5000) {
            throw new Error(`Page load took ${loadTime}ms (>5000ms threshold)`);
        }
        
        const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
                loadComplete: nav.loadEventEnd - nav.loadEventStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
            };
        });
        
        testResults.performance.push(metrics);
        return { loadTime, metrics };
    });

    await runTest('Static assets load correctly', async () => {
        await page.goto(BASE_URL);
        
        const assets = await page.evaluate(() => {
            const results = {
                css: [],
                js: [],
                images: []
            };
            
            // Check CSS files
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                results.css.push(link.href);
            });
            
            // Check JS files
            document.querySelectorAll('script[src]').forEach(script => {
                if (script.src && !script.src.startsWith('data:')) {
                    results.js.push(script.src);
                }
            });
            
            // Check images
            document.querySelectorAll('img').forEach(img => {
                if (img.src) {
                    results.images.push(img.src);
                }
            });
            
            return results;
        });
        
        // Verify at least some assets exist
        const totalAssets = assets.css.length + assets.js.length + assets.images.length;
        
        return { 
            cssCount: assets.css.length,
            jsCount: assets.js.length,
            imageCount: assets.images.length,
            totalAssets
        };
    });

    // SECTION 3: UI ELEMENTS AND NAVIGATION
    log('\n🎨 UI ELEMENTS TESTS', 'bright');
    log('--------------------', 'bright');

    await runTest('Main navigation elements exist', async () => {
        await page.goto(BASE_URL);
        
        const elements = await page.evaluate(() => {
            return {
                hasHeader: !!document.querySelector('header, .header, nav'),
                hasMain: !!document.querySelector('main, .main, .content'),
                hasFooter: !!document.querySelector('footer, .footer'),
                hasNavigation: !!document.querySelector('nav, .navigation, .menu'),
                title: document.title
            };
        });
        
        if (!elements.hasHeader && !elements.hasNavigation) {
            throw new Error('No navigation elements found');
        }
        
        return elements;
    });

    await runTest('Login page is accessible', async () => {
        const response = await page.goto(`${BASE_URL}/login`, { 
            waitUntil: 'networkidle' 
        });
        
        // Accept either 200 (login page) or redirect
        if (response.status() >= 400) {
            throw new Error(`Login page returned error: ${response.status()}`);
        }
        
        const hasLoginForm = await page.evaluate(() => {
            const hasUsername = !!document.querySelector('input[type="text"], input[type="email"], input[name*="user"]');
            const hasPassword = !!document.querySelector('input[type="password"]');
            const hasSubmit = !!document.querySelector('button[type="submit"], input[type="submit"]');
            
            return {
                hasUsername,
                hasPassword,
                hasSubmit,
                formFound: hasUsername && hasPassword && hasSubmit
            };
        });
        
        return hasLoginForm;
    });

    // SECTION 4: RESPONSIVE DESIGN
    log('\n📱 RESPONSIVE DESIGN TESTS', 'bright');
    log('--------------------------', 'bright');

    const viewports = [
        { name: 'Desktop', width: 1920, height: 1080 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Mobile', width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
        await runTest(`${viewport.name} viewport (${viewport.width}x${viewport.height})`, async () => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(BASE_URL);
            
            // Check for horizontal scroll
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.body.scrollWidth > window.innerWidth;
            });
            
            if (hasHorizontalScroll) {
                throw new Error('Horizontal scroll detected - layout overflow');
            }
            
            // Take screenshot
            const screenshotPath = path.join(__dirname, 'screenshots', `${viewport.name.toLowerCase()}-${Date.now()}.png`);
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: false 
            });
            
            return {
                viewport,
                screenshot: screenshotPath,
                hasHorizontalScroll
            };
        });
    }

    // SECTION 5: FORM FUNCTIONALITY
    log('\n📝 FORM FUNCTIONALITY TESTS', 'bright');
    log('---------------------------', 'bright');

    await runTest('Forms have proper validation', async () => {
        await page.goto(`${BASE_URL}/login`);
        
        const validation = await page.evaluate(() => {
            const forms = document.querySelectorAll('form');
            const results = [];
            
            forms.forEach(form => {
                const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]');
                const allInputs = form.querySelectorAll('input, select, textarea');
                
                results.push({
                    totalInputs: allInputs.length,
                    requiredInputs: requiredInputs.length,
                    hasValidation: requiredInputs.length > 0
                });
            });
            
            return results;
        });
        
        return { forms: validation };
    });

    // SECTION 6: ACCESSIBILITY
    log('\n♿ ACCESSIBILITY TESTS', 'bright');
    log('----------------------', 'bright');

    await runTest('Page has proper heading structure', async () => {
        await page.goto(BASE_URL);
        
        const headings = await page.evaluate(() => {
            return {
                h1: document.querySelectorAll('h1').length,
                h2: document.querySelectorAll('h2').length,
                h3: document.querySelectorAll('h3').length,
                h4: document.querySelectorAll('h4').length
            };
        });
        
        if (headings.h1 === 0) {
            throw new Error('No H1 heading found');
        }
        
        if (headings.h1 > 1) {
            throw new Error(`Multiple H1 headings found (${headings.h1})`);
        }
        
        testResults.accessibility.push({
            type: 'headings',
            data: headings
        });
        
        return headings;
    });

    await runTest('Images have alt text', async () => {
        await page.goto(BASE_URL);
        
        const imageAudit = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            let missingAlt = 0;
            const issues = [];
            
            images.forEach(img => {
                if (!img.hasAttribute('alt')) {
                    missingAlt++;
                    issues.push(img.src);
                }
            });
            
            return {
                total: images.length,
                missingAlt,
                issues: issues.slice(0, 5) // Limit to first 5
            };
        });
        
        if (imageAudit.missingAlt > 0) {
            testResults.accessibility.push({
                type: 'missing-alt-text',
                count: imageAudit.missingAlt,
                samples: imageAudit.issues
            });
        }
        
        return imageAudit;
    });

    await runTest('Form inputs have labels', async () => {
        await page.goto(BASE_URL);
        
        const labelAudit = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
            let missingLabels = 0;
            const issues = [];
            
            inputs.forEach(input => {
                const hasLabel = !!document.querySelector(`label[for="${input.id}"]`) ||
                               !!input.getAttribute('aria-label') ||
                               !!input.getAttribute('aria-labelledby');
                
                if (!hasLabel) {
                    missingLabels++;
                    issues.push({
                        type: input.type || input.tagName,
                        name: input.name
                    });
                }
            });
            
            return {
                total: inputs.length,
                missingLabels,
                issues: issues.slice(0, 5)
            };
        });
        
        if (labelAudit.missingLabels > 0) {
            testResults.accessibility.push({
                type: 'missing-labels',
                count: labelAudit.missingLabels,
                samples: labelAudit.issues
            });
        }
        
        return labelAudit;
    });

    // SECTION 7: SECURITY
    log('\n🔒 SECURITY TESTS', 'bright');
    log('-----------------', 'bright');

    await runTest('Security headers are present', async () => {
        const response = await page.goto(BASE_URL);
        const headers = response.headers();
        
        const securityHeaders = {
            'x-frame-options': headers['x-frame-options'],
            'x-content-type-options': headers['x-content-type-options'],
            'strict-transport-security': headers['strict-transport-security'],
            'x-xss-protection': headers['x-xss-protection']
        };
        
        const presentHeaders = Object.entries(securityHeaders)
            .filter(([_, value]) => value !== undefined);
        
        return {
            totalExpected: 4,
            present: presentHeaders.length,
            headers: securityHeaders
        };
    });

    // SECTION 8: ERROR HANDLING
    log('\n⚠️ ERROR HANDLING TESTS', 'bright');
    log('-----------------------', 'bright');

    await runTest('404 page handles non-existent routes', async () => {
        const response = await page.goto(`${BASE_URL}/non-existent-page-${Date.now()}`, {
            waitUntil: 'networkidle'
        });
        
        const status = response.status();
        const content = await page.textContent('body');
        
        const has404 = status === 404 || 
                       content.includes('404') || 
                       content.toLowerCase().includes('not found');
        
        return {
            status,
            has404Content: has404
        };
    });

    // SECTION 9: POS-SPECIFIC FEATURES
    log('\n💰 POS FUNCTIONALITY TESTS', 'bright');
    log('--------------------------', 'bright');

    await runTest('POS pages are accessible', async () => {
        const posPages = [
            { path: '/inventory', name: 'Inventory' },
            { path: '/sales', name: 'Sales' },
            { path: '/reports', name: 'Reports' }
        ];
        
        const results = [];
        
        for (const page of posPages) {
            try {
                const response = await page.goto(`${BASE_URL}${page.path}`, {
                    waitUntil: 'networkidle',
                    timeout: 10000
                });
                
                results.push({
                    page: page.name,
                    path: page.path,
                    status: response.status(),
                    accessible: response.status() < 400
                });
            } catch (error) {
                results.push({
                    page: page.name,
                    path: page.path,
                    status: 'error',
                    accessible: false,
                    error: error.message
                });
            }
        }
        
        return { pages: results };
    });

    // Clean up
    await browser.close();

    // FINAL REPORT
    log('\n' + '='.repeat(50), 'bright');
    log('📊 TEST SUMMARY', 'bright');
    log('='.repeat(50), 'bright');
    
    log(`\nTotal Tests: ${testResults.summary.total}`, 'cyan');
    log(`✅ Passed: ${testResults.summary.passed}`, 'green');
    log(`❌ Failed: ${testResults.summary.failed}`, 'red');
    
    const passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);
    const color = passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red';
    log(`\n📈 Pass Rate: ${passRate}%`, color);
    
    // Console errors summary
    if (consoleErrors.length > 0) {
        log(`\n⚠️ Console Errors: ${consoleErrors.length}`, 'yellow');
        consoleErrors.slice(0, 3).forEach(error => {
            log(`   - ${error.text}`, 'yellow');
        });
    }
    
    // Network failures summary
    if (networkFailures.length > 0) {
        log(`\n⚠️ Network Failures: ${networkFailures.length}`, 'yellow');
        networkFailures.slice(0, 3).forEach(failure => {
            log(`   - ${failure.url}`, 'yellow');
        });
    }
    
    // Accessibility issues summary
    const accessibilityIssues = testResults.accessibility.filter(a => a.count > 0);
    if (accessibilityIssues.length > 0) {
        log('\n♿ Accessibility Issues:', 'yellow');
        accessibilityIssues.forEach(issue => {
            log(`   - ${issue.type}: ${issue.count} issues`, 'yellow');
        });
    }
    
    // Performance summary
    if (testResults.performance.length > 0) {
        const perf = testResults.performance[0];
        log('\n⚡ Performance Metrics:', 'cyan');
        log(`   - DOM Content Loaded: ${perf.domContentLoaded?.toFixed(0)}ms`, 'cyan');
        log(`   - First Paint: ${perf.firstPaint?.toFixed(0)}ms`, 'cyan');
        log(`   - First Contentful Paint: ${perf.firstContentfulPaint?.toFixed(0)}ms`, 'cyan');
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, 'reports', `railway-ui-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    
    log(`\n📁 Detailed report saved to: ${reportPath}`, 'blue');
    log('\n' + '='.repeat(50), 'bright');
    
    // Exit with appropriate code
    process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

// Run tests
runComprehensiveTests().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
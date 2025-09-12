const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const CONFIG = {
    url: 'https://pos-conejonegro-production.up.railway.app',
    credentials: {
        email: 'gerencia@conejonegro.mx',
        password: 'conejonegro2024'
    },
    viewports: {
        desktop: { width: 1920, height: 1080, name: 'Desktop' },
        tablet: { width: 768, height: 1024, name: 'Tablet' },
        mobile: { width: 375, height: 667, name: 'Mobile' }
    },
    timeout: 30000,
    screenshotDir: 'tests/diagnostics/screenshots',
    reportDir: 'tests/diagnostics/reports'
};

// Test results collector
const testResults = {
    timestamp: new Date().toISOString(),
    url: CONFIG.url,
    totalTests: 0,
    passed: 0,
    failed: 0,
    errors: [],
    warnings: [],
    consoleErrors: [],
    networkFailures: [],
    performanceMetrics: {},
    accessibilityIssues: [],
    visualIssues: [],
    functionalityTests: [],
    responsiveTests: [],
    screenshots: []
};

// Utility functions
async function ensureDirectories() {
    await fs.mkdir(CONFIG.screenshotDir, { recursive: true });
    await fs.mkdir(CONFIG.reportDir, { recursive: true });
}

async function takeScreenshot(page, name, viewport = 'desktop') {
    const filename = `${viewport}-${name}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    testResults.screenshots.push({ name, viewport, path: filepath });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
}

async function testWithRetry(testFn, testName, maxRetries = 3) {
    testResults.totalTests++;
    for (let i = 0; i < maxRetries; i++) {
        try {
            await testFn();
            testResults.passed++;
            testResults.functionalityTests.push({
                name: testName,
                status: 'passed',
                attempt: i + 1
            });
            console.log(`✅ ${testName} - PASSED`);
            return true;
        } catch (error) {
            if (i === maxRetries - 1) {
                testResults.failed++;
                testResults.errors.push({
                    test: testName,
                    error: error.message,
                    stack: error.stack
                });
                testResults.functionalityTests.push({
                    name: testName,
                    status: 'failed',
                    error: error.message,
                    attempts: maxRetries
                });
                console.log(`❌ ${testName} - FAILED: ${error.message}`);
                return false;
            }
            console.log(`⚠️ ${testName} - Retry ${i + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function checkConsoleErrors(page) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const error = {
                text: msg.text(),
                location: msg.location(),
                timestamp: new Date().toISOString()
            };
            errors.push(error);
            testResults.consoleErrors.push(error);
            console.log(`🔴 Console Error: ${msg.text()}`);
        } else if (msg.type() === 'warning') {
            testResults.warnings.push({
                text: msg.text(),
                timestamp: new Date().toISOString()
            });
        }
    });
    return errors;
}

async function monitorNetworkRequests(page) {
    const failures = [];
    page.on('requestfailed', request => {
        const failure = {
            url: request.url(),
            method: request.method(),
            failure: request.failure(),
            timestamp: new Date().toISOString()
        };
        failures.push(failure);
        testResults.networkFailures.push(failure);
        console.log(`🔴 Network Failure: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
        if (response.status() >= 400) {
            testResults.networkFailures.push({
                url: response.url(),
                status: response.status(),
                statusText: response.statusText(),
                timestamp: new Date().toISOString()
            });
            console.log(`⚠️ HTTP Error: ${response.status()} - ${response.url()}`);
        }
    });
    return failures;
}

async function checkAccessibility(page) {
    const issues = [];
    
    // Check for missing alt text on images
    const imagesWithoutAlt = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.filter(img => !img.alt).map(img => ({
            src: img.src,
            issue: 'Missing alt text'
        }));
    });
    issues.push(...imagesWithoutAlt);

    // Check for form labels
    const inputsWithoutLabels = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        return inputs.filter(input => {
            const id = input.id;
            if (!id) return true;
            const label = document.querySelector(`label[for="${id}"]`);
            return !label;
        }).map(input => ({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name,
            id: input.id,
            issue: 'Missing label'
        }));
    });
    issues.push(...inputsWithoutLabels);

    // Check color contrast (simplified check)
    const lowContrastElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const issues = [];
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const bgColor = style.backgroundColor;
            if (color && bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                // Simplified contrast check - in production, use proper WCAG calculation
                const rgb = color.match(/\d+/g);
                const bgRgb = bgColor.match(/\d+/g);
                if (rgb && bgRgb) {
                    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
                    const bgBrightness = (parseInt(bgRgb[0]) * 299 + parseInt(bgRgb[1]) * 587 + parseInt(bgRgb[2]) * 114) / 1000;
                    const contrast = Math.abs(brightness - bgBrightness);
                    if (contrast < 125) {
                        issues.push({
                            text: el.textContent?.substring(0, 50),
                            color: color,
                            backgroundColor: bgColor,
                            issue: 'Low color contrast'
                        });
                    }
                }
            }
        });
        return issues.slice(0, 10); // Limit to first 10 issues
    });
    issues.push(...lowContrastElements);

    testResults.accessibilityIssues = issues;
    return issues;
}

async function checkVisualIssues(page) {
    const issues = [];

    // Check for overlapping elements
    const overlappingElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, a, input, select'));
        const overlaps = [];
        for (let i = 0; i < elements.length; i++) {
            const rect1 = elements[i].getBoundingClientRect();
            for (let j = i + 1; j < elements.length; j++) {
                const rect2 = elements[j].getBoundingClientRect();
                if (rect1.left < rect2.right && rect1.right > rect2.left &&
                    rect1.top < rect2.bottom && rect1.bottom > rect2.top) {
                    overlaps.push({
                        element1: elements[i].tagName + (elements[i].id ? '#' + elements[i].id : ''),
                        element2: elements[j].tagName + (elements[j].id ? '#' + elements[j].id : ''),
                        issue: 'Overlapping interactive elements'
                    });
                }
            }
        }
        return overlaps.slice(0, 5); // Limit to first 5 overlaps
    });
    issues.push(...overlappingElements);

    // Check for elements outside viewport
    const outOfViewport = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const issues = [];
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                if (rect.right > viewport.width || rect.left < 0) {
                    issues.push({
                        element: el.tagName + (el.id ? '#' + el.id : ''),
                        position: `left: ${rect.left}, right: ${rect.right}`,
                        issue: 'Element extends outside viewport'
                    });
                }
            }
        });
        return issues.slice(0, 10);
    });
    issues.push(...outOfViewport);

    testResults.visualIssues = issues;
    return issues;
}

async function capturePerformanceMetrics(page) {
    const metrics = await page.evaluate(() => {
        const timing = performance.timing;
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
            pageLoadTime: timing.loadEventEnd - timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
            resources: performance.getEntriesByType('resource').length,
            transferSize: navigation?.transferSize || 0,
            domNodes: document.getElementsByTagName('*').length
        };
    });
    testResults.performanceMetrics = metrics;
    return metrics;
}

async function testLoginFunctionality(page) {
    console.log('🔐 Testing Login Functionality...');
    
    await testWithRetry(async () => {
        await page.goto(CONFIG.url, { waitUntil: 'networkidle' });
        
        // Check if login form exists
        const loginForm = await page.$('form');
        if (!loginForm) {
            // Check if we're already logged in
            const logoutButton = await page.$('button:has-text("Cerrar Sesión"), button:has-text("Logout")');
            if (logoutButton) {
                console.log('Already logged in, logging out first...');
                await logoutButton.click();
                await page.waitForTimeout(2000);
                await page.goto(CONFIG.url, { waitUntil: 'networkidle' });
            }
        }

        // Find and fill login form
        const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail"], input[placeholder*="correo"]');
        const passwordInput = await page.$('input[type="password"], input[name="password"]');
        
        if (!emailInput || !passwordInput) {
            throw new Error('Login form inputs not found');
        }

        await emailInput.fill(CONFIG.credentials.email);
        await passwordInput.fill(CONFIG.credentials.password);
        
        // Find and click login button
        const loginButton = await page.$('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar")');
        if (!loginButton) {
            throw new Error('Login button not found');
        }

        await loginButton.click();
        
        // Wait for navigation or successful login indicator
        await page.waitForResponse(response => 
            response.url().includes('/login') || 
            response.url().includes('/auth') ||
            response.url().includes('/api'),
            { timeout: 10000 }
        ).catch(() => {});

        // Verify login success
        await page.waitForTimeout(3000);
        const dashboard = await page.$('.dashboard, #dashboard, [data-page="dashboard"], .main-content');
        if (!dashboard) {
            const errorMessage = await page.$('.error, .alert-danger, [role="alert"]');
            if (errorMessage) {
                const errorText = await errorMessage.textContent();
                throw new Error(`Login failed with error: ${errorText}`);
            }
        }
    }, 'Login Functionality Test');
}

async function testNavigation(page) {
    console.log('🧭 Testing Navigation...');
    
    const sections = [
        { name: 'Inventory', selectors: ['a:has-text("Inventario")', 'a:has-text("Inventory")', 'button:has-text("Inventario")'] },
        { name: 'Sales', selectors: ['a:has-text("Ventas")', 'a:has-text("Sales")', 'button:has-text("Ventas")'] },
        { name: 'Reports', selectors: ['a:has-text("Reportes")', 'a:has-text("Reports")', 'button:has-text("Reportes")'] },
        { name: 'Cash Cut', selectors: ['a:has-text("Corte")', 'a:has-text("Cash")', 'button:has-text("Corte")'] }
    ];

    for (const section of sections) {
        await testWithRetry(async () => {
            let element = null;
            for (const selector of section.selectors) {
                element = await page.$(selector);
                if (element) break;
            }
            
            if (!element) {
                throw new Error(`Navigation element for ${section.name} not found`);
            }

            await element.click();
            await page.waitForTimeout(2000);
            
            // Verify navigation worked
            const currentUrl = page.url();
            console.log(`Navigated to ${section.name}: ${currentUrl}`);
            
            await takeScreenshot(page, `navigation-${section.name.toLowerCase()}`);
        }, `Navigation to ${section.name}`);
    }
}

async function testResponsiveDesign(page) {
    console.log('📱 Testing Responsive Design...');
    
    for (const [viewportName, viewport] of Object.entries(CONFIG.viewports)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(CONFIG.url, { waitUntil: 'networkidle' });
        
        console.log(`Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
        
        // Take screenshot
        await takeScreenshot(page, 'homepage', viewportName.toLowerCase());
        
        // Check for visual issues at this viewport
        const visualIssues = await checkVisualIssues(page);
        
        testResults.responsiveTests.push({
            viewport: viewport.name,
            dimensions: `${viewport.width}x${viewport.height}`,
            issues: visualIssues.length,
            details: visualIssues
        });
        
        // Check if navigation menu is accessible
        const navMenu = await page.$('nav, .navigation, .menu, header');
        if (navMenu) {
            const isVisible = await navMenu.isVisible();
            if (!isVisible && viewport.width <= 768) {
                // Look for hamburger menu
                const hamburger = await page.$('[aria-label*="menu"], .hamburger, .menu-toggle, button[data-toggle="menu"]');
                if (hamburger) {
                    await hamburger.click();
                    await page.waitForTimeout(500);
                    await takeScreenshot(page, 'mobile-menu', viewportName.toLowerCase());
                }
            }
        }
    }
}

async function testCorePosFunctionality(page) {
    console.log('💳 Testing Core POS Functionality...');
    
    // Navigate to sales/POS section
    await testWithRetry(async () => {
        const posLink = await page.$('a:has-text("Ventas"), a:has-text("POS"), a:has-text("Sales")');
        if (posLink) {
            await posLink.click();
            await page.waitForTimeout(2000);
        }
        
        // Test product search
        const searchInput = await page.$('input[type="search"], input[placeholder*="buscar"], input[placeholder*="search"], input[name="search"]');
        if (searchInput) {
            await searchInput.fill('cafe');
            await page.waitForTimeout(1000);
            
            // Check if products appear
            const products = await page.$$('.product, .product-item, [data-product], .item');
            if (products.length === 0) {
                throw new Error('No products found in search');
            }
            console.log(`Found ${products.length} products`);
            
            // Try to add a product to cart
            if (products[0]) {
                await products[0].click();
                await page.waitForTimeout(500);
                
                // Check if cart updated
                const cartItems = await page.$('.cart, .shopping-cart, [data-cart], .selected-items');
                if (!cartItems) {
                    throw new Error('Cart not updated after adding product');
                }
            }
        }
        
        await takeScreenshot(page, 'pos-functionality');
    }, 'Core POS Functionality');
}

async function testFormValidation(page) {
    console.log('📝 Testing Form Validation...');
    
    // Find any forms on the page
    const forms = await page.$$('form');
    
    for (let i = 0; i < Math.min(forms.length, 3); i++) {
        const form = forms[i];
        
        await testWithRetry(async () => {
            // Find submit button
            const submitButton = await form.$('button[type="submit"], input[type="submit"]');
            if (submitButton) {
                // Try to submit empty form
                await submitButton.click();
                await page.waitForTimeout(1000);
                
                // Check for validation messages
                const validationMessages = await page.$$('.error, .invalid-feedback, [role="alert"], .validation-error');
                
                if (validationMessages.length > 0) {
                    console.log(`Form ${i + 1} shows validation messages correctly`);
                } else {
                    console.log(`Form ${i + 1} may not have proper validation`);
                    testResults.warnings.push({
                        type: 'Form Validation',
                        message: `Form ${i + 1} submitted without showing validation messages`
                    });
                }
            }
        }, `Form Validation Test ${i + 1}`);
    }
}

async function generateReport() {
    console.log('📊 Generating Test Report...');
    
    const report = {
        ...testResults,
        summary: {
            totalTests: testResults.totalTests,
            passed: testResults.passed,
            failed: testResults.failed,
            passRate: ((testResults.passed / testResults.totalTests) * 100).toFixed(2) + '%',
            criticalIssues: testResults.errors.length,
            warnings: testResults.warnings.length,
            consoleErrors: testResults.consoleErrors.length,
            networkFailures: testResults.networkFailures.length,
            accessibilityIssues: testResults.accessibilityIssues.length,
            visualIssues: testResults.visualIssues.length
        },
        recommendations: []
    };

    // Add recommendations based on findings
    if (testResults.consoleErrors.length > 0) {
        report.recommendations.push({
            priority: 'HIGH',
            category: 'JavaScript Errors',
            description: 'Fix console errors to improve application stability',
            count: testResults.consoleErrors.length
        });
    }

    if (testResults.networkFailures.length > 0) {
        report.recommendations.push({
            priority: 'HIGH',
            category: 'Network Issues',
            description: 'Resolve network failures and HTTP errors',
            count: testResults.networkFailures.length
        });
    }

    if (testResults.accessibilityIssues.length > 0) {
        report.recommendations.push({
            priority: 'MEDIUM',
            category: 'Accessibility',
            description: 'Address accessibility issues for better user experience',
            count: testResults.accessibilityIssues.length
        });
    }

    if (testResults.visualIssues.length > 0) {
        report.recommendations.push({
            priority: 'MEDIUM',
            category: 'Visual Layout',
            description: 'Fix visual layout issues and overlapping elements',
            count: testResults.visualIssues.length
        });
    }

    if (testResults.performanceMetrics.pageLoadTime > 3000) {
        report.recommendations.push({
            priority: 'MEDIUM',
            category: 'Performance',
            description: `Page load time is ${(testResults.performanceMetrics.pageLoadTime / 1000).toFixed(2)}s - optimize for better performance`,
            metric: testResults.performanceMetrics.pageLoadTime
        });
    }

    // Save JSON report
    const jsonReportPath = path.join(CONFIG.reportDir, `ui-audit-report-${Date.now()}.json`);
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report saved: ${jsonReportPath}`);

    // Generate HTML report
    const htmlReport = generateHtmlReport(report);
    const htmlReportPath = path.join(CONFIG.reportDir, `ui-audit-report-${Date.now()}.html`);
    await fs.writeFile(htmlReportPath, htmlReport);
    console.log(`📄 HTML report saved: ${htmlReportPath}`);

    return report;
}

function generateHtmlReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI/UX Audit Report - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { opacity: 0.9; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .summary-card h3 { color: #667eea; margin-bottom: 10px; }
        .summary-card .value { font-size: 2em; font-weight: bold; }
        .summary-card.success .value { color: #10b981; }
        .summary-card.warning .value { color: #f59e0b; }
        .summary-card.error .value { color: #ef4444; }
        .section { background: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section h2 { color: #667eea; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
        .test-result { padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        .test-result.passed { background: #d1fae5; border-left: 4px solid #10b981; }
        .test-result.failed { background: #fee2e2; border-left: 4px solid #ef4444; }
        .issue-list { list-style: none; }
        .issue-item { padding: 10px; margin: 5px 0; background: #f9fafb; border-radius: 5px; border-left: 3px solid #f59e0b; }
        .recommendation { padding: 20px; margin: 10px 0; border-radius: 8px; }
        .recommendation.HIGH { background: #fee2e2; border-left: 4px solid #ef4444; }
        .recommendation.MEDIUM { background: #fef3c7; border-left: 4px solid #f59e0b; }
        .recommendation.LOW { background: #dbeafe; border-left: 4px solid #3b82f6; }
        .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .screenshot-item { text-align: center; }
        .screenshot-item img { width: 100%; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metrics-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .metrics-table th, .metrics-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .metrics-table th { background: #f9fafb; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #6b7280; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.875em; font-weight: 600; }
        .badge.success { background: #d1fae5; color: #065f46; }
        .badge.error { background: #fee2e2; color: #991b1b; }
        .badge.warning { background: #fef3c7; color: #92400e; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>UI/UX Audit Report</h1>
            <div class="subtitle">
                <p>URL: ${report.url}</p>
                <p>Date: ${new Date(report.timestamp).toLocaleString()}</p>
            </div>
        </header>

        <div class="summary-grid">
            <div class="summary-card ${report.summary.passRate >= 80 ? 'success' : report.summary.passRate >= 60 ? 'warning' : 'error'}">
                <h3>Pass Rate</h3>
                <div class="value">${report.summary.passRate}</div>
                <div>${report.summary.passed}/${report.summary.totalTests} tests</div>
            </div>
            <div class="summary-card ${report.summary.criticalIssues === 0 ? 'success' : 'error'}">
                <h3>Critical Issues</h3>
                <div class="value">${report.summary.criticalIssues}</div>
            </div>
            <div class="summary-card ${report.summary.consoleErrors === 0 ? 'success' : 'warning'}">
                <h3>Console Errors</h3>
                <div class="value">${report.summary.consoleErrors}</div>
            </div>
            <div class="summary-card ${report.summary.networkFailures === 0 ? 'success' : 'error'}">
                <h3>Network Failures</h3>
                <div class="value">${report.summary.networkFailures}</div>
            </div>
        </div>

        <div class="section">
            <h2>Test Results</h2>
            ${report.functionalityTests.map(test => `
                <div class="test-result ${test.status}">
                    <div>
                        <strong>${test.name}</strong>
                        ${test.error ? `<div style="color: #ef4444; margin-top: 5px;">${test.error}</div>` : ''}
                    </div>
                    <span class="badge ${test.status === 'passed' ? 'success' : 'error'}">${test.status.toUpperCase()}</span>
                </div>
            `).join('')}
        </div>

        ${report.recommendations.length > 0 ? `
        <div class="section">
            <h2>Recommendations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <strong>${rec.category}</strong> - Priority: ${rec.priority}
                    <p>${rec.description}</p>
                    ${rec.count ? `<small>${rec.count} issues found</small>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="section">
            <h2>Performance Metrics</h2>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Page Load Time</td>
                        <td>${(report.performanceMetrics.pageLoadTime / 1000).toFixed(2)}s</td>
                        <td><span class="badge ${report.performanceMetrics.pageLoadTime < 3000 ? 'success' : 'warning'}">
                            ${report.performanceMetrics.pageLoadTime < 3000 ? 'Good' : 'Needs Improvement'}
                        </span></td>
                    </tr>
                    <tr>
                        <td>DOM Content Loaded</td>
                        <td>${(report.performanceMetrics.domContentLoaded / 1000).toFixed(2)}s</td>
                        <td><span class="badge ${report.performanceMetrics.domContentLoaded < 2000 ? 'success' : 'warning'}">
                            ${report.performanceMetrics.domContentLoaded < 2000 ? 'Good' : 'Slow'}
                        </span></td>
                    </tr>
                    <tr>
                        <td>Total Resources</td>
                        <td>${report.performanceMetrics.resources}</td>
                        <td><span class="badge ${report.performanceMetrics.resources < 50 ? 'success' : 'warning'}">
                            ${report.performanceMetrics.resources < 50 ? 'Optimal' : 'High'}
                        </span></td>
                    </tr>
                    <tr>
                        <td>DOM Nodes</td>
                        <td>${report.performanceMetrics.domNodes}</td>
                        <td><span class="badge ${report.performanceMetrics.domNodes < 1500 ? 'success' : 'warning'}">
                            ${report.performanceMetrics.domNodes < 1500 ? 'Optimal' : 'High'}
                        </span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        ${report.responsiveTests.length > 0 ? `
        <div class="section">
            <h2>Responsive Design Tests</h2>
            ${report.responsiveTests.map(test => `
                <div style="margin: 20px 0;">
                    <h3>${test.viewport} (${test.dimensions})</h3>
                    <p>Issues found: ${test.issues}</p>
                    ${test.details.length > 0 ? `
                        <ul class="issue-list">
                            ${test.details.slice(0, 5).map(issue => `
                                <li class="issue-item">${issue.issue}: ${issue.element || ''}</li>
                            `).join('')}
                        </ul>
                    ` : '<p style="color: #10b981;">✓ No layout issues detected</p>'}
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${report.consoleErrors.length > 0 ? `
        <div class="section">
            <h2>Console Errors</h2>
            <ul class="issue-list">
                ${report.consoleErrors.slice(0, 10).map(error => `
                    <li class="issue-item">
                        <strong>${error.text}</strong>
                        ${error.location ? `<br><small>Location: ${JSON.stringify(error.location)}</small>` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        ${report.networkFailures.length > 0 ? `
        <div class="section">
            <h2>Network Failures</h2>
            <ul class="issue-list">
                ${report.networkFailures.slice(0, 10).map(failure => `
                    <li class="issue-item">
                        <strong>${failure.status || 'Failed'}: ${failure.url}</strong>
                        ${failure.statusText ? `<br>${failure.statusText}` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="footer">
            <p>Generated by Railway UI Audit Tool</p>
            <p>${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
}

// Main execution
async function runAudit() {
    console.log('🚀 Starting Railway UI/UX Audit...');
    console.log(`📍 URL: ${CONFIG.url}`);
    console.log('=' .repeat(60));

    const browser = await chromium.launch({
        headless: false, // Set to false to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        await ensureDirectories();
        
        const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            viewport: CONFIG.viewports.desktop
        });

        const page = await context.newPage();
        page.setDefaultTimeout(CONFIG.timeout);

        // Set up monitoring
        await checkConsoleErrors(page);
        await monitorNetworkRequests(page);

        // Initial page load
        console.log('📄 Loading homepage...');
        await page.goto(CONFIG.url, { waitUntil: 'networkidle' });
        await takeScreenshot(page, 'initial-load');

        // Capture performance metrics
        const metrics = await capturePerformanceMetrics(page);
        console.log('📊 Performance Metrics:', metrics);

        // Run all tests
        await testLoginFunctionality(page);
        await testNavigation(page);
        await testCorePosFunctionality(page);
        await testFormValidation(page);
        
        // Check accessibility
        const accessibilityIssues = await checkAccessibility(page);
        console.log(`♿ Accessibility Issues: ${accessibilityIssues.length}`);

        // Check visual issues
        const visualIssues = await checkVisualIssues(page);
        console.log(`👁️ Visual Issues: ${visualIssues.length}`);

        // Test responsive design
        await testResponsiveDesign(page);

        // Generate and save report
        const report = await generateReport();

        // Print summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 AUDIT SUMMARY');
        console.log('=' .repeat(60));
        console.log(`✅ Passed Tests: ${report.summary.passed}`);
        console.log(`❌ Failed Tests: ${report.summary.failed}`);
        console.log(`📈 Pass Rate: ${report.summary.passRate}`);
        console.log(`🔴 Critical Issues: ${report.summary.criticalIssues}`);
        console.log(`⚠️ Warnings: ${report.summary.warnings}`);
        console.log(`🔍 Console Errors: ${report.summary.consoleErrors}`);
        console.log(`🌐 Network Failures: ${report.summary.networkFailures}`);
        console.log(`♿ Accessibility Issues: ${report.summary.accessibilityIssues}`);
        console.log(`👁️ Visual Issues: ${report.summary.visualIssues}`);
        console.log('=' .repeat(60));

        if (report.recommendations.length > 0) {
            console.log('\n📋 TOP RECOMMENDATIONS:');
            report.recommendations.slice(0, 3).forEach(rec => {
                console.log(`  [${rec.priority}] ${rec.category}: ${rec.description}`);
            });
        }

    } catch (error) {
        console.error('❌ Audit failed:', error);
        testResults.errors.push({
            test: 'Main Audit',
            error: error.message,
            stack: error.stack
        });
    } finally {
        await browser.close();
        console.log('\n✅ Audit complete! Check the reports directory for detailed results.');
    }
}

// Run the audit
if (require.main === module) {
    runAudit().catch(console.error);
}

module.exports = { runAudit };
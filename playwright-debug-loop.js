#!/usr/bin/env node

/**
 * PLAYWRIGHT MCP DEBUGGING LOOP
 * Purpose: Deep browser-based testing and debugging of deployment
 * Integration: Works with Truth Enforcer Supervisor
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class PlaywrightDebugLoop {
    constructor() {
        this.name = "Playwright Debug Loop";
        this.browser = null;
        this.page = null;
        this.testResults = [];
        this.screenshots = [];
        this.networkLogs = [];
        this.consoleMessages = [];
        
        console.log("🎭 PLAYWRIGHT DEBUG LOOP INITIATED");
        console.log("🔍 Mission: Deep browser-based deployment debugging");
    }

    async initialize() {
        console.log("\n🚀 Initializing Playwright browser...");
        
        this.browser = await chromium.launch({
            headless: true, // Set to false for visual debugging
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Set up logging
        this.page.on('console', msg => {
            this.consoleMessages.push({
                timestamp: new Date().toISOString(),
                type: msg.type(),
                text: msg.text()
            });
        });
        
        this.page.on('response', response => {
            this.networkLogs.push({
                timestamp: new Date().toISOString(),
                url: response.url(),
                status: response.status(),
                headers: response.headers()
            });
        });
        
        console.log("✅ Browser initialized successfully");
    }

    async debugDeployment(url) {
        console.log(`\n🔍 DEEP DEBUGGING: ${url}`);
        console.log("=" * 50);

        const debugSession = {
            url: url,
            timestamp: new Date().toISOString(),
            tests: [],
            issues: [],
            recommendations: []
        };

        try {
            // Test 1: Page Load Performance
            console.log("1. Testing page load performance...");
            const startTime = Date.now();
            const response = await this.page.goto(url, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            const loadTime = Date.now() - startTime;
            
            debugSession.tests.push({
                test: "page_load_performance",
                result: loadTime < 5000 ? "PASS" : "SLOW",
                loadTime: loadTime,
                status: response.status()
            });
            
            console.log(`   ⏱️ Page loaded in ${loadTime}ms (Status: ${response.status()})`);
            
            // Take screenshot
            const screenshotPath = `debug-screenshot-${Date.now()}.png`;
            await this.page.screenshot({ path: screenshotPath });
            this.screenshots.push(screenshotPath);
            console.log(`   📸 Screenshot saved: ${screenshotPath}`);

            // Test 2: POS System Elements
            console.log("2. Checking POS system elements...");
            const elements = await this.checkPOSElements();
            debugSession.tests.push({
                test: "pos_elements",
                result: elements.found > 0 ? "PASS" : "FAIL",
                elementsFound: elements.found,
                elementDetails: elements.details
            });
            
            console.log(`   🔍 Found ${elements.found} POS elements`);

            // Test 3: API Endpoint Testing
            console.log("3. Testing API endpoints via browser...");
            const apiTests = await this.testAPIEndpoints(url);
            debugSession.tests.push({
                test: "api_endpoints",
                result: apiTests.working > 0 ? "PASS" : "FAIL",
                workingEndpoints: apiTests.working,
                failedEndpoints: apiTests.failed,
                details: apiTests.details
            });
            
            console.log(`   🔗 API Status: ${apiTests.working} working, ${apiTests.failed} failed`);

            // Test 4: JavaScript Errors
            console.log("4. Checking for JavaScript errors...");
            const jsErrors = this.consoleMessages.filter(msg => msg.type === 'error');
            debugSession.tests.push({
                test: "javascript_errors",
                result: jsErrors.length === 0 ? "PASS" : "FAIL",
                errorCount: jsErrors.length,
                errors: jsErrors
            });
            
            if (jsErrors.length > 0) {
                console.log(`   ❌ Found ${jsErrors.length} JavaScript errors`);
                jsErrors.forEach(error => console.log(`      Error: ${error.text}`));
                debugSession.issues.push(`JavaScript errors detected: ${jsErrors.length}`);
            } else {
                console.log("   ✅ No JavaScript errors detected");
            }

            // Test 5: Network Issues
            console.log("5. Analyzing network requests...");
            const networkIssues = this.analyzeNetworkLogs();
            debugSession.tests.push({
                test: "network_analysis",
                result: networkIssues.length === 0 ? "PASS" : "WARN",
                issues: networkIssues
            });
            
            if (networkIssues.length > 0) {
                console.log(`   ⚠️ Found ${networkIssues.length} network issues`);
                networkIssues.forEach(issue => console.log(`      ${issue}`));
            } else {
                console.log("   ✅ No network issues detected");
            }

            // Test 6: Authentication Flow
            console.log("6. Testing authentication system...");
            const authTest = await this.testAuthenticationFlow(url);
            debugSession.tests.push({
                test: "authentication_flow",
                result: authTest.loginFormFound ? "PASS" : "FAIL",
                details: authTest
            });
            
            console.log(`   🔐 Auth Status: ${authTest.loginFormFound ? "Login form found" : "No login form"}`);

        } catch (error) {
            console.log(`   ❌ Debug session error: ${error.message}`);
            debugSession.issues.push(`Debug error: ${error.message}`);
        }

        // Generate recommendations
        debugSession.recommendations = this.generateDebugRecommendations(debugSession);
        
        this.testResults.push(debugSession);
        return debugSession;
    }

    async checkPOSElements() {
        const elements = {
            found: 0,
            details: []
        };

        const selectors = [
            'h1, h2, h3', // Headings
            'button', // Buttons
            'form', // Forms
            'input', // Input fields
            '.pos, #pos, [class*="pos"]', // POS-related classes
            '[class*="conejo"], [id*="conejo"]', // Conejo Negro specific
            'nav, .navbar', // Navigation
            '.login, #login, [class*="login"]' // Login elements
        ];

        for (const selector of selectors) {
            try {
                const count = await this.page.locator(selector).count();
                if (count > 0) {
                    elements.found += count;
                    elements.details.push(`${selector}: ${count} found`);
                }
            } catch (error) {
                // Ignore selector errors
            }
        }

        return elements;
    }

    async testAPIEndpoints(baseUrl) {
        const endpoints = ['/api/health', '/api/version', '/api/auth/login'];
        const results = {
            working: 0,
            failed: 0,
            details: []
        };

        for (const endpoint of endpoints) {
            try {
                const response = await this.page.evaluate(async (url) => {
                    const res = await fetch(url);
                    return {
                        status: res.status,
                        ok: res.ok
                    };
                }, `${baseUrl}${endpoint}`);

                if (response.ok) {
                    results.working++;
                    results.details.push(`${endpoint}: ✅ ${response.status}`);
                } else {
                    results.failed++;
                    results.details.push(`${endpoint}: ❌ ${response.status}`);
                }
            } catch (error) {
                results.failed++;
                results.details.push(`${endpoint}: ❌ ${error.message}`);
            }
        }

        return results;
    }

    analyzeNetworkLogs() {
        const issues = [];
        
        // Check for failed requests
        const failedRequests = this.networkLogs.filter(log => log.status >= 400);
        if (failedRequests.length > 0) {
            issues.push(`${failedRequests.length} failed HTTP requests`);
        }

        // Check for slow requests
        const now = Date.now();
        const recentLogs = this.networkLogs.filter(log => 
            now - new Date(log.timestamp).getTime() < 60000
        );
        
        if (recentLogs.length === 0) {
            issues.push("No recent network activity");
        }

        return issues;
    }

    async testAuthenticationFlow(baseUrl) {
        const authTest = {
            loginFormFound: false,
            loginButtonFound: false,
            inputFields: 0,
            canAttemptLogin: false
        };

        try {
            // Look for login elements
            const loginSelectors = [
                'form[action*="login"]',
                '.login-form',
                '#loginForm',
                'input[type="email"], input[name="email"]',
                'input[type="password"], input[name="password"]',
                'button[type="submit"]'
            ];

            for (const selector of loginSelectors) {
                const count = await this.page.locator(selector).count();
                if (count > 0) {
                    if (selector.includes('form')) {
                        authTest.loginFormFound = true;
                    }
                    if (selector.includes('input')) {
                        authTest.inputFields += count;
                    }
                    if (selector.includes('button')) {
                        authTest.loginButtonFound = true;
                    }
                }
            }

            authTest.canAttemptLogin = authTest.loginFormFound && 
                                     authTest.inputFields >= 2 && 
                                     authTest.loginButtonFound;

        } catch (error) {
            console.log(`Auth test error: ${error.message}`);
        }

        return authTest;
    }

    generateDebugRecommendations(session) {
        const recommendations = [];
        
        const failedTests = session.tests.filter(test => test.result === "FAIL");
        
        if (failedTests.length > 0) {
            recommendations.push("PRIORITY: Fix failed functionality tests");
        }

        if (session.issues.length > 0) {
            recommendations.push("ADDRESS: Resolve identified system issues");
        }

        const jsErrorTest = session.tests.find(test => test.test === "javascript_errors");
        if (jsErrorTest && jsErrorTest.errorCount > 0) {
            recommendations.push("CRITICAL: Fix JavaScript errors affecting functionality");
        }

        const authTest = session.tests.find(test => test.test === "authentication_flow");
        if (authTest && !authTest.details.canAttemptLogin) {
            recommendations.push("IMPORTANT: Fix authentication system accessibility");
        }

        if (recommendations.length === 0) {
            recommendations.push("System appears to be functioning correctly");
            recommendations.push("Consider performance optimizations");
        }

        return recommendations;
    }

    async generateDebugReport() {
        console.log("\n📊 GENERATING PLAYWRIGHT DEBUG REPORT");
        console.log("=" * 50);

        const report = {
            debugger: this.name,
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                screenshotsTaken: this.screenshots.length,
                networkRequests: this.networkLogs.length,
                consoleMessages: this.consoleMessages.length
            },
            results: this.testResults,
            networkLogs: this.networkLogs,
            consoleMessages: this.consoleMessages,
            screenshots: this.screenshots
        };

        const reportFile = `playwright-debug-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

        console.log(`\n📋 Debug Report Generated`);
        console.log(`📄 Report file: ${reportFile}`);
        console.log(`📸 Screenshots: ${this.screenshots.length}`);
        console.log(`🌐 Network logs: ${this.networkLogs.length}`);

        return report;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log("✅ Browser closed");
        }
    }
}

// Execute if run directly
if (require.main === module) {
    (async () => {
        const debugLoop = new PlaywrightDebugLoop();
        
        try {
            await debugLoop.initialize();
            
            const deploymentUrl = "https://pos-conejonegro-production-f389.up.railway.app";
            await debugLoop.debugDeployment(deploymentUrl);
            
            await debugLoop.generateDebugReport();
            
            console.log("\n🎯 PLAYWRIGHT DEBUG COMPLETE");
            console.log("🔍 Deep browser analysis finished");
            
        } catch (error) {
            console.error("❌ Debug loop error:", error.message);
        } finally {
            await debugLoop.cleanup();
        }
    })();
}

module.exports = PlaywrightDebugLoop;

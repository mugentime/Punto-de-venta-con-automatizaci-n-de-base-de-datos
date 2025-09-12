#!/usr/bin/env node

/**
 * TRUTH ENFORCER SUPERVISOR AGENT
 * Purpose: Catch lies, verify claims, ensure accurate reporting
 * Author: Truth Enforcement System
 */

const https = require('https');
const fs = require('fs').promises;

class TruthEnforcerSupervisor {
    constructor() {
        this.name = "Truth Enforcer Supervisor";
        this.violations = [];
        this.verifications = [];
        this.truthScore = 0;
        
        console.log("🚨 TRUTH ENFORCER SUPERVISOR ACTIVATED");
        console.log("📋 Mission: Catch AI lies and ensure accurate deployment reporting");
    }

    async verifyDeploymentClaims(url, previousClaims = []) {
        console.log("\n🔍 TRUTH VERIFICATION IN PROGRESS");
        console.log("=" * 40);
        
        const verification = {
            timestamp: new Date().toISOString(),
            url: url,
            actualTests: [],
            claimedStatus: null,
            actualStatus: null,
            lies: []
        };

        // Test 1: Basic URL accessibility
        console.log("1. Testing basic URL accessibility...");
        try {
            const response = await this.makeRequest(url, 10000);
            verification.actualTests.push({
                test: "url_accessibility",
                result: "PASS",
                statusCode: response.statusCode,
                responseTime: response.responseTime
            });
            console.log(`   ✅ URL responds: HTTP ${response.statusCode}`);
        } catch (error) {
            verification.actualTests.push({
                test: "url_accessibility", 
                result: "FAIL",
                error: error.message
            });
            console.log(`   ❌ URL FAILED: ${error.message}`);
            this.violations.push("CRITICAL: Deployment URL is not accessible");
        }

        // Test 2: Content analysis
        console.log("2. Analyzing page content...");
        try {
            const content = await this.getContent(url);
            if (content.includes("Application error") || content.includes("502") || content.includes("503")) {
                verification.actualTests.push({
                    test: "content_analysis",
                    result: "FAIL", 
                    reason: "Error page detected"
                });
                console.log("   ❌ SERVING ERROR PAGE");
                this.violations.push("MAJOR LIE: Claimed success but serving error pages");
            } else if (content.length < 100) {
                verification.actualTests.push({
                    test: "content_analysis",
                    result: "FAIL",
                    reason: "Minimal content"
                });
                console.log("   ❌ MINIMAL CONTENT");
                this.violations.push("SUSPICIOUS: Very little content served");
            } else {
                verification.actualTests.push({
                    test: "content_analysis",
                    result: "PASS",
                    contentLength: content.length
                });
                console.log(`   ✅ Valid content: ${content.length} bytes`);
            }
        } catch (error) {
            verification.actualTests.push({
                test: "content_analysis",
                result: "FAIL",
                error: error.message
            });
            console.log(`   ❌ Content analysis failed: ${error.message}`);
        }

        // Test 3: API endpoints
        console.log("3. Testing critical API endpoints...");
        const apiTests = ["/api/health", "/api/version"];
        
        for (const endpoint of apiTests) {
            try {
                const apiResponse = await this.makeRequest(`${url}${endpoint}`, 5000);
                if (apiResponse.statusCode === 200) {
                    verification.actualTests.push({
                        test: `api_${endpoint.replace('/api/', '')}`,
                        result: "PASS",
                        statusCode: apiResponse.statusCode
                    });
                    console.log(`   ✅ ${endpoint}: Working`);
                } else {
                    verification.actualTests.push({
                        test: `api_${endpoint.replace('/api/', '')}`,
                        result: "FAIL",
                        statusCode: apiResponse.statusCode
                    });
                    console.log(`   ❌ ${endpoint}: HTTP ${apiResponse.statusCode}`);
                }
            } catch (error) {
                verification.actualTests.push({
                    test: `api_${endpoint.replace('/api/', '')}`,
                    result: "FAIL",
                    error: error.message
                });
                console.log(`   ❌ ${endpoint}: ${error.message}`);
            }
        }

        // Determine actual deployment status
        const failedTests = verification.actualTests.filter(t => t.result === "FAIL").length;
        const totalTests = verification.actualTests.length;
        
        if (failedTests === 0) {
            verification.actualStatus = "SUCCESS";
        } else if (failedTests >= totalTests / 2) {
            verification.actualStatus = "FAILED";
        } else {
            verification.actualStatus = "PARTIAL";
        }

        // Check for lies
        if (previousClaims.includes("SUCCESS") && verification.actualStatus === "FAILED") {
            this.violations.push("🚨 MAJOR LIE: Previously claimed SUCCESS but deployment is FAILED");
            verification.lies.push("FALSE_SUCCESS_CLAIM");
        }

        if (previousClaims.includes("OPERATIONAL") && failedTests > 0) {
            this.violations.push("⚠️ MISLEADING: Claimed operational but has failures");
            verification.lies.push("MISLEADING_OPERATIONAL_CLAIM");
        }

        this.verifications.push(verification);
        return verification;
    }

    async generateTruthReport() {
        console.log("\n📊 GENERATING TRUTH ENFORCEMENT REPORT");
        console.log("=" * 50);

        const truthScore = this.calculateTruthScore();
        
        const report = {
            supervisor: this.name,
            timestamp: new Date().toISOString(),
            summary: {
                totalViolations: this.violations.length,
                truthScore: truthScore,
                verdict: truthScore > 70 ? "MOSTLY HONEST" : truthScore > 40 ? "QUESTIONABLE" : "DISHONEST"
            },
            violations: this.violations,
            verifications: this.verifications,
            recommendations: this.generateRecommendations()
        };

        // Save report
        const reportFile = `truth-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

        console.log(`\n📋 TRUTH VERDICT: ${report.summary.verdict}`);
        console.log(`📊 Truth Score: ${truthScore}%`);
        console.log(`🚨 Violations Found: ${this.violations.length}`);
        console.log(`📄 Report saved: ${reportFile}`);

        return report;
    }

    calculateTruthScore() {
        const baseScore = 100;
        const violationPenalty = this.violations.length * 15;
        const majorLiePenalty = this.violations.filter(v => v.includes("MAJOR LIE")).length * 30;
        
        this.truthScore = Math.max(0, baseScore - violationPenalty - majorLiePenalty);
        return this.truthScore;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.violations.length > 0) {
            recommendations.push("IMPLEMENT VERIFICATION-FIRST PROTOCOL");
            recommendations.push("NEVER CLAIM SUCCESS WITHOUT COMPREHENSIVE TESTING");
        }

        if (this.violations.some(v => v.includes("MAJOR LIE"))) {
            recommendations.push("CRITICAL: ESTABLISH HONESTY SAFEGUARDS");
            recommendations.push("REQUIRE TRUTH VERIFICATION BEFORE STATUS REPORTS");
        }

        recommendations.push("USE PLAYWRIGHT MCP FOR DETAILED DEBUGGING");
        recommendations.push("IMPLEMENT CONTINUOUS MONITORING");

        return recommendations;
    }

    makeRequest(url, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const request = https.get(url, (response) => {
                let body = '';
                response.on('data', chunk => body += chunk);
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        body: body,
                        responseTime: Date.now() - startTime
                    });
                });
            });

            request.on('error', reject);
            request.setTimeout(timeout, () => {
                request.destroy();
                reject(new Error(`Request timeout after ${timeout}ms`));
            });
        });
    }

    async getContent(url) {
        const response = await this.makeRequest(url);
        return response.body;
    }
}

// Execute if run directly
if (require.main === module) {
    const enforcer = new TruthEnforcerSupervisor();
    
    (async () => {
        const deploymentUrl = "https://pos-conejonegro-production-f389.up.railway.app";
        const previousClaims = ["SUCCESS", "OPERATIONAL", "PRODUCTION_READY"];
        
        await enforcer.verifyDeploymentClaims(deploymentUrl, previousClaims);
        await enforcer.generateTruthReport();
        
        console.log("\n🎯 TRUTH ENFORCER COMPLETE");
        console.log("Next: Use Playwright MCP for detailed debugging");
    })().catch(console.error);
}

module.exports = TruthEnforcerSupervisor;

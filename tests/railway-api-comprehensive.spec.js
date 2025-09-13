const { test, expect } = require('@playwright/test');

test.describe('Railway API Comprehensive Test Suite', () => {
  const BASE_URL = 'https://pos-conejo-negro.railway.app';
  
  test('Railway API discovery and endpoint testing', async ({ page, request }) => {
    console.log('🔍 Starting comprehensive Railway API analysis...');
    
    // Test 1: Basic API accessibility
    const response = await request.get(BASE_URL);
    const status = response.status();
    const headers = response.headers();
    const body = await response.text();
    
    console.log(`✅ API Response Status: ${status}`);
    console.log(`📋 Content-Type: ${headers['content-type'] || 'not specified'}`);
    console.log(`📄 Response Body Length: ${body.length} characters`);
    
    expect(status).toBeLessThan(400);
    
    // Test 2: Check common POS API endpoints
    const commonEndpoints = [
      '/',
      '/health',
      '/api',
      '/api/v1',
      '/api/health',
      '/status',
      '/api/products',
      '/api/orders',
      '/api/categories',
      '/api/users',
      '/api/auth',
      '/api/auth/login',
      '/api/transactions',
      '/api/inventory',
      '/products',
      '/orders',
      '/menu',
      '/categories'
    ];
    
    const endpointResults = [];
    
    for (const endpoint of commonEndpoints) {
      try {
        const endpointResponse = await request.get(`${BASE_URL}${endpoint}`, {
          ignoreHTTPSErrors: true,
          timeout: 10000
        });
        
        const result = {
          endpoint,
          status: endpointResponse.status(),
          contentType: endpointResponse.headers()['content-type'] || 'unknown',
          responseSize: (await endpointResponse.text()).length
        };
        
        endpointResults.push(result);
        
        if (result.status < 400) {
          console.log(`✅ ${endpoint}: ${result.status} (${result.contentType})`);
        } else {
          console.log(`❌ ${endpoint}: ${result.status}`);
        }
        
      } catch (error) {
        console.log(`⚠️ ${endpoint}: Error - ${error.message}`);
        endpointResults.push({
          endpoint,
          status: 'ERROR',
          error: error.message
        });
      }
    }
    
    // Test 3: Check for API documentation endpoints
    const docEndpoints = ['/docs', '/api-docs', '/swagger', '/openapi', '/documentation'];
    
    for (const docEndpoint of docEndpoints) {
      try {
        const docResponse = await request.get(`${BASE_URL}${docEndpoint}`);
        if (docResponse.status() < 400) {
          console.log(`📚 Documentation found at: ${docEndpoint}`);
        }
      } catch (error) {
        // Ignore doc endpoint errors
      }
    }
    
    // Test 4: Test with different HTTP methods
    const methodTests = [
      { method: 'GET', endpoint: '/' },
      { method: 'POST', endpoint: '/api/test' },
      { method: 'PUT', endpoint: '/api/test' },
      { method: 'DELETE', endpoint: '/api/test' },
      { method: 'OPTIONS', endpoint: '/' }
    ];
    
    for (const { method, endpoint } of methodTests) {
      try {
        let methodResponse;
        switch (method) {
          case 'GET':
            methodResponse = await request.get(`${BASE_URL}${endpoint}`);
            break;
          case 'POST':
            methodResponse = await request.post(`${BASE_URL}${endpoint}`, {
              data: { test: true }
            });
            break;
          case 'PUT':
            methodResponse = await request.put(`${BASE_URL}${endpoint}`, {
              data: { test: true }
            });
            break;
          case 'DELETE':
            methodResponse = await request.delete(`${BASE_URL}${endpoint}`);
            break;
          case 'OPTIONS':
            methodResponse = await request.fetch(`${BASE_URL}${endpoint}`, {
              method: 'OPTIONS'
            });
            break;
        }
        
        console.log(`🔧 ${method} ${endpoint}: ${methodResponse.status()}`);
        
      } catch (error) {
        console.log(`⚠️ ${method} ${endpoint}: ${error.message}`);
      }
    }
    
    // Test 5: Check for CORS headers
    const corsResponse = await request.fetch(BASE_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeaders = corsResponse.headers();
    const hasCors = corsHeaders['access-control-allow-origin'] !== undefined;
    
    console.log(`🌐 CORS Support: ${hasCors ? 'Yes' : 'No'}`);
    if (hasCors) {
      console.log(`🔓 CORS Origin: ${corsHeaders['access-control-allow-origin']}`);
    }
    
    // Test 6: Performance analysis
    const performanceStartTime = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await request.get(BASE_URL);
    }
    
    const averageResponseTime = (Date.now() - performanceStartTime) / 5;
    console.log(`⚡ Average Response Time: ${averageResponseTime}ms`);
    
    expect(averageResponseTime).toBeLessThan(3000); // Should respond within 3 seconds
    
    // Test 7: Load testing (light)
    const concurrentRequests = [];
    const loadTestStart = Date.now();
    
    for (let i = 0; i < 10; i++) {
      concurrentRequests.push(request.get(BASE_URL));
    }
    
    const loadTestResults = await Promise.all(concurrentRequests);
    const loadTestTime = Date.now() - loadTestStart;
    
    console.log(`📊 Load Test: 10 concurrent requests in ${loadTestTime}ms`);
    
    const successfulRequests = loadTestResults.filter(r => r.status() < 400).length;
    console.log(`✅ Successful requests: ${successfulRequests}/10`);
    
    expect(successfulRequests).toBeGreaterThanOrEqual(8); // At least 80% success rate
    
    // Take a screenshot of the main page for visual verification
    await page.goto(BASE_URL);
    await page.screenshot({ 
      path: 'tests/test-results/railway-api-main-page.png',
      fullPage: true 
    });
    
    // Test 8: Check for security headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy'
    ];
    
    const foundSecurityHeaders = [];
    securityHeaders.forEach(header => {
      if (headers[header]) {
        foundSecurityHeaders.push(header);
        console.log(`🔒 Security Header: ${header} = ${headers[header]}`);
      }
    });
    
    console.log(`🛡️ Security Headers Found: ${foundSecurityHeaders.length}/${securityHeaders.length}`);
    
    // Test 9: Content analysis
    const mainPageContent = await page.textContent('body');
    const hasAPIContent = mainPageContent.toLowerCase().includes('api');
    const hasRailwayContent = mainPageContent.toLowerCase().includes('railway');
    
    console.log(`📝 Page mentions API: ${hasAPIContent}`);
    console.log(`🚂 Page mentions Railway: ${hasRailwayContent}`);
    
    // Test 10: Generate comprehensive report
    const testReport = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      apiStatus: status,
      workingEndpoints: endpointResults.filter(r => r.status < 400).length,
      totalEndpointsTested: endpointResults.length,
      averageResponseTime: `${averageResponseTime}ms`,
      loadTestResults: {
        totalRequests: 10,
        successfulRequests: successfulRequests,
        totalTime: `${loadTestTime}ms`
      },
      securityHeaders: foundSecurityHeaders,
      corsSupport: hasCors,
      detailedEndpoints: endpointResults
    };
    
    console.log('\n📊 COMPREHENSIVE TEST REPORT:');
    console.log('================================');
    console.log(`🌐 Base URL: ${testReport.baseUrl}`);
    console.log(`✅ API Status: ${testReport.apiStatus}`);
    console.log(`🎯 Working Endpoints: ${testReport.workingEndpoints}/${testReport.totalEndpointsTested}`);
    console.log(`⚡ Avg Response Time: ${testReport.averageResponseTime}`);
    console.log(`📊 Load Test Success: ${testReport.loadTestResults.successfulRequests}/10`);
    console.log(`🔒 Security Headers: ${testReport.securityHeaders.length}`);
    console.log(`🌐 CORS Support: ${testReport.corsSupport}`);
    
    // Save detailed report
    await page.evaluate((report) => {
      window.testReport = report;
      console.log('=== DETAILED API TEST REPORT ===');
      console.log(JSON.stringify(report, null, 2));
    }, testReport);
    
    console.log('✅ Comprehensive Railway API testing completed!');
  });
  
  test('API endpoint specific functionality tests', async ({ request }) => {
    console.log('🧪 Testing specific API functionality...');
    
    // Test health endpoint if it exists
    try {
      const healthResponse = await request.get(`${BASE_URL}/health`);
      if (healthResponse.status() === 200) {
        const healthData = await healthResponse.text();
        console.log(`💚 Health check passed: ${healthData.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log('⚠️ No health endpoint found');
    }
    
    // Test API versioning
    const versionEndpoints = ['/api/v1', '/v1', '/api/version'];
    
    for (const versionEndpoint of versionEndpoints) {
      try {
        const versionResponse = await request.get(`${BASE_URL}${versionEndpoint}`);
        if (versionResponse.status() < 400) {
          console.log(`📱 Version endpoint found: ${versionEndpoint}`);
        }
      } catch (error) {
        // Ignore version endpoint errors
      }
    }
    
    // Test content types
    const acceptHeaders = [
      'application/json',
      'application/xml',
      'text/html',
      'text/plain'
    ];
    
    for (const accept of acceptHeaders) {
      try {
        const contentResponse = await request.get(BASE_URL, {
          headers: { 'Accept': accept }
        });
        
        const responseContentType = contentResponse.headers()['content-type'] || '';
        console.log(`📋 Accept: ${accept} → ${responseContentType}`);
        
      } catch (error) {
        console.log(`⚠️ Content type test failed for ${accept}`);
      }
    }
  });
});
// Global teardown for Playwright tests
const fs = require('fs');
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');
  
  try {
    // Ensure test results directory exists
    const resultsDir = path.join(__dirname, 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a test summary if results.json exists
    const resultsFile = path.join(resultsDir, 'results.json');
    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      const summary = {
        timestamp: new Date().toISOString(),
        total: results.suites?.reduce((acc, suite) => acc + suite.specs?.length || 0, 0) || 0,
        passed: results.suites?.reduce((acc, suite) => 
          acc + (suite.specs?.filter(spec => spec.tests?.some(test => test.status === 'passed'))?.length || 0), 0) || 0,
        failed: results.suites?.reduce((acc, suite) => 
          acc + (suite.specs?.filter(spec => spec.tests?.some(test => test.status === 'failed'))?.length || 0), 0) || 0,
        duration: results.stats?.duration || 0
      };
      
      fs.writeFileSync(
        path.join(resultsDir, 'test-summary.json'),
        JSON.stringify(summary, null, 2)
      );
    }
    
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error.message);
  }
}

module.exports = globalTeardown;
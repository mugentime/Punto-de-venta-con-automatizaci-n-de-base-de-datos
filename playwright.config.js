// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Global setup and teardown
    // globalSetup: require.resolve('./tests/setup/global-setup.js'),
    // globalTeardown: require.resolve('./tests/setup/global-teardown.js'),
  
  // Run tests in files in parallel
  fullyParallel: false, // Disable for database tests
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: './tests/reports/html-report' }],
    ['json', { outputFile: './tests/reports/results.json' }],
    ['list'],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot settings
    screenshot: 'only-on-failure',
    
    // Video settings
    video: 'retain-on-failure',
    
    // Browser settings
    headless: process.env.CI ? true : false,
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Global timeout
    actionTimeout: 30000,
    navigationTimeout: 30000,
    
    // Custom viewport
    viewport: { width: 1280, height: 720 },
    
    // Locale
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
    }
  },

  // Configure projects for major browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: { 
        ...devices['Desktop Chrome'],
        storageState: undefined // Don't use auth state for setup
      },
    },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome' // Use Google Chrome instead of Chromium
      },
      dependencies: ['setup'],
    }
  ],

  // Configure test timeouts
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 15000, // 15 seconds for assertions
  },

  // Web server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm start',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PORT: '3000'
    }
  },

  // Test results directory
  outputDir: './tests/results/',
  
  // Test metadata
  metadata: {
    'Test Suite': 'POS Conejo Negro E2E Tests',
    'Environment': process.env.NODE_ENV || 'development',
    'Base URL': process.env.BASE_URL || 'http://localhost:3000',
    'Timestamp': new Date().toISOString()
  }
});

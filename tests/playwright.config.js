// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: '.',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'tests/test-results/html-report' }],
    ['json', { outputFile: 'tests/test-results/results.json' }],
    ['junit', { outputFile: 'tests/test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'https://pos-conejo-negro.railway.app',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    /* Global timeout for each action */
    actionTimeout: 30000,
    navigationTimeout: 30000
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    }
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./global-setup.js'),
  globalTeardown: require.resolve('./global-teardown.js'),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'curl -f https://pos-conejo-negro.railway.app/health || echo "Server check"',
    timeout: 30000,
    reuseExistingServer: true,
  },

  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000 // 10 seconds for assertions
  }
});
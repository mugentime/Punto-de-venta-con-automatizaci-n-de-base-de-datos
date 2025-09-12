const path = require('path');

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Roots for test discovery
  roots: [
    '<rootDir>/tests',
    '<rootDir>/src'
  ],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/__tests__/**/*.(js|ts)',
    '<rootDir>/tests/**/*.(test|spec).(js|ts)',
    '<rootDir>/src/**/__tests__/**/*.(js|ts)',
    '<rootDir>/src/**/*.(test|spec).(js|ts)'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/config/jest.setup.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/__tests__/**/*',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.spec.{js,ts}',
    '!**/node_modules/**'
  ],

  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/repositories/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest'
  },

  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Test timeout
  testTimeout: 10000,

  // Clear mocks automatically
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Fail fast - stop on first failure
  bail: false,

  // Maximum worker processes
  maxWorkers: '50%',

  // Error handling
  errorOnDeprecated: true,

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/config/global-setup.js',
  globalTeardown: '<rootDir>/tests/config/global-teardown.js',

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json',
    'ts',
    'node'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/logs/'
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
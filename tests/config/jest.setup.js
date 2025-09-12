// Jest setup file for POS Conejo Negro tests
const path = require('path');

// Load test environment variables
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../.env.test') 
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/pos_test';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Setup global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  mockUser: {
    id: 1,
    email: 'test@conejonegro.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'admin'
  },
  
  mockProduct: {
    id: 1,
    name: 'Test Product',
    price: 10.00,
    category: 'cafeteria',
    stock: 100,
    active: true
  },
  
  mockRecord: {
    id: 1,
    products: [{ id: 1, name: 'Test Product', price: 10.00, quantity: 2 }],
    total: 20.00,
    clientType: 'general',
    serviceType: 'salon',
    timestamp: new Date()
  }
};

// Setup and teardown hooks
beforeAll(async () => {
  // Database setup for tests
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Cleaning up test environment...');
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});
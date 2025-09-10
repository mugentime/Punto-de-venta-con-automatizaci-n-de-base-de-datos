/**
 * Production debugging script for POS-CONEJONEGRO
 * Tests admin user creation and authentication logic
 */

const express = require('express');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// Debug endpoint to test admin creation and login flow
app.get('/debug-auth', async (req, res) => {
  try {
    const debug = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        databaseUrl: !!process.env.DATABASE_URL,
        railwayEnv: !!process.env.RAILWAY_ENVIRONMENT
      },
      tests: []
    };

    // Test 1: Password hashing
    debug.tests.push({ test: 'password_hashing', status: 'testing' });
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    const isValidHash = await bcrypt.compare(testPassword, hashedPassword);
    debug.tests[debug.tests.length - 1] = {
      test: 'password_hashing',
      status: isValidHash ? 'pass' : 'fail',
      details: {
        originalPassword: testPassword,
        hashedPreview: hashedPassword.substring(0, 20) + '...',
        isValidHash
      }
    };

    // Test 2: Database Manager initialization
    debug.tests.push({ test: 'database_manager', status: 'testing' });
    try {
      const databaseManager = require('./utils/databaseManager');
      await databaseManager.initialize();
      debug.tests[debug.tests.length - 1] = {
        test: 'database_manager',
        status: 'pass',
        details: {
          usePostgreSQL: databaseManager.usePostgreSQL,
          initialized: databaseManager.initialized
        }
      };

      // Test 3: Get existing users
      debug.tests.push({ test: 'get_users', status: 'testing' });
      const users = await databaseManager.getUsers();
      debug.tests[debug.tests.length - 1] = {
        test: 'get_users',
        status: 'pass',
        details: {
          userCount: users.length,
          userEmails: users.map(u => u.email || u.username).filter(Boolean)
        }
      };

      // Test 4: Check for admin user
      debug.tests.push({ test: 'check_admin', status: 'testing' });
      const adminUser = await databaseManager.getUserByEmail('admin@conejonegro.com');
      debug.tests[debug.tests.length - 1] = {
        test: 'check_admin',
        status: adminUser ? 'found' : 'not_found',
        details: {
          adminExists: !!adminUser,
          adminEmail: adminUser ? adminUser.email : null,
          adminRole: adminUser ? adminUser.role : null,
          passwordHashPreview: adminUser ? adminUser.password.substring(0, 20) + '...' : null
        }
      };

      // Test 5: Test password validation if admin exists
      if (adminUser) {
        debug.tests.push({ test: 'validate_password', status: 'testing' });
        const isPasswordValid = await bcrypt.compare('admin123', adminUser.password);
        debug.tests[debug.tests.length - 1] = {
          test: 'validate_password',
          status: isPasswordValid ? 'valid' : 'invalid',
          details: {
            passwordValid: isPasswordValid
          }
        };
      }

    } catch (error) {
      debug.tests[debug.tests.length - 1] = {
        test: 'database_manager',
        status: 'error',
        error: error.message
      };
    }

    res.json(debug);

  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    });
  }
});

// Add this to server.js or use as a standalone endpoint
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🔍 Debug server running on port ${PORT}`);
    console.log(`🌐 Visit http://localhost:${PORT}/debug-auth to test`);
  });
}

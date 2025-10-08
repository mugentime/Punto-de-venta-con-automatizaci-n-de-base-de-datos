# Test Suite Documentation

## Overview

This directory contains comprehensive Playwright tests to reproduce and validate bug fixes for the Conejo Negro POS system. These tests are designed to **FAIL initially** to demonstrate the bugs, then pass once the bugs are fixed.

## Test Files

### 1. `registration.spec.ts` - User Registration Bug Tests

**Bug Description**: User registration function only updates local React state but never persists to database via POST /api/users endpoint.

**Test Coverage**:
- ✓ Verify POST /api/users API call is made during registration (FAILS - no API call)
- ✓ Verify user persists to database (FAILS - user not in DB)
- ✓ Verify user appears in admin panel (FAILS - user not visible)
- ✓ Verify user has 'pending' status in admin
- ✓ Verify user data persists after page refresh (FAILS - user lost)

**Root Cause**: `AppContext.tsx` lines 205-222 only call `setUsers()` for local state update.

**Fix Required**: Add POST request to `/api/users` endpoint before updating local state.

---

### 2. `coworking-sessions.spec.ts` - Cross-Device Session Closure Bug Tests

**Bug Description**: Users cannot close coworking sessions from different devices due to state synchronization issues.

**Test Coverage**:
- ✓ Cross-device session closure (two browser contexts)
- ✓ Real-time session data sync between devices
- ✓ Concurrent session updates (race condition testing)

**Verifies**:
- Session visibility across devices
- PUT /api/coworking-sessions API calls
- Database status updates to 'finished'
- endTime and total calculations
- State synchronization after refresh

**Fix Required**: Implement proper database-driven state management and real-time sync.

---

### 3. `cash-registry.spec.ts` - Missing Cash Registry Table Tests

**Bug Description**: No `cash_registry` or `cash_drawer` table exists. Only `cash_sessions` table available, which lacks daily aggregation capabilities.

**Test Coverage**:
- ✓ Verify cash_registry table exists (FAILS - table missing)
- ✓ Verify cash_drawer table as alternative (FAILS - table missing)
- ✓ Check for any daily cash tracking table (FAILS - none exist)
- ✓ Verify cash_registry schema has required columns
- ✓ Create daily cash registry entry via UI
- ✓ Support multiple cash sessions per day
- ✓ Aggregate totals across sessions

**Fix Required**: Create `cash_registry` table with proper schema for daily cash tracking.

---

## Prerequisites

### Required Environment Variables

```bash
# PostgreSQL database connection string
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: Base URL for testing (defaults to http://localhost:3001)
BASE_URL=http://localhost:3001
```

### Install Dependencies

```bash
npm install
npx playwright install chromium
```

---

## Running Tests

### Run All Tests

```bash
npx playwright test
```

### Run Specific Test Suite

```bash
# Registration tests only
npx playwright test registration.spec.ts

# Coworking session tests only
npx playwright test coworking-sessions.spec.ts

# Cash registry tests only
npx playwright test cash-registry.spec.ts
```

### Run Tests in UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

### Run Tests in Headed Mode (See Browser)

```bash
npx playwright test --headed
```

### Run Specific Test

```bash
npx playwright test registration.spec.ts -g "should persist user to database"
```

---

## Viewing Test Results

### HTML Report

After test execution, view the detailed HTML report:

```bash
npx playwright show-report
```

### Screenshots and Videos

Failed tests automatically capture:
- **Screenshots**: `test-results/*/screenshot.png`
- **Videos**: `test-results/*/video.webm`
- **Traces**: `test-results/*/trace.zip`

To view traces:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

---

## Expected Test Results

### Before Bug Fixes (Current State)

```
Registration Tests: 5 failed
  ✗ should persist user to database after registration
  ✗ should show user in admin panel after registration
  ✗ should not lose user data on page refresh

Coworking Session Tests: 3 tests (varies)
  ✗ should close coworking session from different browser context
  ✓ should sync session data between devices
  ✓ should handle concurrent session updates

Cash Registry Tests: 7 failed
  ✗ should have cash_registry table in database
  ✗ should have cash_drawer table as alternative
  ✗ should have daily_cash_register table
  ✗ should create daily cash registry entry via UI
```

### After Bug Fixes (Target State)

```
Registration Tests: 5 passed ✓
Coworking Session Tests: 3 passed ✓
Cash Registry Tests: 7 passed ✓
```

---

## Bug Fix Checklist

### 1. Registration Bug Fix

- [ ] Modify `AppContext.tsx` registration function
- [ ] Add POST request to `/api/users`
- [ ] Handle success/error responses
- [ ] Update local state after successful API call
- [ ] Add loading state during registration
- [ ] Add error handling and user feedback

**Example Fix**:
```typescript
// AppContext.tsx
const handleRegister = async (username: string, email: string, password: string) => {
  try {
    setLoading(true);

    // POST to API endpoint
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    if (!response.ok) throw new Error('Registration failed');

    const newUser = await response.json();

    // Update local state after successful API call
    setUsers(prev => [...prev, newUser]);

    // Notify admin (if implemented)
    await notifyAdmin(newUser);

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  } finally {
    setLoading(false);
  }
};
```

### 2. Coworking Session Bug Fix

- [ ] Review session update logic
- [ ] Ensure PUT requests to `/api/coworking-sessions/:id`
- [ ] Add database transaction for session closure
- [ ] Implement WebSocket or polling for real-time updates
- [ ] Add optimistic UI updates with rollback
- [ ] Test concurrent access scenarios

### 3. Cash Registry Table Fix

- [ ] Create migration script for `cash_registry` table
- [ ] Define schema with required columns:
  - `id` VARCHAR PRIMARY KEY
  - `date` DATE NOT NULL
  - `opening_balance` NUMERIC
  - `closing_balance` NUMERIC
  - `expected_cash` NUMERIC
  - `actual_cash` NUMERIC
  - `difference` NUMERIC
  - `status` VARCHAR ('open', 'closed')
  - `userId` VARCHAR
  - `created_at` TIMESTAMP
- [ ] Update UI to support daily registry
- [ ] Implement aggregation logic across sessions
- [ ] Add migration to associate cash_sessions with registry

---

## Test Maintenance

### Adding New Tests

1. Create new test file in `/tests` directory
2. Import necessary modules: `@playwright/test`, `pg`
3. Follow existing test structure
4. Document bug description in comments
5. Update this README

### Updating Tests After Fixes

1. Remove "EXPECTED TO FAIL" comments
2. Adjust assertions if needed
3. Add regression tests for edge cases
4. Update expected results section

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Troubleshooting

### Database Connection Issues

If tests fail to connect to database:

```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test direct connection
psql $DATABASE_URL

# Check if server is running
curl http://localhost:3001/api/products
```

### Server Not Starting

```bash
# Manually start server
npm run start

# Check if port 3001 is in use
netstat -an | grep 3001

# Kill existing process
kill -9 $(lsof -t -i:3001)
```

### Playwright Browser Issues

```bash
# Reinstall browsers
npx playwright install --force chromium

# Clear cache
rm -rf ~/.cache/ms-playwright
npx playwright install chromium
```

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Memory Keeper Context](mcp://memory-keeper/context?sessionId=app-rescue-conejo-negro-pos-2025-01-07)

---

## Contact

For questions or issues with these tests, please refer to:
- Bug reports in Memory Keeper (channel: "bugs")
- Test results in Memory Keeper (channel: "test-results")

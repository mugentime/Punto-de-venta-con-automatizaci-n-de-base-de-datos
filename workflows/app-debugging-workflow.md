# App Debugging and Deployment Workflow

## Overview
This workflow documents the systematic approach to debug and fix a failing web application, specifically targeting infinite loop issues and deployment problems.

## Problem Statement
- Application not working after deployment
- Need to identify root cause and implement fixes
- Must test and verify solutions
- Should streamline the debugging process

## Workflow Steps

### Phase 1: Initial Assessment and Problem Identification

#### 1.1 Explore Codebase Structure
```bash
# Commands to run:
ls -la
find . -name "package.json"
find . -name "*.log"
```

**Objectives:**
- Identify application type (React, Node.js, etc.)
- Locate configuration files
- Check for existing logs

#### 1.2 Check Deployment Status
```bash
# Railway-specific commands:
railway status
railway logs
railway domain
```

**Look for:**
- Deployment errors
- Runtime errors
- Performance issues
- Unusual request patterns

#### 1.3 Analyze Application Logs
**Red flags to identify:**
- Repeated API requests (infinite loops)
- Error patterns
- Performance bottlenecks
- Authentication failures

### Phase 2: Root Cause Analysis

#### 2.1 Examine Frontend Code
```bash
# Search patterns:
grep -r "useEffect" --include="*.tsx" --include="*.ts"
grep -r "fetch\|api" --include="*.tsx" --include="*.ts"
```

**Focus areas:**
- React useEffect dependency arrays
- API call patterns
- State management
- Authentication flows

#### 2.2 Analyze Server-Side Code
```bash
# Key files to check:
cat server.js
grep -r "app.get\|app.post" server.js
```

**Look for:**
- API endpoint definitions
- Middleware configuration
- Database connections
- Error handling

#### 2.3 Identify Infinite Loop Patterns
**Common causes:**
- useEffect with problematic dependencies
- State setters in dependency arrays
- Recursive API calls
- Authentication retry loops

### Phase 3: Fix Implementation

#### 3.1 Fix Frontend Issues
**Example fix for useEffect infinite loop:**
```javascript
// BEFORE (problematic):
useEffect(() => {
    // code
}, [currentUser, token, apiFetch, setCurrentUser, setToken]);

// AFTER (fixed):
useEffect(() => {
    // code
}, [currentUser, token]);
```

#### 3.2 Configure Environment Variables
```bash
# Create/update .env file:
API_KEY="your-api-key"
DATABASE_URL="your-database-url"
NODE_ENV="production"
PORT=3001
```

#### 3.3 Fix Frontend HTML Configuration
**For CDN-based apps:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <script src="https://cdn.tailwindcss.com" data-vite-ignore></script>
    <script type="importmap">
    {
        "imports": {
            "react": "https://aistudiocdn.com/react@^19.1.1",
            // ... other imports
        }
    }
    </script>
</head>
<body>
    <div id="root"></div>
</body>
</html>
```

### Phase 4: Build and Deploy

#### 4.1 Build Application
```bash
npm run build
```

**Verify:**
- Build succeeds without errors
- Output files are generated correctly
- Dependencies are resolved

#### 4.2 Deploy to Platform
```bash
# Railway deployment:
railway up

# Or use platform-specific deployment commands
```

#### 4.3 Verify Deployment
```bash
# Test deployment:
curl -I https://your-app-url.railway.app
```

### Phase 5: Testing and Validation

#### 5.1 Create Automated Tests
```javascript
// Example deployment test:
async function testDeployment() {
    const response = await fetch(DEPLOYMENT_URL);
    console.log('Status:', response.status);

    const apiResponse = await fetch(`${DEPLOYMENT_URL}/api/endpoint`);
    console.log('API Status:', apiResponse.status);
}
```

#### 5.2 Manual Testing Checklist
- [ ] App loads without errors
- [ ] No infinite API requests
- [ ] Authentication works
- [ ] Navigation functions properly
- [ ] UI renders correctly
- [ ] No console errors

#### 5.3 Performance Validation
**Check for:**
- Normal request frequency
- Appropriate response times
- Proper error handling
- Resource usage

### Phase 6: Documentation and Prevention

#### 6.1 Document Fixes
**Create documentation including:**
- Root cause analysis
- Solution implemented
- Prevention guidelines
- Testing results

#### 6.2 Implement Prevention Measures
**Best practices:**
- useEffect dependency guidelines
- Code review checklists
- Automated testing
- Monitoring setup

## Common Issues and Solutions

### Issue: React useEffect Infinite Loop
**Symptoms:**
- Hundreds of API requests per second
- Application freezing
- Server overload

**Solution:**
```javascript
// Remove state setters and recreated functions from dependencies
useEffect(() => {
    // effect code
}, [primitiveValues, stableReferences]); // Only include necessary deps
```

### Issue: CDN Dependencies Not Loading
**Symptoms:**
- Styling not applied
- JavaScript errors
- Blank pages

**Solution:**
- Add `data-vite-ignore` to CDN scripts
- Verify import maps are correct
- Check network requests in browser dev tools

### Issue: Environment Variables Not Working
**Symptoms:**
- Database connection errors
- API key errors
- Configuration failures

**Solution:**
- Verify .env file format
- Check platform-specific environment variable setup
- Validate variable names and values

## Monitoring and Maintenance

### 1. Continuous Monitoring
```bash
# Regular checks:
railway logs | head -20
curl -s -o /dev/null -w "%{http_code}" https://your-app.railway.app
```

### 2. Performance Tracking
- Monitor API request frequency
- Track response times
- Check error rates
- Verify resource usage

### 3. Preventive Measures
- Regular dependency updates
- Code quality checks
- Automated testing
- Documentation maintenance

## Tools and Commands Reference

### Railway CLI
```bash
railway login
railway status
railway logs
railway up
railway domain
```

### Testing Commands
```bash
npm run test
npm run build
node test-script.js
curl -I https://app-url
```

### Debugging Commands
```bash
grep -r "pattern" --include="*.ext"
find . -name "filename"
cat file.js | head -50
```

## Success Criteria
- [ ] Application loads without errors
- [ ] No infinite loops or excessive requests
- [ ] All features function correctly
- [ ] Performance is acceptable
- [ ] Documentation is complete
- [ ] Monitoring is in place

## Workflow Completion Checklist
- [ ] Problem identified and root cause analyzed
- [ ] Fixes implemented and tested
- [ ] Application built and deployed successfully
- [ ] Testing completed and passed
- [ ] Documentation created
- [ ] Prevention measures implemented

---

**Workflow Author:** Claude Code Assistant
**Created:** September 23, 2025
**Last Updated:** September 23, 2025
**Version:** 1.0

This workflow can be adapted for different types of applications and deployment platforms by modifying the specific commands and tools used while maintaining the overall systematic approach.
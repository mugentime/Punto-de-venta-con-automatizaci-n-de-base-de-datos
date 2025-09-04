/**
 * JWT Authentication Diagnosis Script
 * Phase 2: JWT Configuration Analysis
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

console.log('🔍 JWT Authentication Diagnosis Starting...\n');

// Read environment variables
const JWT_SECRET = process.env.JWT_SECRET;
console.log('🔐 JWT_SECRET found:', JWT_SECRET ? 'YES' : 'NO');
console.log('🔐 JWT_SECRET preview:', JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'NOT FOUND');

// Analysis of different auth implementations
console.log('\n📊 JWT Configuration Analysis:');
console.log('=' .repeat(60));

// 1. Check main auth.js configuration
console.log('\n1️⃣ Main Auth Routes (/routes/auth.js):');
const authRoutes = fs.readFileSync(path.join(__dirname, 'routes', 'auth.js'), 'utf8');

// Extract JWT signing configuration
const jwtSignMatch = authRoutes.match(/jwt\.sign\((.*?),\s*(.*?),\s*(.*?)\)/gs);
if (jwtSignMatch) {
    console.log('   ✅ JWT signing found in auth.js');
    jwtSignMatch.forEach((match, index) => {
        console.log(`   🔑 Sign config ${index + 1}:`, match.replace(/\s+/g, ' ').substring(0, 100) + '...');
    });
} else {
    console.log('   ❌ No JWT signing found in auth.js');
}

// 2. Check middleware auth configuration  
console.log('\n2️⃣ Auth Middleware (/middleware/auth.js):');
const authMiddleware = fs.readFileSync(path.join(__dirname, 'middleware', 'auth.js'), 'utf8');

// Extract JWT verification configuration
const jwtVerifyMatch = authMiddleware.match(/jwt\.verify\((.*?),\s*(.*?)\)/gs);
if (jwtVerifyMatch) {
    console.log('   ✅ JWT verification found in middleware');
    jwtVerifyMatch.forEach((match, index) => {
        console.log(`   🔓 Verify config ${index + 1}:`, match.replace(/\s+/g, ' ').substring(0, 80) + '...');
    });
} else {
    console.log('   ❌ No JWT verification found in middleware');
}

// 3. Check if there are multiple auth implementations
console.log('\n3️⃣ Alternative Auth Files Analysis:');
const authFilePath = path.join(__dirname, 'routes', 'auth-file.js');
if (fs.existsSync(authFilePath)) {
    console.log('   ⚠️  FOUND: routes/auth-file.js (alternative implementation)');
    const authFileContent = fs.readFileSync(authFilePath, 'utf8');
    
    // Check for databaseManager.generateToken usage
    if (authFileContent.includes('databaseManager.generateToken')) {
        console.log('   🔍 Uses databaseManager.generateToken (different from JWT)');
    }
    if (authFileContent.includes('jwt.sign')) {
        console.log('   🔍 Also uses jwt.sign');
    }
} else {
    console.log('   ✅ No alternative auth-file.js found');
}

// 4. Check server.js for route configuration
console.log('\n4️⃣ Server Route Configuration Analysis:');
const serverPath = path.join(__dirname, 'server.js');
if (fs.existsSync(serverPath)) {
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check which auth routes are being used
    if (serverContent.includes("require('./routes/auth')")) {
        console.log('   ✅ Using /routes/auth.js (main JWT implementation)');
    }
    if (serverContent.includes("require('./routes/auth-file')")) {
        console.log('   ⚠️  ALSO using /routes/auth-file.js (alternative implementation)');
        console.log('   🚨 POTENTIAL CONFLICT: Multiple auth implementations active');
    }
}

// 5. Create test tokens and validate them
console.log('\n5️⃣ JWT Token Generation & Validation Test:');
console.log('-'.repeat(50));

if (JWT_SECRET) {
    try {
        // Create a test token like the auth endpoint would
        const testPayload = {
            userId: 'test-user-123',
            email: 'test@example.com', 
            role: 'admin'
        };
        
        console.log('🧪 Creating test token...');
        const testToken = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '7d' });
        console.log('   ✅ Token created successfully');
        console.log('   🎫 Token preview:', testToken.substring(0, 50) + '...');
        
        // Now try to verify it like the middleware would
        console.log('\n🔓 Validating test token...');
        const decoded = jwt.verify(testToken, JWT_SECRET);
        console.log('   ✅ Token verification successful');
        console.log('   📋 Decoded payload:', JSON.stringify(decoded, null, 2));
        
        // Check if payload structure matches what middleware expects
        const hasUserId = decoded.userId !== undefined;
        const hasEmail = decoded.email !== undefined;
        const hasRole = decoded.role !== undefined;
        
        console.log('\n📊 Token Payload Validation:');
        console.log('   userId present:', hasUserId ? '✅' : '❌');
        console.log('   email present:', hasEmail ? '✅' : '❌'); 
        console.log('   role present:', hasRole ? '✅' : '❌');
        
        if (hasUserId && hasEmail && hasRole) {
            console.log('   🎉 Token payload structure is CORRECT');
        } else {
            console.log('   🚨 Token payload structure has ISSUES');
        }
        
    } catch (error) {
        console.error('   ❌ JWT test failed:', error.message);
    }
} else {
    console.log('   ❌ Cannot test JWT - no JWT_SECRET available');
}

// 6. Environment validation
console.log('\n6️⃣ Environment Variables Check:');
console.log('-'.repeat(40));
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('PORT:', process.env.PORT || 'not set');

// 7. Diagnosis Summary
console.log('\n📊 DIAGNOSIS SUMMARY:');
console.log('='.repeat(60));

let issues = [];
let recommendations = [];

if (!JWT_SECRET) {
    issues.push('JWT_SECRET not found in environment');
    recommendations.push('Set JWT_SECRET environment variable');
}

if (fs.existsSync(authFilePath)) {
    const serverContent = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
    if (serverContent.includes("auth-file")) {
        issues.push('Multiple auth implementations detected');
        recommendations.push('Use only one auth implementation (prefer routes/auth.js)');
    }
}

if (issues.length === 0) {
    console.log('✅ No obvious JWT configuration issues detected');
} else {
    console.log('🚨 Issues Found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    
    console.log('\n💡 Recommendations:');
    recommendations.forEach(rec => console.log(`   - ${rec}`));
}

console.log('\n🎯 Next Step: Test actual login → token → protected route flow');

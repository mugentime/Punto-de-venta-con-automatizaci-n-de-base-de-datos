/**
 * Environment Loading Test Script
 * Test if environment variables are loading correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Environment Loading Test Starting...\n');

// 1. Check if .env files exist
console.log('1️⃣ Checking environment files:');
const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];

envFiles.forEach(filename => {
    const filepath = path.join(__dirname, filename);
    if (fs.existsSync(filepath)) {
        console.log(`   ✅ Found: ${filename}`);
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            const lines = content.split('\n').length;
            const hasJwtSecret = content.includes('JWT_SECRET');
            const hasDatabaseUrl = content.includes('DATABASE_URL');
            
            console.log(`      - Lines: ${lines}`);
            console.log(`      - Has JWT_SECRET: ${hasJwtSecret ? '✅' : '❌'}`);
            console.log(`      - Has DATABASE_URL: ${hasDatabaseUrl ? '✅' : '❌'}`);
            
            if (hasJwtSecret) {
                const jwtMatch = content.match(/JWT_SECRET=(.+)/);
                if (jwtMatch) {
                    const secret = jwtMatch[1].trim();
                    console.log(`      - JWT_SECRET preview: ${secret.substring(0, 10)}...`);
                }
            }
        } catch (error) {
            console.log(`      - Error reading file: ${error.message}`);
        }
    } else {
        console.log(`   ❌ Missing: ${filename}`);
    }
});

// 2. Test loading dotenv manually
console.log('\n2️⃣ Testing dotenv loading:');
try {
    require('dotenv').config();
    console.log('   ✅ dotenv.config() executed successfully');
} catch (error) {
    console.log('   ❌ dotenv.config() failed:', error.message);
}

// 3. Check environment variables after loading
console.log('\n3️⃣ Environment variables after dotenv loading:');
const envVars = ['NODE_ENV', 'JWT_SECRET', 'DATABASE_URL', 'PORT'];

envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        if (varName === 'JWT_SECRET' || varName === 'DATABASE_URL') {
            console.log(`   ${varName}: ${value.substring(0, 15)}... (length: ${value.length})`);
        } else {
            console.log(`   ${varName}: ${value}`);
        }
    } else {
        console.log(`   ${varName}: ❌ NOT SET`);
    }
});

// 4. Test different dotenv loading strategies
console.log('\n4️⃣ Testing alternative dotenv loading methods:');

try {
    // Try loading .env specifically
    const dotenv = require('dotenv');
    const result = dotenv.config({ path: path.join(__dirname, '.env') });
    
    if (result.error) {
        console.log('   ❌ .env loading error:', result.error.message);
    } else {
        console.log('   ✅ .env loaded successfully');
        console.log('   📊 Variables loaded:', Object.keys(result.parsed || {}).length);
        
        if (result.parsed && result.parsed.JWT_SECRET) {
            console.log('   🔐 JWT_SECRET found in .env file');
        }
    }
} catch (error) {
    console.log('   ❌ Alternative loading failed:', error.message);
}

// 5. Final environment check
console.log('\n5️⃣ Final environment state:');
const finalJwtSecret = process.env.JWT_SECRET;
const finalDatabaseUrl = process.env.DATABASE_URL;

console.log('   JWT_SECRET:', finalJwtSecret ? `SET (length: ${finalJwtSecret.length})` : 'NOT SET');
console.log('   DATABASE_URL:', finalDatabaseUrl ? `SET (length: ${finalDatabaseUrl.length})` : 'NOT SET');

// 6. Create a simple JWT test if JWT_SECRET is available
if (finalJwtSecret) {
    console.log('\n6️⃣ JWT Test with loaded secret:');
    try {
        const jwt = require('jsonwebtoken');
        const testPayload = { test: 'data', timestamp: Date.now() };
        const token = jwt.sign(testPayload, finalJwtSecret, { expiresIn: '1h' });
        const decoded = jwt.verify(token, finalJwtSecret);
        
        console.log('   ✅ JWT sign/verify test PASSED');
        console.log('   🎫 Test token created and verified successfully');
    } catch (error) {
        console.log('   ❌ JWT test FAILED:', error.message);
    }
} else {
    console.log('\n6️⃣ Cannot test JWT - no JWT_SECRET available');
}

console.log('\n🎯 Summary:');
if (process.env.JWT_SECRET && process.env.DATABASE_URL) {
    console.log('   ✅ All critical environment variables are loaded');
} else {
    console.log('   ❌ Missing critical environment variables');
    if (!process.env.JWT_SECRET) console.log('      - JWT_SECRET missing');
    if (!process.env.DATABASE_URL) console.log('      - DATABASE_URL missing'); 
}

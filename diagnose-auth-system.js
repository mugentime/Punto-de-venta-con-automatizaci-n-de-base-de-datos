// Diagnostic Script: Authentication System Conflict Detection
const fs = require('fs');
const path = require('path');

console.log('🔍 AUTHENTICATION SYSTEM DIAGNOSTIC');
console.log('=====================================\n');

// Check server.js route imports
console.log('1. SERVER.JS ROUTE IMPORTS:');
const serverFile = fs.readFileSync('server.js', 'utf8');
const routeImports = [
    { name: 'authRoutes', pattern: /const authRoutes = require\('([^']+)'\);/ },
    { name: 'productRoutes', pattern: /const productRoutes = require\('([^']+)'\);/ },
    { name: 'auth middleware', pattern: /const { auth } = require\('([^']+)'\);/ }
];

routeImports.forEach(({ name, pattern }) => {
    const match = serverFile.match(pattern);
    if (match) {
        console.log(`   ${name}: ${match[1]}`);
    }
});

console.log('\n2. AVAILABLE AUTH IMPLEMENTATIONS:');

// Check available auth route files
const authFiles = [
    './routes/auth.js',
    './routes/auth-file.js'
];

authFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
        
        // Check if it uses MongoDB or PostgreSQL
        const content = fs.readFileSync(file, 'utf8');
        const usesPostgreSQL = content.includes('databaseManager') || content.includes('pool.query');
        const usesMongoDB = content.includes('User.findOne') || content.includes('User.findById');
        
        console.log(`      - Uses PostgreSQL: ${usesPostgreSQL}`);
        console.log(`      - Uses MongoDB: ${usesMongoDB}`);
    } else {
        console.log(`   ❌ ${file} does not exist`);
    }
});

console.log('\n3. AVAILABLE MIDDLEWARE IMPLEMENTATIONS:');

// Check available middleware files
const middlewareFiles = [
    './middleware/auth.js',
    './middleware/auth-file.js'
];

middlewareFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
        
        // Check if it uses MongoDB or PostgreSQL
        const content = fs.readFileSync(file, 'utf8');
        const usesPostgreSQL = content.includes('databaseManager') || content.includes('pool.query');
        const usesMongoDB = content.includes('User.findById') || content.includes('mongoose');
        
        console.log(`      - Uses PostgreSQL: ${usesPostgreSQL}`);
        console.log(`      - Uses MongoDB: ${usesMongoDB}`);
    } else {
        console.log(`   ❌ ${file} does not exist`);
    }
});

console.log('\n4. PRODUCTS ROUTE ANALYSIS:');

// Check products route files
const productFiles = [
    './routes/products.js',
    './routes/products-file.js'
];

productFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
        
        // Check which auth middleware it imports
        const content = fs.readFileSync(file, 'utf8');
        const authImportMatch = content.match(/require\('([^']*auth[^']*?)'\)/);
        if (authImportMatch) {
            console.log(`      - Imports auth from: ${authImportMatch[1]}`);
        }
        
        const usesPostgreSQL = content.includes('databaseManager');
        const usesMongoDB = content.includes('Product.find') || content.includes('Product.findById');
        
        console.log(`      - Uses PostgreSQL: ${usesPostgreSQL}`);
        console.log(`      - Uses MongoDB: ${usesMongoDB}`);
    } else {
        console.log(`   ❌ ${file} does not exist`);
    }
});

console.log('\n5. SYSTEM COMPATIBILITY CHECK:');

// Determine current configuration
const authRoutePath = serverFile.match(/const authRoutes = require\('([^']+)'\);/)?.[1];
const productRoutePath = serverFile.match(/const productRoutes = require\('([^']+)'\);/)?.[1];
const authMiddlewarePath = serverFile.match(/const { auth } = require\('([^']+)'\);/)?.[1];

console.log(`   Server uses auth routes from: ${authRoutePath}`);
console.log(`   Server uses product routes from: ${productRoutePath}`);
console.log(`   Server uses auth middleware from: ${authMiddlewarePath}`);

// Check for compatibility issues
let hasCompatibilityIssues = false;

if (authRoutePath && productRoutePath) {
    const authContent = fs.existsSync(authRoutePath) ? fs.readFileSync(authRoutePath, 'utf8') : '';
    const productContent = fs.existsSync(productRoutePath) ? fs.readFileSync(productRoutePath, 'utf8') : '';
    
    const authUsesPostgreSQL = authContent.includes('databaseManager');
    const productUsesPostgreSQL = productContent.includes('databaseManager');
    
    if (authUsesPostgreSQL !== productUsesPostgreSQL) {
        hasCompatibilityIssues = true;
        console.log(`   ⚠️  COMPATIBILITY ISSUE: Auth and Products use different database systems!`);
        console.log(`       - Auth uses PostgreSQL: ${authUsesPostgreSQL}`);
        console.log(`       - Products uses PostgreSQL: ${productUsesPostgreSQL}`);
    }
    
    // Check middleware compatibility with products
    if (productRoutePath) {
        const productAuthImport = productContent.match(/require\('([^']*auth[^']*?)'\)/)?.[1];
        if (productAuthImport && authMiddlewarePath && productAuthImport !== authMiddlewarePath) {
            hasCompatibilityIssues = true;
            console.log(`   ⚠️  MIDDLEWARE MISMATCH:`);
            console.log(`       - Server uses middleware from: ${authMiddlewarePath}`);
            console.log(`       - Products route imports from: ${productAuthImport}`);
        }
    }
}

console.log('\n6. RECOMMENDED FIXES:');

if (hasCompatibilityIssues) {
    console.log('   🔧 CRITICAL: Switch to consistent file-based system:');
    console.log('      1. Change server.js to use file-based routes:');
    console.log('         - authRoutes: require("./routes/auth-file")');
    console.log('         - productRoutes: require("./routes/products-file")'); 
    console.log('         - auth middleware: require("./middleware/auth-file")');
    console.log('      2. Or switch products.js to use PostgreSQL instead of MongoDB');
} else {
    console.log('   ✅ No compatibility issues detected');
}

console.log('\n7. NEXT STEPS:');
console.log('   1. Run this diagnostic to understand the current state');
console.log('   2. Apply the recommended fixes to align systems');
console.log('   3. Test authentication with aligned components');
console.log('   4. Verify that login + protected routes work together\n');

console.log('=== DIAGNOSTIC COMPLETE ===');

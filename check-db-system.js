// Check Database System Selection
console.log('🔍 CHECKING DATABASE SYSTEM SELECTION');
console.log('====================================\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log('   DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('   DATABASE_URL value:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'undefined');

// Test DatabaseManager selection logic
const databaseManager = require('./utils/databaseManager');

console.log('\n2. DatabaseManager Selection:');
console.log('   usePostgreSQL:', databaseManager.usePostgreSQL);

// Check which methods would be called
if (databaseManager.usePostgreSQL) {
    console.log('   📘 Will use PostgreSQL methods from database.js');
} else {
    console.log('   📁 Will use file-based methods from fileDatabase.js');
}

console.log('\n3. Testing method calls:');

(async () => {
    try {
        await databaseManager.initialize();
        
        // Test validateUserPassword method path
        console.log('   Testing validateUserPassword...');
        const user = await databaseManager.validateUserPassword('admin@conejonegro.com', 'admin123');
        
        if (user) {
            console.log('   ✅ User validation successful');
            console.log('   User object structure:', {
                hasId: !!user._id || !!user.id,
                id: user._id || user.id,
                email: user.email,
                role: user.role,
                allKeys: Object.keys(user)
            });
            
            // Test token generation
            console.log('   Testing token generation...');
            const token = databaseManager.generateToken(user);
            
            if (token) {
                console.log('   ✅ Token generation successful');
                
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                console.log('   Token payload:', {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role
                });
                
                // Check if the issue is in the token generation logic
                if (decoded.userId === undefined) {
                    console.log('\n🚨 ISSUE FOUND:');
                    console.log('   User object has ID:', user._id || user.id);
                    console.log('   But token userId is undefined');
                    console.log('   This suggests the token generation code uses wrong field');
                }
            }
        }
        
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
})();

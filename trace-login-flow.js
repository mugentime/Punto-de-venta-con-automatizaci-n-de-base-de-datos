// Trace Login Flow Debug
const databaseManager = require('./utils/databaseManager');

console.log('🔍 TRACING LOGIN FLOW');
console.log('=====================\n');

async function traceLoginFlow() {
    try {
        console.log('1. Initialize database manager...');
        await databaseManager.initialize();
        console.log('   ✅ Database manager initialized');
        console.log('   Using PostgreSQL:', databaseManager.usePostgreSQL);
        
        console.log('\n2. Testing validateUserPassword...');
        const user = await databaseManager.validateUserPassword('admin@conejonegro.com', 'admin123');
        
        if (!user) {
            console.log('   ❌ User validation failed');
            
            // Check if admin user exists
            console.log('\n   Checking if user exists...');
            const existingUser = await databaseManager.getUserByEmail('admin@conejonegro.com');
            console.log('   User exists:', !!existingUser);
            if (existingUser) {
                console.log('   User structure:', {
                    id: existingUser._id || existingUser.id,
                    email: existingUser.email,
                    role: existingUser.role,
                    isActive: existingUser.isActive,
                    hasPassword: !!existingUser.password
                });
            }
            return;
        }
        
        console.log('   ✅ User validation successful');
        console.log('   User structure:', {
            id: user._id || user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            hasPassword: !!user.password,
            allKeys: Object.keys(user)
        });
        
        console.log('\n3. Testing token generation...');
        const token = databaseManager.generateToken(user);
        console.log('   ✅ Token generated:', token ? token.substring(0, 30) + '...' : 'FAILED');
        
        if (token) {
            // Decode token manually to see contents
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            console.log('   Token contents:', {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                iat: decoded.iat,
                exp: decoded.exp
            });
            
            console.log('\n4. Testing token verification...');
            const verified = databaseManager.verifyToken(token);
            console.log('   Token verification:', verified ? 'SUCCESS' : 'FAILED');
            if (verified) {
                console.log('   Verified payload:', {
                    userId: verified.userId,
                    email: verified.email,
                    role: verified.role
                });
            }
            
            console.log('\n5. Testing user lookup by ID from token...');
            if (decoded.userId) {
                const lookedUpUser = await databaseManager.getUserById(decoded.userId);
                console.log('   User lookup by ID:', lookedUpUser ? 'SUCCESS' : 'FAILED');
                if (lookedUpUser) {
                    console.log('   Found user:', {
                        id: lookedUpUser._id || lookedUpUser.id,
                        email: lookedUpUser.email,
                        role: lookedUpUser.role,
                        isActive: lookedUpUser.isActive
                    });
                } else {
                    console.log('   ❌ User not found by ID:', decoded.userId);
                    
                    // Debug: List all users to see available IDs
                    console.log('\n   Available users:');
                    const allUsers = await databaseManager.getUsers();
                    allUsers.forEach(u => {
                        console.log(`      - ID: ${u._id || u.id}, Email: ${u.email}, Role: ${u.role}`);
                    });
                }
            } else {
                console.log('   ❌ No userId in decoded token');
            }
        }
        
        console.log('\n=== TRACE COMPLETE ===');
        
    } catch (error) {
        console.log('\n❌ Trace failed:', error.message);
        console.log('   Stack:', error.stack);
    }
}

traceLoginFlow();

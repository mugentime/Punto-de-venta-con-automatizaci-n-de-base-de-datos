/**
 * Main Setup Script for POS Conejo Negro
 * This is called during npm run setup and production deployment
 */

const { createAdminUser, initializeDatabase, verifySetup } = require('./scripts/production-setup');

async function main() {
    try {
        console.log('🚀 Running POS Conejo Negro Setup...');
        
        // Run the production setup
        await createAdminUser();
        await initializeDatabase();
        
        const isValid = await verifySetup();
        
        if (isValid) {
            console.log('✅ Setup completed successfully!');
        } else {
            console.error('❌ Setup completed with errors');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('💥 Setup failed:', error.message);
        process.exit(1);
    }
}

// Run setup
main();

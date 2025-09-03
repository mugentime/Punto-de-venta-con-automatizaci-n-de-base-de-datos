require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Generate ID
        const adminId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // Hash password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        // Check if admin exists
        const checkResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin@conejonegro.com']);
        
        if (checkResult.rows.length > 0) {
            console.log('Admin user already exists!');
            console.log('Email: admin@conejonegro.com');
            console.log('Password: admin123');
        } else {
            // Create admin user
            await pool.query(`
                INSERT INTO users (_id, username, password, role, permissions, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                adminId,
                'admin@conejonegro.com',
                hashedPassword,
                'admin',
                JSON.stringify({
                    users: ['view', 'create', 'edit', 'delete'],
                    products: ['view', 'create', 'edit', 'delete'],
                    records: ['view', 'create', 'edit', 'delete'],
                    cashcuts: ['view', 'create', 'delete'],
                    backup: ['view', 'create', 'restore']
                }),
                true
            ]);
            
            console.log('✅ Admin user created successfully!');
            console.log('Email: admin@conejonegro.com');
            console.log('Password: admin123');
        }

        // Also create a regular employee
        const employeeId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const employeePassword = await bcrypt.hash('empleado123', 10);
        
        const checkEmployee = await pool.query('SELECT * FROM users WHERE username = $1', ['empleado@conejo.com']);
        
        if (checkEmployee.rows.length === 0) {
            await pool.query(`
                INSERT INTO users (_id, username, password, role, permissions, is_active)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                employeeId,
                'empleado@conejo.com',
                employeePassword,
                'employee',
                JSON.stringify({
                    products: ['view'],
                    records: ['view', 'create']
                }),
                true
            ]);
            
            console.log('\n✅ Employee user created!');
            console.log('Email: empleado@conejo.com');
            console.log('Password: empleado123');
        }
        
        console.log('\n📝 Please change these passwords after logging in!');
        
    } catch (error) {
        console.error('Error creating users:', error);
    } finally {
        await pool.end();
    }
}

createAdminUser();
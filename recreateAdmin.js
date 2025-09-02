// Script para verificar y recrear usuario admin
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function recreateAdmin() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔍 Verificando usuarios existentes...');
        
        // Listar usuarios actuales
        const existingUsers = await pool.query('SELECT username, role FROM users');
        console.log('Usuarios actuales:', existingUsers.rows);
        
        // Eliminar admin existente
        await pool.query('DELETE FROM users WHERE username = $1', ['admin@conejo.com']);
        
        // Crear nuevo admin con password conocido
        const adminId = 'admin_' + Date.now();
        const hash = await bcrypt.hash('admin123', 10);
        
        await pool.query(`
            INSERT INTO users (_id, username, password, role, permissions, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [
            adminId,
            'admin@conejo.com',
            hash,
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
        
        console.log('✅ Usuario admin recreado exitosamente!');
        console.log('');
        console.log('📧 Email: admin@conejo.com');
        console.log('🔑 Password: admin123');
        console.log('');
        
        // Verificar creación
        const verify = await pool.query('SELECT username, role FROM users WHERE username = $1', ['admin@conejo.com']);
        console.log('✓ Verificación:', verify.rows[0]);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.detail) console.error('Detalle:', error.detail);
    } finally {
        await pool.end();
    }
}

recreateAdmin();

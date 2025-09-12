const IUserRepository = require('./interfaces/IUserRepository');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

/**
 * PostgreSQL implementation of User Repository
 * Handles all user-related database operations for PostgreSQL
 */
class PostgreSQLUserRepository extends IUserRepository {
    constructor(pool) {
        super();
        this.pool = pool;
    }

    /**
     * Find user by ID
     * @param {string} id - User ID
     * @returns {Promise<Object|null>} User object or null
     */
    async findById(id) {
        try {
            const query = 'SELECT * FROM users WHERE _id = $1 AND is_active = true';
            const result = await this.pool.query(query, [id]);
            
            return result.rows.length > 0 ? this._mapRowToUser(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find user by ID: ${error.message}`);
        }
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User object or null
     */
    async findByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
            const result = await this.pool.query(query, [email.toLowerCase()]);
            
            return result.rows.length > 0 ? this._mapRowToUser(result.rows[0]) : null;
        } catch (error) {
            throw new Error(`Failed to find user by email: ${error.message}`);
        }
    }

    /**
     * Find all users with optional filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Array>} Array of users
     */
    async findAll(filters = {}) {
        try {
            let query = 'SELECT * FROM users WHERE is_active = true';
            const params = [];
            let paramCount = 1;

            if (filters.role) {
                query += ` AND role = $${paramCount}`;
                params.push(filters.role);
                paramCount++;
            }

            if (filters.limit) {
                query += ` LIMIT $${paramCount}`;
                params.push(filters.limit);
                paramCount++;
            }

            query += ' ORDER BY created_at DESC';

            const result = await this.pool.query(query, params);
            return result.rows.map(row => this._mapRowToUser(row));
        } catch (error) {
            throw new Error(`Failed to find users: ${error.message}`);
        }
    }

    /**
     * Create new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    async create(userData) {
        try {
            const id = this._generateId();
            
            // Hash password if not already hashed
            let hashedPassword = userData.password;
            if (!hashedPassword.startsWith('$2')) {
                hashedPassword = await bcrypt.hash(userData.password, 12);
            }

            const query = `
                INSERT INTO users (_id, username, password, role, permissions, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;

            const values = [
                id,
                userData.email.toLowerCase(),
                hashedPassword,
                userData.role || 'employee',
                JSON.stringify(userData.permissions || {}),
                true,
                new Date(),
                new Date()
            ];

            const result = await this.pool.query(query, values);
            return this._mapRowToUser(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') {
                throw new Error('User with this email already exists');
            }
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    /**
     * Update user
     * @param {string} id - User ID
     * @param {Object} userData - Update data
     * @returns {Promise<Object>} Updated user
     */
    async update(id, userData) {
        try {
            const updates = [];
            const values = [];
            let paramCount = 1;

            // Build dynamic update query
            Object.keys(userData).forEach(key => {
                if (key === 'password' && userData[key]) {
                    updates.push(`password = $${paramCount}`);
                    values.push(bcrypt.hashSync(userData[key], 12));
                } else if (key === 'email') {
                    updates.push(`username = $${paramCount}`);
                    values.push(userData[key].toLowerCase());
                } else if (key === 'permissions') {
                    updates.push(`permissions = $${paramCount}`);
                    values.push(JSON.stringify(userData[key]));
                } else if (key === 'isActive') {
                    updates.push(`is_active = $${paramCount}`);
                    values.push(userData[key]);
                } else if (['role', 'name'].includes(key)) {
                    updates.push(`${key} = $${paramCount}`);
                    values.push(userData[key]);
                }
                paramCount++;
            });

            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }

            updates.push(`updated_at = $${paramCount}`);
            values.push(new Date());
            values.push(id);

            const query = `
                UPDATE users 
                SET ${updates.join(', ')} 
                WHERE _id = $${paramCount + 1} AND is_active = true
                RETURNING *
            `;

            const result = await this.pool.query(query, values);
            
            if (result.rows.length === 0) {
                throw new Error('User not found or inactive');
            }

            return this._mapRowToUser(result.rows[0]);
        } catch (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }

    /**
     * Soft delete user
     * @param {string} id - User ID
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            const query = `
                UPDATE users 
                SET is_active = false, updated_at = $1 
                WHERE _id = $2 AND is_active = true
            `;
            
            const result = await this.pool.query(query, [new Date(), id]);
            return result.rowCount > 0;
        } catch (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    /**
     * Check if user exists by email
     * @param {string} email - User email
     * @returns {Promise<boolean>} Existence status
     */
    async exists(email) {
        try {
            const query = 'SELECT 1 FROM users WHERE username = $1 AND is_active = true';
            const result = await this.pool.query(query, [email.toLowerCase()]);
            return result.rows.length > 0;
        } catch (error) {
            throw new Error(`Failed to check user existence: ${error.message}`);
        }
    }

    /**
     * Count users with filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<number>} User count
     */
    async count(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) FROM users WHERE is_active = true';
            const params = [];
            let paramCount = 1;

            if (filters.role) {
                query += ` AND role = $${paramCount}`;
                params.push(filters.role);
                paramCount++;
            }

            const result = await this.pool.query(query, params);
            return parseInt(result.rows[0].count);
        } catch (error) {
            throw new Error(`Failed to count users: ${error.message}`);
        }
    }

    /**
     * Verify user password
     * @param {string} plainPassword - Plain text password
     * @param {string} hashedPassword - Hashed password
     * @returns {Promise<boolean>} Verification result
     */
    async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Map database row to user object
     * @private
     */
    _mapRowToUser(row) {
        return {
            id: row._id,
            email: row.username,
            name: row.name || row.username.split('@')[0],
            password: row.password,
            role: row.role,
            permissions: row.permissions || {},
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    /**
     * Generate unique ID
     * @private
     */
    _generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

module.exports = PostgreSQLUserRepository;
const IUserRepository = require('./interfaces/IUserRepository');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

/**
 * File-based implementation of User Repository
 * Handles all user-related file operations
 */
class FileUserRepository extends IUserRepository {
    constructor(dataDir = path.join(__dirname, '../../data')) {
        super();
        this.dataDir = dataDir;
        this.usersFile = path.join(dataDir, 'users.json');
    }

    /**
     * Initialize file system
     */
    async initialize() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }

        try {
            await fs.access(this.usersFile);
        } catch {
            await fs.writeFile(this.usersFile, JSON.stringify([], null, 2));
        }
    }

    /**
     * Load users from file
     * @private
     */
    async _loadUsers() {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading users:', error);
            return [];
        }
    }

    /**
     * Save users to file
     * @private
     */
    async _saveUsers(users) {
        try {
            await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
        } catch (error) {
            throw new Error(`Failed to save users: ${error.message}`);
        }
    }

    /**
     * Find user by ID
     */
    async findById(id) {
        const users = await this._loadUsers();
        return users.find(user => user.id === id && user.isActive) || null;
    }

    /**
     * Find user by email
     */
    async findByEmail(email) {
        const users = await this._loadUsers();
        return users.find(user => 
            user.email.toLowerCase() === email.toLowerCase() && user.isActive
        ) || null;
    }

    /**
     * Find all users with filters
     */
    async findAll(filters = {}) {
        let users = await this._loadUsers();
        
        // Filter active users
        users = users.filter(user => user.isActive);

        // Apply role filter
        if (filters.role) {
            users = users.filter(user => user.role === filters.role);
        }

        // Apply limit
        if (filters.limit) {
            users = users.slice(0, filters.limit);
        }

        // Sort by creation date (newest first)
        return users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Create new user
     */
    async create(userData) {
        const users = await this._loadUsers();
        
        // Check if user already exists
        if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase() && u.isActive)) {
            throw new Error('User with this email already exists');
        }

        const id = this._generateId();
        
        // Hash password if not already hashed
        let hashedPassword = userData.password;
        if (!hashedPassword.startsWith('$2')) {
            hashedPassword = await bcrypt.hash(userData.password, 12);
        }

        const newUser = {
            id,
            email: userData.email.toLowerCase(),
            name: userData.name || userData.email.split('@')[0],
            password: hashedPassword,
            role: userData.role || 'employee',
            permissions: userData.permissions || {},
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        users.push(newUser);
        await this._saveUsers(users);
        
        return newUser;
    }

    /**
     * Update user
     */
    async update(id, userData) {
        const users = await this._loadUsers();
        const userIndex = users.findIndex(user => user.id === id && user.isActive);
        
        if (userIndex === -1) {
            throw new Error('User not found or inactive');
        }

        const user = users[userIndex];

        // Update fields
        if (userData.email) user.email = userData.email.toLowerCase();
        if (userData.name) user.name = userData.name;
        if (userData.password) {
            user.password = await bcrypt.hash(userData.password, 12);
        }
        if (userData.role) user.role = userData.role;
        if (userData.permissions) user.permissions = userData.permissions;
        if (userData.hasOwnProperty('isActive')) user.isActive = userData.isActive;
        
        user.updatedAt = new Date().toISOString();

        await this._saveUsers(users);
        return user;
    }

    /**
     * Soft delete user
     */
    async delete(id) {
        const users = await this._loadUsers();
        const userIndex = users.findIndex(user => user.id === id && user.isActive);
        
        if (userIndex === -1) {
            return false;
        }

        users[userIndex].isActive = false;
        users[userIndex].updatedAt = new Date().toISOString();
        
        await this._saveUsers(users);
        return true;
    }

    /**
     * Check if user exists by email
     */
    async exists(email) {
        const users = await this._loadUsers();
        return users.some(user => 
            user.email.toLowerCase() === email.toLowerCase() && user.isActive
        );
    }

    /**
     * Count users with filters
     */
    async count(filters = {}) {
        const users = await this.findAll(filters);
        return users.length;
    }

    /**
     * Verify user password
     */
    async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Generate unique ID
     * @private
     */
    _generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

module.exports = FileUserRepository;
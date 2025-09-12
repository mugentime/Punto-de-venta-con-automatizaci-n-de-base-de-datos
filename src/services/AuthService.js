const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Authentication Service
 * Handles all authentication-related business logic
 */
class AuthService {
    constructor(userRepository, jwtSecret = process.env.JWT_SECRET) {
        this.userRepository = userRepository;
        this.jwtSecret = jwtSecret || 'fallback-secret-key';
    }

    /**
     * Authenticate user with email and password
     * @param {string} email - User email
     * @param {string} password - Plain text password
     * @returns {Promise<Object>} Authentication result with token and user
     */
    async login(email, password) {
        try {
            // Validate input
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            // Find user
            const user = await this.userRepository.findByEmail(email);
            if (!user || !user.isActive) {
                throw new Error('Invalid email or password');
            }

            // Verify password
            const isValidPassword = await this.userRepository.verifyPassword(password, user.password);
            if (!isValidPassword) {
                throw new Error('Invalid email or password');
            }

            // Generate token
            const token = this._generateToken(user);

            // Return user data without password
            const { password: _, ...userWithoutPassword } = user;

            return {
                success: true,
                token,
                user: userWithoutPassword,
                expiresIn: '7d'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration result
     */
    async register(userData) {
        try {
            const { email, password, name, role = 'employee', permissions = {} } = userData;

            // Validate input
            if (!email || !password || !name) {
                throw new Error('Email, password, and name are required');
            }

            // Validate email format
            if (!this._isValidEmail(email)) {
                throw new Error('Invalid email format');
            }

            // Validate password strength
            if (!this._isValidPassword(password)) {
                throw new Error('Password must be at least 8 characters long and contain letters and numbers');
            }

            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Create user
            const newUser = await this.userRepository.create({
                email,
                password,
                name,
                role,
                permissions
            });

            // Generate token
            const token = this._generateToken(newUser);

            // Return user data without password
            const { password: _, ...userWithoutPassword } = newUser;

            return {
                success: true,
                token,
                user: userWithoutPassword,
                expiresIn: '7d'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify JWT token and return user
     * @param {string} token - JWT token
     * @returns {Promise<Object>} Verification result
     */
    async verifyToken(token) {
        try {
            if (!token) {
                throw new Error('No token provided');
            }

            // Verify token
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Get user from database
            const user = await this.userRepository.findById(decoded.userId);
            if (!user || !user.isActive) {
                throw new Error('User not found or inactive');
            }

            // Return user data without password
            const { password: _, ...userWithoutPassword } = user;

            return {
                success: true,
                user: userWithoutPassword,
                decoded
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Refresh JWT token
     * @param {string} token - Current JWT token
     * @returns {Promise<Object>} Refresh result
     */
    async refreshToken(token) {
        try {
            const verifyResult = await this.verifyToken(token);
            
            if (!verifyResult.success) {
                throw new Error('Invalid token');
            }

            // Generate new token
            const newToken = this._generateToken(verifyResult.user);

            return {
                success: true,
                token: newToken,
                user: verifyResult.user,
                expiresIn: '7d'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Change user password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} Change password result
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            // Validate input
            if (!currentPassword || !newPassword) {
                throw new Error('Current password and new password are required');
            }

            // Validate new password
            if (!this._isValidPassword(newPassword)) {
                throw new Error('New password must be at least 8 characters long and contain letters and numbers');
            }

            // Get user
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await this.userRepository.verifyPassword(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Update password
            await this.userRepository.update(userId, { password: newPassword });

            return {
                success: true,
                message: 'Password changed successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Logout user (invalidate token - would require token blacklist in production)
     * @param {string} token - JWT token to invalidate
     * @returns {Promise<Object>} Logout result
     */
    async logout(token) {
        try {
            // In a production system, you'd add the token to a blacklist
            // For now, we'll just return success
            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if user has permission
     * @param {Object} user - User object
     * @param {string} permission - Permission to check
     * @returns {boolean} Has permission
     */
    hasPermission(user, permission) {
        if (!user || !user.permissions) return false;
        
        // Admin has all permissions
        if (user.role === 'admin') return true;
        
        return user.permissions[permission] === true;
    }

    /**
     * Generate JWT token
     * @private
     */
    _generateToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                iat: Math.floor(Date.now() / 1000)
            },
            this.jwtSecret,
            { expiresIn: '7d' }
        );
    }

    /**
     * Validate email format
     * @private
     */
    _isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate password strength
     * @private
     */
    _isValidPassword(password) {
        // At least 8 characters, contains letters and numbers
        return password.length >= 8 && 
               /[A-Za-z]/.test(password) && 
               /\d/.test(password);
    }
}

module.exports = AuthService;
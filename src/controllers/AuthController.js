/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */
class AuthController {
    constructor(authService) {
        this.authService = authService;
        
        // Bind methods to preserve 'this' context
        this.login = this.login.bind(this);
        this.register = this.register.bind(this);
        this.refreshToken = this.refreshToken.bind(this);
        this.changePassword = this.changePassword.bind(this);
        this.logout = this.logout.bind(this);
        this.getProfile = this.getProfile.bind(this);
    }

    /**
     * POST /auth/login
     * Authenticate user with email and password
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validate request body
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            const result = await this.authService.login(email, password);

            if (!result.success) {
                return res.status(401).json(result);
            }

            // Set token in cookie for enhanced security (optional)
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.json(result);
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during login'
            });
        }
    }

    /**
     * POST /auth/register
     * Register new user account
     */
    async register(req, res) {
        try {
            const { email, password, name, role } = req.body;

            // Basic validation
            if (!email || !password || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, password, and name are required'
                });
            }

            // Only admin users can create non-employee accounts
            if (role && role !== 'employee' && (!req.user || req.user.role !== 'admin')) {
                return res.status(403).json({
                    success: false,
                    error: 'Only administrators can create non-employee accounts'
                });
            }

            const result = await this.authService.register({
                email,
                password,
                name,
                role: role || 'employee',
                permissions: {}
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Don't set cookie for registration, let them login
            res.status(201).json(result);
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during registration'
            });
        }
    }

    /**
     * POST /auth/refresh
     * Refresh JWT token
     */
    async refreshToken(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.token;

            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No token provided'
                });
            }

            const result = await this.authService.refreshToken(token);

            if (!result.success) {
                return res.status(401).json(result);
            }

            // Update cookie
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.json(result);
        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during token refresh'
            });
        }
    }

    /**
     * POST /auth/change-password
     * Change user password
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password and new password are required'
                });
            }

            const result = await this.authService.changePassword(userId, currentPassword, newPassword);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during password change'
            });
        }
    }

    /**
     * POST /auth/logout
     * Logout user (invalidate token)
     */
    async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies.token;

            // Clear cookie
            res.clearCookie('token');

            // In a production system, you'd add the token to a blacklist
            const result = await this.authService.logout(token);

            res.json(result);
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during logout'
            });
        }
    }

    /**
     * GET /auth/profile
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            // User data is already available from auth middleware
            const user = req.user;

            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while fetching profile'
            });
        }
    }

    /**
     * GET /auth/permissions
     * Get user permissions
     */
    async getPermissions(req, res) {
        try {
            const user = req.user;

            res.json({
                success: true,
                permissions: user.permissions || {},
                role: user.role
            });
        } catch (error) {
            console.error('Get permissions error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while fetching permissions'
            });
        }
    }
}

module.exports = AuthController;
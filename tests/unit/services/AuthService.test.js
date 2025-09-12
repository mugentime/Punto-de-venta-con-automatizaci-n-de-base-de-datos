/**
 * AuthService Unit Tests
 * Comprehensive testing of authentication business logic
 */

const AuthService = require('../../../src/services/AuthService');
const { ValidationError, AuthenticationError } = require('../../../src/middleware/errorHandler');

describe('AuthService', () => {
  let authService;
  let mockUserRepository;
  const testJwtSecret = 'test-jwt-secret-key';

  beforeEach(() => {
    mockUserRepository = global.testUtils.createMockRepository();
    authService = new AuthService(mockUserRepository, testJwtSecret);
  });

  describe('login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login user with valid credentials', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser({
        email: validLoginData.email,
        isActive: true
      });

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.verifyPassword.mockResolvedValue(true);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toBeApiSuccess();
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
      expect(result.expiresIn).toBe('7d');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(mockUserRepository.verifyPassword).toHaveBeenCalledWith(
        validLoginData.password,
        mockUser.password
      );
    });

    it('should fail login with invalid email', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toBeApiError('Invalid email or password');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validLoginData.email);
      expect(mockUserRepository.verifyPassword).not.toHaveBeenCalled();
    });

    it('should fail login with inactive user', async () => {
      // Arrange
      const inactiveUser = global.testUtils.createTestUser({
        email: validLoginData.email,
        isActive: false
      });

      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toBeApiError('Invalid email or password');
      expect(mockUserRepository.verifyPassword).not.toHaveBeenCalled();
    });

    it('should fail login with invalid password', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser({
        email: validLoginData.email,
        isActive: true
      });

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.verifyPassword.mockResolvedValue(false);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toBeApiError('Invalid email or password');
      expect(mockUserRepository.verifyPassword).toHaveBeenCalledWith(
        validLoginData.password,
        mockUser.password
      );
    });

    it('should fail login with missing email', async () => {
      // Arrange
      const invalidData = { password: 'password123' };

      // Act
      const result = await authService.login(invalidData);

      // Assert
      expect(result).toBeApiError('Email and password are required');
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should fail login with missing password', async () => {
      // Arrange
      const invalidData = { email: 'test@example.com' };

      // Act
      const result = await authService.login(invalidData);

      // Assert
      expect(result).toBeApiError('Email and password are required');
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockUserRepository.findByEmail.mockRejectedValue(error);

      // Act
      const result = await authService.login(validLoginData);

      // Assert
      expect(result).toBeApiError('Database connection failed');
    });
  });

  describe('register', () => {
    const validRegisterData = {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User',
      role: 'employee'
    };

    it('should register new user with valid data', async () => {
      // Arrange
      const mockCreatedUser = global.testUtils.createTestUser({
        email: validRegisterData.email,
        name: validRegisterData.name,
        role: validRegisterData.role
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result).toBeApiSuccess();
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(validRegisterData.email);
      expect(result.user.name).toBe(validRegisterData.name);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegisterData.email,
          name: validRegisterData.name,
          role: validRegisterData.role
        })
      );
    });

    it('should fail registration with existing email', async () => {
      // Arrange
      const existingUser = global.testUtils.createTestUser({
        email: validRegisterData.email
      });

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result).toBeApiError('User with this email already exists');
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should fail registration with invalid email format', async () => {
      // Arrange
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email'
      };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result).toBeApiError('Invalid email format');
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should fail registration with weak password', async () => {
      // Arrange
      const invalidData = {
        ...validRegisterData,
        password: 'weak'
      };

      // Act
      const result = await authService.register(invalidData);

      // Assert
      expect(result).toBeApiError('Password must be at least 8 characters long and contain letters and numbers');
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should use default role when none provided', async () => {
      // Arrange
      const dataWithoutRole = {
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User'
      };

      const mockCreatedUser = global.testUtils.createTestUser({
        email: dataWithoutRole.email,
        name: dataWithoutRole.name,
        role: 'employee'
      });

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await authService.register(dataWithoutRole);

      // Assert
      expect(result).toBeApiSuccess();
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'employee'
        })
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token and return user', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser();
      const token = authService._generateToken(mockUser);
      
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result).toBeApiSuccess();
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
      expect(result.decoded).toBeDefined();
      expect(result.decoded.userId).toBe(mockUser.id);
    });

    it('should fail verification with no token', async () => {
      // Act
      const result = await authService.verifyToken('');

      // Assert
      expect(result).toBeApiError('No token provided');
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail verification with invalid token', async () => {
      // Arrange
      const invalidToken = 'invalid.token.here';

      // Act
      const result = await authService.verifyToken(invalidToken);

      // Assert
      expect(result).toBeApiError();
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail verification when user not found', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser();
      const token = authService._generateToken(mockUser);
      
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(result).toBeApiError('User not found or inactive');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('changePassword', () => {
    const userId = 'test-user-id';
    const currentPassword = 'oldPassword123';
    const newPassword = 'newPassword456';

    it('should change password with valid data', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser({ id: userId });
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.verifyPassword.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({ ...mockUser, password: 'new-hashed-password' });

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBeApiSuccess();
      expect(result.message).toBe('Password changed successfully');
      expect(mockUserRepository.verifyPassword).toHaveBeenCalledWith(currentPassword, mockUser.password);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, { password: newPassword });
    });

    it('should fail with incorrect current password', async () => {
      // Arrange
      const mockUser = global.testUtils.createTestUser({ id: userId });
      
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.verifyPassword.mockResolvedValue(false);

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBeApiError('Current password is incorrect');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should fail with weak new password', async () => {
      // Arrange
      const weakPassword = 'weak';
      
      // Act
      const result = await authService.changePassword(userId, currentPassword, weakPassword);

      // Assert
      expect(result).toBeApiError('New password must be at least 8 characters long and contain letters and numbers');
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when user not found', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(result).toBeApiError('User not found');
      expect(mockUserRepository.verifyPassword).not.toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin users regardless of permission', async () => {
      // Arrange
      const adminUser = global.testUtils.createTestUser({ role: 'admin' });

      // Act & Assert
      expect(authService.hasPermission(adminUser, 'canDeleteRecords')).toBe(true);
      expect(authService.hasPermission(adminUser, 'canManageUsers')).toBe(true);
      expect(authService.hasPermission(adminUser, 'nonExistentPermission')).toBe(true);
    });

    it('should return true when user has specific permission', async () => {
      // Arrange
      const user = global.testUtils.createTestUser({
        role: 'manager',
        permissions: { canViewReports: true, canManageInventory: false }
      });

      // Act & Assert
      expect(authService.hasPermission(user, 'canViewReports')).toBe(true);
      expect(authService.hasPermission(user, 'canManageInventory')).toBe(false);
      expect(authService.hasPermission(user, 'canDeleteRecords')).toBe(false);
    });

    it('should return false when user lacks permission', async () => {
      // Arrange
      const user = global.testUtils.createTestUser({
        role: 'employee',
        permissions: { canViewReports: false }
      });

      // Act & Assert
      expect(authService.hasPermission(user, 'canViewReports')).toBe(false);
      expect(authService.hasPermission(user, 'canManageUsers')).toBe(false);
    });

    it('should handle null user gracefully', async () => {
      // Act & Assert
      expect(authService.hasPermission(null, 'canViewReports')).toBe(false);
      expect(authService.hasPermission(undefined, 'canViewReports')).toBe(false);
    });
  });

  describe('logout', () => {
    it('should return success for logout', async () => {
      // Arrange
      const token = 'some.jwt.token';

      // Act
      const result = await authService.logout(token);

      // Assert
      expect(result).toBeApiSuccess();
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
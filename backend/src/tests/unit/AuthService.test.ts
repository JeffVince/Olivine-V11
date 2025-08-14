// Mock bcrypt
const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn()
};

jest.mock('bcrypt', () => mockBcrypt);

import { AuthService } from '../../services/AuthService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PostgresService } from '../../services/PostgresService';

// Mock services
jest.mock('../../services/PostgresService');

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockPostgresService: jest.Mocked<PostgresService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Postgres service
    mockPostgresService = new PostgresService() as jest.Mocked<PostgresService>;
    mockPostgresService.executeQuery = jest.fn();
    mockPostgresService.healthCheck = jest.fn().mockResolvedValue(true);
    mockPostgresService.close = jest.fn().mockResolvedValue(undefined);
    
    authService = new AuthService();
    (authService as any).postgresService = mockPostgresService;
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'test_password';
      const hashedPassword = 'hashed_password';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      
      const result = await authService.hashPassword(password);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, (authService as any).saltRounds);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('comparePasswords', () => {
    it('should compare password with hash using bcrypt', async () => {
      const password = 'test_password';
      const hash = 'hashed_password';
      const isMatch = true;
      
      mockBcrypt.compare.mockResolvedValue(isMatch);
      
      const result = await authService.comparePasswords(password, hash);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(isMatch);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with user data', () => {
      const userId = 'test_user_id';
      const orgId = 'test_org_id';
      const role = 'user';
      const token = 'generated_token';
      
      (jwt.sign as jest.Mock).mockReturnValue(token);
      
      const result = authService.generateToken(userId, orgId, role);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId, orgId, role },
        (authService as any).jwtSecret,
        { expiresIn: '24h', issuer: 'olivine' }
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify JWT token and return payload', () => {
      const token = 'test_token';
      const payload = { userId: 'test_user_id', orgId: 'test_org_id', role: 'user' };
      
      (jwt.verify as jest.Mock).mockReturnValue(payload);
      
      const result = authService.verifyToken(token);
      
      expect(jwt.verify).toHaveBeenCalledWith(token, (authService as any).jwtSecret);
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid_token';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => authService.verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'test_password';
      const userId = 'user_id';
      const orgId = 'org_id';
      const role = 'user';
      const hashedPassword = 'hashed_test_password';
      const token = 'jwt_token';
      
      // Mock database query result
      mockPostgresService.executeQuery.mockResolvedValue({
        rows: [{
          id: userId,
          email,
          password_hash: hashedPassword,
          orgId: orgId,
          role
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });
      
      // Mock password comparison to return true
      mockBcrypt.compare.mockResolvedValue(true);
      
      // Mock JWT token generation
      (jwt.sign as jest.Mock).mockReturnValue(token);
      
      const result = await authService.authenticateUser(email, password);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId, orgId, role },
        (authService as any).jwtSecret,
        { expiresIn: '24h', issuer: 'olivine' }
      );
      expect(result).toEqual({ token, userId, orgId, role });
    });

    it('should return null for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'test_password';
      
      // Mock database query result with no rows
      mockPostgresService.executeQuery.mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
      
      const result = await authService.authenticateUser(email, password);
      
      expect(result).toBeNull();
    });

    it('should return null for incorrect password', async () => {
      const email = 'test@example.com';
      const password = 'wrong_password';
      const hashedPassword = 'hashed_correct_password';
      
      // Mock database query result
      mockPostgresService.executeQuery.mockResolvedValue({
        rows: [{
          id: 'user_id',
          email,
          password_hash: hashedPassword,
          org_id: 'org_id'
        }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      });
      
      // Mock password comparison to return false
      mockBcrypt.compare.mockResolvedValue(false);
      
      const result = await authService.authenticateUser(email, password);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBeNull();
    });

    it('should update last_login timestamp after successful authentication', async () => {
      const email = 'test@example.com';
      const password = 'test_password';
      const userId = 'user_id';
      const orgId = 'org_id';
      const hashedPassword = 'hashed_test_password';
      
      // Mock database query results
      mockPostgresService.executeQuery
        .mockResolvedValueOnce({
          rows: [{
            id: userId,
            email,
            password_hash: hashedPassword,
            org_id: orgId
          }],
          command: 'SELECT',
          rowCount: 1,
          oid: 0,
          fields: []
        })
        .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] }); // For the update query
      
      // Mock password comparison
      mockBcrypt.compare.mockResolvedValue(true);
      
      await authService.authenticateUser(email, password);
      
      expect(mockPostgresService.executeQuery).toHaveBeenNthCalledWith(
        2,
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [userId]
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when Postgres service is healthy', async () => {
      mockPostgresService.healthCheck.mockResolvedValue(true);
      
      const isHealthy = await authService.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockPostgresService.healthCheck).toHaveBeenCalled();
    });

    it('should return false when Postgres service is not healthy', async () => {
      mockPostgresService.healthCheck.mockResolvedValue(false);
      
      const isHealthy = await authService.healthCheck();
      
      expect(isHealthy).toBe(false);
    });

    it('should handle errors during health check', async () => {
      mockPostgresService.healthCheck.mockRejectedValue(new Error('Connection failed'));
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const isHealthy = await authService.healthCheck();
      
      expect(isHealthy).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Auth service health check failed:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close Postgres connection', async () => {
      await authService.close();
      
      expect(mockPostgresService.close).toHaveBeenCalled();
    });
  });
});

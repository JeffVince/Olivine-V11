"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mockBcrypt = {
    hash: jest.fn(),
    compare: jest.fn(),
    genSalt: jest.fn()
};
jest.mock('bcrypt', () => mockBcrypt);
const AuthService_1 = require("../../services/AuthService");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const PostgresService_1 = require("../../services/PostgresService");
jest.mock('../../services/PostgresService');
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn()
}));
describe('AuthService', () => {
    let authService;
    let mockPostgresService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockPostgresService = new PostgresService_1.PostgresService();
        mockPostgresService.executeQuery = jest.fn();
        mockPostgresService.healthCheck = jest.fn().mockResolvedValue(true);
        mockPostgresService.close = jest.fn().mockResolvedValue(undefined);
        authService = new AuthService_1.AuthService();
        authService.postgresService = mockPostgresService;
    });
    describe('hashPassword', () => {
        it('should hash password using bcrypt', async () => {
            const password = 'test_password';
            const hashedPassword = 'hashed_password';
            mockBcrypt.hash.mockResolvedValue(hashedPassword);
            const result = await authService.hashPassword(password);
            expect(bcrypt_1.default.hash).toHaveBeenCalledWith(password, authService.saltRounds);
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
            expect(bcrypt_1.default.compare).toHaveBeenCalledWith(password, hash);
            expect(result).toBe(isMatch);
        });
    });
    describe('generateToken', () => {
        it('should generate JWT token with user data', () => {
            const userId = 'test_user_id';
            const orgId = 'test_org_id';
            const role = 'user';
            const token = 'generated_token';
            jsonwebtoken_1.default.sign.mockReturnValue(token);
            const result = authService.generateToken(userId, orgId, role);
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalledWith({ userId, orgId, role }, authService.jwtSecret, { expiresIn: '24h', issuer: 'olivine' });
            expect(result).toBe(token);
        });
    });
    describe('verifyToken', () => {
        it('should verify JWT token and return payload', () => {
            const token = 'test_token';
            const payload = { userId: 'test_user_id', orgId: 'test_org_id', role: 'user' };
            jsonwebtoken_1.default.verify.mockReturnValue(payload);
            const result = authService.verifyToken(token);
            expect(jsonwebtoken_1.default.verify).toHaveBeenCalledWith(token, authService.jwtSecret);
            expect(result).toEqual(payload);
        });
        it('should throw error for invalid token', () => {
            const token = 'invalid_token';
            jsonwebtoken_1.default.verify.mockImplementation(() => {
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
            mockBcrypt.compare.mockResolvedValue(true);
            jsonwebtoken_1.default.sign.mockReturnValue(token);
            const result = await authService.authenticateUser(email, password);
            expect(bcrypt_1.default.compare).toHaveBeenCalledWith(password, hashedPassword);
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalledWith({ userId, orgId, role }, authService.jwtSecret, { expiresIn: '24h', issuer: 'olivine' });
            expect(result).toEqual({ token, userId, orgId, role });
        });
        it('should return null for non-existent user', async () => {
            const email = 'nonexistent@example.com';
            const password = 'test_password';
            mockPostgresService.executeQuery.mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
            const result = await authService.authenticateUser(email, password);
            expect(result).toBeNull();
        });
        it('should return null for incorrect password', async () => {
            const email = 'test@example.com';
            const password = 'wrong_password';
            const hashedPassword = 'hashed_correct_password';
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
            mockBcrypt.compare.mockResolvedValue(false);
            const result = await authService.authenticateUser(email, password);
            expect(bcrypt_1.default.compare).toHaveBeenCalledWith(password, hashedPassword);
            expect(result).toBeNull();
        });
        it('should update last_login timestamp after successful authentication', async () => {
            const email = 'test@example.com';
            const password = 'test_password';
            const userId = 'user_id';
            const orgId = 'org_id';
            const hashedPassword = 'hashed_test_password';
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
                .mockResolvedValueOnce({ rows: [], command: 'SELECT', rowCount: 0, oid: 0, fields: [] });
            mockBcrypt.compare.mockResolvedValue(true);
            await authService.authenticateUser(email, password);
            expect(mockPostgresService.executeQuery).toHaveBeenNthCalledWith(2, 'UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
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
            expect(consoleErrorSpy).toHaveBeenCalledWith('Auth service health check failed:', expect.any(Error));
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
//# sourceMappingURL=AuthService.test.js.map
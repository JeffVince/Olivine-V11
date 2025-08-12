"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const PostgresService_1 = require("./PostgresService");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
class AuthService {
    constructor() {
        this.postgresService = new PostgresService_1.PostgresService();
        this.jwtSecret = process.env.JWT_SECRET || 'default_secret';
        this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
    }
    async hashPassword(password) {
        return await bcrypt_1.default.hash(password, this.saltRounds);
    }
    async comparePasswords(password, hash) {
        return await bcrypt_1.default.compare(password, hash);
    }
    generateToken(userId, orgId, role) {
        const payload = {
            userId,
            orgId,
            role
        };
        const options = {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            issuer: process.env.JWT_ISSUER || 'olivine'
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, options);
    }
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.jwtSecret);
        }
        catch (error) {
            console.error('Error verifying JWT token:', error);
            throw error;
        }
    }
    async authenticateUser(email, password) {
        try {
            const result = await this.postgresService.executeQuery('SELECT id, organization_id, password_hash, role FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                return null;
            }
            const user = result.rows[0];
            const isPasswordValid = await this.comparePasswords(password, user.password_hash);
            if (!isPasswordValid) {
                return null;
            }
            const token = this.generateToken(user.id, user.organization_id, user.role);
            await this.postgresService.executeQuery('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
            return {
                userId: user.id,
                orgId: user.organization_id,
                role: user.role,
                token
            };
        }
        catch (error) {
            console.error('Error authenticating user:', error);
            return null;
        }
    }
    async healthCheck() {
        try {
            const dbHealthy = await this.postgresService.healthCheck();
            const secretSet = this.jwtSecret !== 'default_secret';
            return dbHealthy && secretSet;
        }
        catch (error) {
            console.error('Auth service health check failed:', error);
            return false;
        }
    }
    async getUserById(userId) {
        try {
            const result = await this.postgresService.executeQuery('SELECT id, organization_id, email, role, created_at, last_login FROM users WHERE id = $1', [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            const user = result.rows[0];
            return {
                id: user.id,
                orgId: user.organization_id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at,
                lastLogin: user.last_login
            };
        }
        catch (error) {
            console.error('Error fetching user by ID:', error);
            return null;
        }
    }
    async close() {
        await this.postgresService.close();
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map
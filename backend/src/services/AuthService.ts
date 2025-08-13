import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PostgresService } from './PostgresService';
import { config } from 'dotenv';

// Load environment variables
config();

export class AuthService {
  // TODO: Implementation Plan - 05-Security-Implementation.md - Authentication service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend authentication service tests
  private postgresService: PostgresService;
  private jwtSecret: string;
  private saltRounds: number;

  constructor() {
    this.postgresService = new PostgresService();
    this.jwtSecret = process.env.JWT_SECRET || 'default_secret';
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
  }

  /**
   * Hash a password using bcrypt
   * @param password Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare a plain text password with a hashed password
   * @param password Plain text password
   * @param hash Hashed password
   * @returns Boolean indicating if passwords match
   */
  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token for a user
   * @param userId User ID
   * @param orgId Organization ID
   * @param role User role
   * @returns JWT token
   */
  generateToken(userId: string, orgId: string, role: string): string {
    const payload = {
      userId,
      orgId,
      role
    };

    const options = {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: process.env.JWT_ISSUER || 'olivine'
    };

    return jwt.sign(payload, this.jwtSecret, options as jwt.SignOptions);
  }

  /**
   * Verify a JWT token
   * @param token JWT token
   * @returns Decoded token payload
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      console.error('Error verifying JWT token:', error);
      throw error;
    }
  }

  /**
   * Authenticate a user with email and password
   * @param email User email
   * @param password User password
   * @returns User object with token if authentication is successful
   */
  async authenticateUser(email: string, password: string): Promise<any> {
    try {
      // Find user by email
      const result = await this.postgresService.executeQuery(
        'SELECT id, organization_id, password_hash, role, name, avatar_url, notification_prefs FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      // Compare passwords
      const isPasswordValid = await this.comparePasswords(password, user.password_hash);
      
      if (!isPasswordValid) {
        return null;
      }

      // Generate token
      const token = this.generateToken(user.id, user.organization_id, user.role);

      // Update last login
      await this.postgresService.executeQuery(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      return {
        userId: user.id,
        orgId: user.organization_id,
        role: user.role,
        name: user.name,
        avatar: user.avatar_url,
        notificationPrefs: user.notification_prefs,
        token
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  /**
   * Health check for auth service
   * @returns Boolean indicating if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      const dbHealthy = await this.postgresService.healthCheck();
      
      // Test JWT secret is set
      const secretSet = this.jwtSecret !== 'default_secret';
      
      return dbHealthy && secretSet;
    } catch (error) {
      console.error('Auth service health check failed:', error);
      return false;
    }
  }

  /**
   * Get user by ID
   * @param userId User ID
   * @returns User object
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const result = await this.postgresService.executeQuery(
        'SELECT id, organization_id, email, role, name, avatar_url, notification_prefs, created_at, last_login FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        orgId: user.organization_id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatar: user.avatar_url,
        notificationPrefs: user.notification_prefs,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.postgresService.close();
  }
}

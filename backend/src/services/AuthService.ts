import { OlivineAuth, JwtPayload } from '../../../sdk/auth';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from './PostgresService';
import { TenantService } from './TenantService';
import { config } from 'dotenv';

// Load environment variables
config();

export class AuthService {
  // TODO: Implementation Plan - 05-Security-Implementation.md - Authentication service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend authentication service tests
  private postgresService: PostgresService;
  private tenantService: TenantService;
  private jwtSecret: string;
  private saltRounds: number;

  constructor() {
    this.postgresService = new PostgresService();
    this.tenantService = new TenantService();
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
    const payload: JwtPayload = {
      userId,
      orgId,
      role
    };

    return OlivineAuth.sign(payload, this.jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: process.env.JWT_ISSUER || 'olivine'
    });
  }

  /**
   * JWT payload
   */
  public static JwtPayloadGuard(payload: any): payload is JwtPayload {
    return payload && typeof payload.userId === 'string' && typeof payload.orgId === 'string';
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      const payload = OlivineAuth.verify(token, this.jwtSecret);
      if (!AuthService.JwtPayloadGuard(payload)) {
        throw new Error('Invalid JWT payload structure');
      }
      return payload;
    } catch (error) {
      console.error('Error verifying JWT token:', error);
      throw error;
    }
  }

  /**
   * Authenticate a user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<{ token: string; userId: string; orgId: string; role: string } | null> {
    try {
      // Find user by email
      const result = await this.postgresService.executeQuery(
        'SELECT id, org_id, password_hash, role, first_name, last_name FROM users WHERE email = $1',
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
      const token = this.generateToken(user.id, user.org_id, user.role);

      // Update last login
      await this.postgresService.executeQuery(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      return {
        token,
        userId: user.id,
        orgId: user.org_id,
        role: user.role
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  /**
   * Register a new organization and user
   */
  async register(orgName: string, email: string, password: string): Promise<{ token: string; userId: string; orgId: string; role: string }> {
    try {
      // Create organization in Neo4j first
      const neo4jOrg = await this.tenantService.createOrganization({
        name: orgName,
        status: 'active'
      });
      const orgId = neo4jOrg.id;

      // Create organization in PostgreSQL using the same ID
      await this.postgresService.executeQuery(
        'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
        [orgId, orgName, orgName.toLowerCase().replace(/\s+/g, '-')]
      );

      const passwordHash = await this.hashPassword(password);
      const userId = uuidv4();
      const userResult = await this.postgresService.executeQuery(
        'INSERT INTO users (id, email, password_hash, org_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, role',
        [userId, email, passwordHash, orgId, 'admin']
      );
      const role = userResult.rows[0].role as string;

      const token = this.generateToken(userId, orgId, role);
      return { token, userId, orgId, role };
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
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
  async getUserById(userId: string): Promise<{ id: string; orgId: string; email: string; role: string; name: string; avatar: string; notificationPrefs: Record<string, unknown>; createdAt: Date; lastLogin: Date } | null> {
    try {
      const result = await this.postgresService.executeQuery(
        'SELECT id, org_id, email, role, first_name, last_name, created_at, last_login FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        orgId: user.org_id,
        email: user.email,
        role: user.role,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        avatar: '',
        notificationPrefs: {},
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Error getting user by ID:', error);
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


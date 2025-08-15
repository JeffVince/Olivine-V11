import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
  scopes?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
}

export class OlivineAuth {
  private apiKey: string;
  private orgId: string;

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  /**
   * Return headers containing the Authorization bearer token
   */
  authHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  /**
   * Validate that the API key contains the required scopes
   */
  validateScopes(requiredScopes: string[]): boolean {
    const payload = jwt.decode(this.apiKey) as JwtPayload | null;
    const scopes = payload?.scopes || [];
    return requiredScopes.every(scope => scopes.includes(scope));
  }

  /**
   * Sign a JWT payload with the provided secret
   */
  static sign(payload: JwtPayload, secret: string, options: SignOptions = {}): string {
    const defaultOptions: SignOptions = {
      expiresIn: '24h',
      issuer: 'olivine',
      ...options
    };
    return jwt.sign(payload, secret, defaultOptions);
  }

  /**
   * Verify a JWT token and ensure it contains the required scopes
   */
  static verify(token: string, secret: string, requiredScopes: string[] = []): JwtPayload {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const scopes = decoded.scopes || [];
    for (const scope of requiredScopes) {
      if (!scopes.includes(scope)) {
        throw new Error(`Missing required scope: ${scope}`);
      }
    }
    return decoded;
  }
}


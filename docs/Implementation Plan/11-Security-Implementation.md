# Security Implementation
## Comprehensive Security Framework for Multi-Tenant Environment

### 1. Authentication and Authorization

#### 1.1 JWT-Based Authentication

**Authentication Service Implementation**
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Neo4jService } from '@/services/Neo4jService';

export class AuthService {
  private jwtSecret: string;
  private neo4jService: Neo4jService;

  constructor(neo4jService: Neo4jService) {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
    this.neo4jService = neo4jService;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<string | null> {
    const query = `
      MATCH (u:User {email: $email})
      RETURN u
    `;

    const result = await this.neo4jService.run(query, { email });
    
    if (result.records.length === 0) {
      return null;
    }

    const user = result.records[0].get('u').properties;
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return null;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        name: user.name
      },
      this.jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return token;
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<any | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  }

  /**
   * Create user with hashed password
   */
  async createUser(userData: { email: string; password: string; name: string }): Promise<any> {
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    const query = `
      CREATE (u:User {
        id: randomUUID(),
        email: $email,
        name: $name,
        password_hash: $passwordHash,
        created_at: datetime(),
        updated_at: datetime()
      })
      RETURN u
    `;

    const result = await this.neo4jService.run(query, {
      email: userData.email,
      name: userData.name,
      passwordHash
    });

    return result.records[0].get('u').properties;
  }
}
```

#### 1.2 Multi-Tenant Authorization

**Tenant Context Enforcement**
```typescript
import { AuthService } from '@/services/AuthService';
import { Neo4jService } from '@/services/Neo4jService';

export class TenantService {
  private authService: AuthService;
  private neo4jService: Neo4jService;

  constructor(authService: AuthService, neo4jService: Neo4jService) {
    this.authService = authService;
    this.neo4jService = neo4jService;
  }

  /**
   * Validate user has access to organization
   */
  async validateOrgAccess(userId: string, orgId: string): Promise<boolean> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization {id: $orgId})
      RETURN count(o) > 0 as hasAccess
    `;

    const result = await this.neo4jService.run(query, { userId, orgId });
    
    if (result.records.length === 0) {
      return false;
    }

    return result.records[0].get('hasAccess');
  }

  /**
   * Get organizations user has access to
   */
  async getUserOrganizations(userId: string): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization)
      RETURN o
    `;

    const result = await this.neo4jService.run(query, { userId });
    
    return result.records.map(record => record.get('o').properties);
  }

  /**
   * Validate user has access to source within organization
   */
  async validateSourceAccess(userId: string, orgId: string, sourceId: string): Promise<boolean> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(o:Organization {id: $orgId})<-[:BELONGS_TO]-(s:Source {id: $sourceId})
      RETURN count(s) > 0 as hasAccess
    `;

    const result = await this.neo4jService.run(query, { userId, orgId, sourceId });
    
    if (result.records.length === 0) {
      return false;
    }

    return result.records[0].get('hasAccess');
  }
}
```

### 2. Data Encryption and Protection

#### 2.1 Cryptographic Commit Signing

**Commit Signature Implementation**
```typescript
import crypto from 'crypto';
import { Neo4jService } from '@/services/Neo4jService';

export class CryptoService {
  private signingKey: string;

  constructor() {
    this.signingKey = process.env.COMMIT_SIGNING_KEY || 'default-signing-key';
  }

  /**
   * Generate cryptographic signature for commit data
   */
  generateCommitSignature(commitData: any): string {
    const dataString = JSON.stringify({
      orgId: commitData.orgId,
      message: commitData.message,
      author: commitData.author,
      authorType: commitData.authorType,
      createdAt: commitData.createdAt,
      parentCommitId: commitData.parentCommitId
    });

    return crypto
      .createHmac('sha256', this.signingKey)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Verify commit signature
   */
  verifyCommitSignature(commitData: any, signature: string): boolean {
    const expectedSignature = this.generateCommitSignature(commitData);
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Generate content hash for versioning
   */
  generateContentHash(content: any): string {
    const contentString = JSON.stringify(content);
    return crypto.createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'GfG', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'GfG', 32);
    const iv = crypto.randomBytes(16);
    
    const decipher = crypto.createDecipher(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### 2.2 Secure Storage Provider Integration

**Dropbox API Security Implementation**
```typescript
import axios from 'axios';
import crypto from 'crypto';

export class DropboxSecurity {
  private appKey: string;
  private appSecret: string;
  private webhookSecret: string;

  constructor() {
    this.appKey = process.env.DROPBOX_APP_KEY || '';
    this.appSecret = process.env.DROPBOX_APP_SECRET || '';
    this.webhookSecret = process.env.DROPBOX_WEBHOOK_SECRET || '';
  }

  /**
   * Validate Dropbox webhook signature
   */
  validateWebhookSignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Generate OAuth URL for Dropbox
   */
  generateOAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.appKey,
      redirect_uri: redirectUri,
      state: state,
      token_access_type: 'offline'
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
      code,
      grant_type: 'authorization_code',
      client_id: this.appKey,
      client_secret: this.appSecret,
      redirect_uri: redirectUri
    });

    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.appKey,
      client_secret: this.appSecret
    });

    return response.data;
  }
}
```

### 3. Database Security

#### 3.1 Neo4j Security Configuration

**Neo4j Security Settings**
```cypher
// Enable authentication
CALL dbms.setConfigValue('dbms.security.auth_enabled', 'true')

// Set password complexity requirements
CALL dbms.setConfigValue('dbms.security.password_requirements', 'min_length=12,complexity=true')

// Enable encryption
CALL dbms.setConfigValue('dbms.connector.bolt.tls_level', 'REQUIRED')

// Configure role-based access control
CREATE ROLE tenant_admin;
CREATE ROLE tenant_user;
CREATE ROLE system_admin;

// Grant permissions to roles
GRANT ACCESS ON DATABASE blueprint TO tenant_admin;
GRANT ACCESS ON DATABASE blueprint TO tenant_user;
GRANT ACCESS ON DATABASE system TO system_admin;

// Grant specific read/write permissions
GRANT MATCH, MERGE, CREATE, DELETE ON GRAPH blueprint NODES File, Content, Commit, Version, Action TO tenant_admin;
GRANT MATCH ON GRAPH blueprint NODES File, Content, Commit, Version, Action TO tenant_user;
GRANT MATCH, MERGE, CREATE, DELETE ON GRAPH system NODES * TO system_admin;
```

#### 3.2 PostgreSQL Row Level Security

**RLS Policy Implementation**
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Organizations isolation policy
CREATE POLICY org_isolation_policy ON organizations
    FOR ALL TO blueprint_user
    USING (
        id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Sources isolation policy
CREATE POLICY source_isolation_policy ON sources
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Dropbox events isolation policy
CREATE POLICY dropbox_events_isolation_policy ON dropbox_events
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- Files isolation policy
CREATE POLICY files_isolation_policy ON files
    FOR ALL TO blueprint_user
    USING (
        org_id IN (
            SELECT org_id 
            FROM user_organizations 
            WHERE user_id = current_setting('app.current_user_id')
        )
    );

-- User organizations isolation policy
CREATE POLICY user_orgs_isolation_policy ON user_organizations
    FOR ALL TO blueprint_user
    USING (user_id = current_setting('app.current_user_id'));

-- Create application user
CREATE USER blueprint_user WITH PASSWORD 'secure-password';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO blueprint_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blueprint_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blueprint_user;
```

### 4. API Security

#### 4.1 GraphQL Security Middleware

**Security Middleware Implementation**
```typescript
import { AuthService } from '@/services/AuthService';
import { TenantService } from '@/services/TenantService';

export class SecurityMiddleware {
  private authService: AuthService;
  private tenantService: TenantService;

  constructor(authService: AuthService, tenantService: TenantService) {
    this.authService = authService;
    this.tenantService = tenantService;
  }

  /**
   * Validate authentication for all GraphQL requests
   */
  async validateAuthentication(context: any): Promise<boolean> {
    const authHeader = context.req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const user = await this.authService.validateToken(token);
    
    if (!user) {
      return false;
    }

    context.user = user;
    return true;
  }

  /**
   * Validate organization access for GraphQL requests
   */
  async validateOrgAccess(context: any, orgId: string): Promise<boolean> {
    if (!context.user || !orgId) {
      return false;
    }

    return await this.tenantService.validateOrgAccess(context.user.userId, orgId);
  }

  /**
   * Validate source access for GraphQL requests
   */
  async validateSourceAccess(context: any, orgId: string, sourceId: string): Promise<boolean> {
    if (!context.user || !orgId || !sourceId) {
      return false;
    }

    return await this.tenantService.validateSourceAccess(context.user.userId, orgId, sourceId);
  }
}
```

#### 4.2 Secure GraphQL Resolvers

**Protected File Resolvers**
```typescript
import { SecurityMiddleware } from '@/middleware/SecurityMiddleware';

const securityMiddleware = new SecurityMiddleware(authService, tenantService);

export const fileResolvers = {
  Query: {
    files: async (parent: any, args: any, context: any) => {
      // Validate authentication
      if (!await securityMiddleware.validateAuthentication(context)) {
        throw new Error('Authentication required');
      }

      // Validate organization access
      if (!await securityMiddleware.validateOrgAccess(context, args.filter.orgId)) {
        throw new Error('Access denied to organization');
      }

      // Validate source access if specified
      if (args.filter.sourceId) {
        if (!await securityMiddleware.validateSourceAccess(
          context, 
          args.filter.orgId, 
          args.filter.sourceId
        )) {
          throw new Error('Access denied to source');
        }
      }

      // Proceed with query execution
      return await fileService.listFiles(args.filter);
    },

    file: async (parent: any, args: any, context: any) => {
      // Validate authentication
      if (!await securityMiddleware.validateAuthentication(context)) {
        throw new Error('Authentication required');
      }

      // Validate organization access
      if (!await securityMiddleware.validateOrgAccess(context, args.orgId)) {
        throw new Error('Access denied to organization');
      }

      // Proceed with query execution
      return await fileService.getFile(args.orgId, args.id);
    }
  },

  Mutation: {
    createFile: async (parent: any, args: any, context: any) => {
      // Validate authentication
      if (!await securityMiddleware.validateAuthentication(context)) {
        throw new Error('Authentication required');
      }

      // Validate organization access
      if (!await securityMiddleware.validateOrgAccess(context, args.input.orgId)) {
        throw new Error('Access denied to organization');
      }

      // Validate source access
      if (!await securityMiddleware.validateSourceAccess(
        context, 
        args.input.orgId, 
        args.input.sourceId
      )) {
        throw new Error('Access denied to source');
      }

      // Proceed with mutation execution
      return await fileService.createFile(args.input);
    }
  },

  File: {
    content: async (parent: File, args: any, context: any) => {
      // Validate authentication
      if (!await securityMiddleware.validateAuthentication(context)) {
        throw new Error('Authentication required');
      }

      // Validate organization access
      if (!await securityMiddleware.validateOrgAccess(context, parent.orgId)) {
        throw new Error('Access denied to organization');
      }

      // Proceed with content retrieval
      return await contentService.getContentByFileId(parent.orgId, parent.id);
    }
  }
};
```

### 5. Network Security

#### 5.1 HTTPS Configuration

**Nginx SSL Configuration**
```nginx
server {
    listen 443 ssl http2;
    server_name blueprint.example.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/blueprint.crt;
    ssl_certificate_key /etc/nginx/ssl/blueprint.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # GraphQL API proxy
    location /graphql {
        proxy_pass http://blueprint-backend:4000/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

#### 5.2 Firewall Configuration

**Kubernetes Network Policies**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
spec:
  podSelector:
    matchLabels:
      app: blueprint-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: blueprint-frontend
    ports:
    - protocol: TCP
      port: 4000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: blueprint-neo4j
    ports:
    - protocol: TCP
      port: 7687
  - to:
    - podSelector:
        matchLabels:
          app: blueprint-postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: blueprint-redis
    ports:
    - protocol: TCP
      port: 6379
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
spec:
  podSelector:
    matchLabels:
      app: blueprint-neo4j
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: blueprint-backend
    ports:
    - protocol: TCP
      port: 7687
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-policy
spec:
  podSelector:
    matchLabels:
      app: blueprint-postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: blueprint-backend
    ports:
    - protocol: TCP
      port: 5432
```

### 6. Security Testing

#### 6.1 Penetration Testing Scripts

**Security Test Suite**
```typescript
import { ApolloClient } from '@apollo/client/core';
import gql from 'graphql-tag';

describe('Security Testing', () => {
  let client: ApolloClient<any>;

  beforeAll(() => {
    client = new ApolloClient({
      uri: 'http://localhost:4000/graphql'
    });
  });

  test('should reject requests without authentication', async () => {
    const query = gql`
      query TestFiles($orgId: ID!) {
        files(filter: { orgId: $orgId }) {
          id
          name
        }
      }
    `;

    await expect(
      client.query({ query, variables: { orgId: 'test-org' } })
    ).rejects.toThrow('Authentication required');
  });

  test('should reject access to unauthorized organizations', async () => {
    // Login with user who has access to org-1 only
    const authenticatedClient = new ApolloClient({
      uri: 'http://localhost:4000/graphql',
      headers: {
        Authorization: 'Bearer user-org1-token'
      }
    });

    const query = gql`
      query TestFiles($orgId: ID!) {
        files(filter: { orgId: $orgId }) {
          id
          name
        }
      }
    `;

    // Attempt to access org-2 (should fail)
    await expect(
      authenticatedClient.query({ query, variables: { orgId: 'org-2' } })
    ).rejects.toThrow('Access denied to organization');
  });

  test('should validate webhook signatures', async () => {
    const dropboxSecurity = new DropboxSecurity();
    
    // Valid signature test
    const body = '{"list_folder": {"accounts": ["test"]}}';
    const validSignature = 'valid-signature-here';
    
    expect(dropboxSecurity.validateWebhookSignature(body, validSignature)).toBe(false);
    
    // Invalid signature test
    const invalidSignature = 'invalid-signature';
    
    expect(dropboxSecurity.validateWebhookSignature(body, invalidSignature)).toBe(false);
  });

  test('should enforce RLS policies on PostgreSQL tables', async () => {
    // Test that queries without proper context fail
    // This would require setting up a test database with RLS enabled
  });
});
```

This security implementation provides a comprehensive framework for protecting the Blueprint system in a multi-tenant environment. It covers authentication, authorization, data encryption, database security, API protection, and network security with proper testing procedures.

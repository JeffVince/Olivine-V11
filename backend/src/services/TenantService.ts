import { Neo4jService } from './Neo4jService';
import * as fs from 'fs';
import * as path from 'path';

// Interfaces for type safety
export interface Organization {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'suspended' | 'archived';
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, unknown>;
}

export interface User {
  orgId: string;
  [key: string]: unknown;
}

export interface UserPermission {
  userId: string;
  orgId: string;
  role: string;
  permissions: string[];
}

export interface Migration {
  version: string;
  description: string;
  steps: MigrationStep[];
}

export interface MigrationStep {
  type: 'constraint' | 'index' | 'data_migration';
  query: string;
  description?: string;
}

export interface MigrationHistory {
  version: string;
  description: string;
  applied_at: Date;
  org_id: string;
}

export class TenantService {
  private neo4jService: Neo4jService;

  constructor() {
    this.neo4jService = new Neo4jService();
  }

  /**
   * Validate that org_id is present in the request context
   * @param orgId Organization ID to validate
   * @returns Boolean indicating if org_id is valid
   */
  validateOrgId(orgId: string): boolean {
    if (!orgId || orgId.trim() === '') {
      console.error('Organization ID is required');
      return false;
    }
    return true;
  }

  /**
   * Add org_id to query parameters for multi-tenant filtering
   * @param params Existing query parameters
   * @param orgId Organization ID
   * @returns Query parameters with org_id included
   */
  addOrgIdToParams(params: Record<string, unknown>, orgId: string): Record<string, unknown> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }
    
    return {
      ...params,
      orgId: orgId
    };
  }

  /**
   * Create a tenant-specific query template
   * @param query Base query without org_id filtering
   * @returns Query template with org_id filtering
   */
  createTenantQueryTemplate(query: string): string {
    // Add org_id filtering to the query
    // This is a simple approach - in practice, you might want more sophisticated query building
    const tenantFilteredQuery = query.replace(
      /MATCH\s*\((\w+):(\w+)\)/gi,
      'MATCH ($1:$2 {orgId: $orgId})'
    ).replace(
      /CREATE\s*\((\w+):(\w+)\)/gi,
      'CREATE ($1:$2 {orgId: $orgId})'
    );
    
    return tenantFilteredQuery;
  }

  /**
   * Execute a query with tenant filtering
   * @param query Cypher query string
   * @param params Query parameters
   * @param orgId Organization ID for multi-tenant filtering
   * @returns Query result
   */
  async executeTenantQuery(query: string, params: Record<string, unknown> = {}, orgId: string): Promise<unknown> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }
    
    // Add org_id to params
    const tenantParams = this.addOrgIdToParams(params, orgId);
    
    // Execute query with Neo4j service
    return await this.neo4jService.executeQuery(query, tenantParams);
  }

  /**
   * Validate access for a user to a specific organization
   * @param user User object with orgId
   * @param orgId Organization ID to validate access for
   * @returns Boolean indicating if access is valid
   */
  async validateAccess(user: User, orgId: string): Promise<void> {
    if (!user || !user.orgId) {
      throw new Error('User organization information is required');
    }
    
    if (user.orgId !== orgId) {
      throw new Error('Access denied: User does not have access to this organization');
    }
  }

  /**
   * Get organization details by ID
   * @param orgId Organization ID
   * @returns Organization object
   */
  async getOrganization(orgId: string): Promise<Organization> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const query = `
      MATCH (org:Organization {id: $orgId})
      RETURN org
    `;
    
    const result = await this.neo4jService.executeQuery(query, { orgId });
    
    if (result.records.length === 0) {
      throw new Error('Organization not found');
    }
    
    const orgData = result.records[0].get('org').properties;
    return {
      id: orgData.id,
      name: orgData.name,
      description: orgData.description,
      status: orgData.status,
      created_at: new Date(orgData.created_at),
      updated_at: new Date(orgData.updated_at),
      metadata: orgData.metadata
    };
  }

  /**
   * Get user permissions for a specific organization
   * @param userId User ID
   * @param orgId Organization ID
   * @returns Array of user permissions
   */
  async getUserPermissions(userId: string, orgId: string): Promise<string[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization {id: $orgId})
      MATCH (u)-[:HAS_ROLE]->(role:Role)
      MATCH (role)-[:HAS_PERMISSION]->(perm:Permission)
      RETURN collect(perm.name) as permissions
    `;
    
    const result = await this.neo4jService.executeQuery(query, { userId, orgId });
    
    if (result.records.length === 0) {
      return [];
    }
    
    return result.records[0].get('permissions') || [];
  }

  /**
   * Validate cross-organization access for a user
   * @param userId User ID
   * @param targetOrgId Target organization ID
   * @returns Boolean indicating if cross-org access is allowed
   */
  async validateCrossOrgAccess(userId: string, targetOrgId: string): Promise<boolean> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization)
      WITH u, collect(org.id) as userOrgs
      MATCH (targetOrg:Organization {id: $targetOrgId})
      OPTIONAL MATCH (u)-[:HAS_CROSS_ORG_ACCESS]->(targetOrg)
      RETURN 
        $targetOrgId IN userOrgs as isMember,
        COUNT(targetOrg) > 0 as hasCrossAccess
    `;
    
    const result = await this.neo4jService.executeQuery(query, { userId, targetOrgId });
    
    if (result.records.length === 0) {
      return false;
    }
    
    const record = result.records[0];
    return record.get('isMember') || record.get('hasCrossAccess');
  }

  /**
   * Validate project access for a user
   * @param userId User ID
   * @param orgId Organization ID
   * @param projectId Project ID
   * @returns Boolean indicating if project access is allowed
   */
  async validateProjectAccess(userId: string, orgId: string, projectId: string): Promise<boolean> {
    // First validate organization access
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization {id: $orgId})
      MATCH (project:Project {id: $projectId})-[:BELONGS_TO]->(org)
      OPTIONAL MATCH (u)-[:CAN_ACCESS]->(project)
      RETURN 
        COUNT(org) > 0 as hasOrgAccess,
        COUNT(project) > 0 as projectExists,
        COUNT(*) > 0 as hasDirectAccess
    `;
    
    const result = await this.neo4jService.executeQuery(query, { userId, orgId, projectId });
    
    if (result.records.length === 0) {
      return false;
    }
    
    const record = result.records[0];
    return record.get('hasOrgAccess') && record.get('projectExists');
  }

  /**
   * Create a new organization with proper multi-tenant setup
   * @param orgData Organization data
   * @returns Created organization
   */
  async createOrganization(orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>): Promise<Organization> {
    const orgId = this.generateUUID();
    const now = new Date();

    const query = `
      CREATE (org:Organization {
        id: $orgId,
        name: $name,
        description: $description,
        status: $status,
        created_at: datetime($created_at),
        updated_at: datetime($updated_at),
        metadata: $metadata
      })
      RETURN org
    `;

    const params = {
      orgId,
      name: orgData.name,
      description: orgData.description || '',
      status: orgData.status || 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      metadata: orgData.metadata || {}
    };

    const result = await this.neo4jService.executeQuery(query, params);
    
    if (result.records.length === 0) {
      throw new Error('Failed to create organization');
    }

    const orgProperties = result.records[0].get('org').properties;
    return {
      id: orgProperties.id,
      name: orgProperties.name,
      description: orgProperties.description,
      status: orgProperties.status,
      created_at: new Date(orgProperties.created_at),
      updated_at: new Date(orgProperties.updated_at),
      metadata: orgProperties.metadata
    };
  }

  /**
   * Update an organization
   * @param orgId Organization ID
   * @param updateData Data to update
   * @returns Updated organization
   */
  async updateOrganization(orgId: string, updateData: Partial<Omit<Organization, 'id' | 'created_at'>>): Promise<Organization> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const setClause = [];
    const params: Record<string, unknown> = { orgId };

    if (updateData.name) {
      setClause.push('org.name = $name');
      params.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      setClause.push('org.description = $description');
      params.description = updateData.description;
    }
    if (updateData.status) {
      setClause.push('org.status = $status');
      params.status = updateData.status;
    }
    if (updateData.metadata) {
      setClause.push('org.metadata = $metadata');
      params.metadata = updateData.metadata;
    }

    setClause.push('org.updated_at = datetime($updated_at)');
    params.updated_at = new Date().toISOString();

    const query = `
      MATCH (org:Organization {id: $orgId})
      SET ${setClause.join(', ')}
      RETURN org
    `;

    const result = await this.neo4jService.executeQuery(query, params);
    
    if (result.records.length === 0) {
      throw new Error('Organization not found');
    }

    const orgProperties = result.records[0].get('org').properties;
    return {
      id: orgProperties.id,
      name: orgProperties.name,
      description: orgProperties.description,
      status: orgProperties.status,
      created_at: new Date(orgProperties.created_at),
      updated_at: new Date(orgProperties.updated_at),
      metadata: orgProperties.metadata
    };
  }

  /**
   * Get all organizations a user has access to
   * @param userId User ID
   * @returns Array of organizations
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization)
      RETURN org
      ORDER BY org.name
    `;

    const result = await this.neo4jService.executeQuery(query, { userId });
    
    return result.records.map((record) => {
      const orgProperties = record.get('org').properties;
      return {
        id: orgProperties.id,
        name: orgProperties.name,
        description: orgProperties.description,
        status: orgProperties.status,
        created_at: new Date(orgProperties.created_at),
        updated_at: new Date(orgProperties.updated_at),
        metadata: orgProperties.metadata
      };
    });
  }

  /**
   * Add a user to an organization with a specific role
   * @param userId User ID
   * @param orgId Organization ID
   * @param role User role in the organization
   */
  async addUserToOrganization(userId: string, orgId: string, role = 'member'): Promise<void> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const query = `
      MATCH (u:User {id: $userId}), (org:Organization {id: $orgId})
      MERGE (u)-[r:MEMBER_OF]->(org)
      SET r.role = $role, r.created_at = datetime()
      RETURN r
    `;

    const result = await this.neo4jService.executeQuery(query, { userId, orgId, role });
    
    if (result.records.length === 0) {
      throw new Error('Failed to add user to organization');
    }
  }

  /**
   * Remove a user from an organization
   * @param userId User ID
   * @param orgId Organization ID
   */
  async removeUserFromOrganization(userId: string, orgId: string): Promise<void> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      DELETE r
      RETURN count(r) as deleted
    `;

    const result = await this.neo4jService.executeQuery(query, { userId, orgId });
    
    if (result.records.length === 0 || result.records[0].get('deleted') === 0) {
      throw new Error('User not found in organization or removal failed');
    }
  }

  /**
   * Get user role in an organization
   * @param userId User ID
   * @param orgId Organization ID
   * @returns User role or null if not a member
   */
  async getUserRole(userId: string, orgId: string): Promise<string | null> {
    const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      RETURN r.role as role
    `;

    const result = await this.neo4jService.executeQuery(query, { userId, orgId });
    
    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get('role');
  }

  /**
   * Enhanced tenant context validation with role checking
   * @param userId User ID
   * @param orgId Organization ID
   * @param requiredRole Required role (optional)
   * @returns Boolean indicating if access is valid
   */
  async validateTenantContext(userId: string, orgId: string, requiredRole?: string): Promise<boolean> {
    if (!this.validateOrgId(orgId)) {
      return false;
    }

    const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      WHERE org.status = 'active'
      RETURN r.role as role, org.status as orgStatus
    `;

    const result = await this.neo4jService.executeQuery(query, { userId, orgId });
    
    if (result.records.length === 0) {
      return false;
    }

    const userRole = result.records[0].get('role');
    
    // If a specific role is required, check if user has sufficient permissions
    if (requiredRole) {
      return this.hasRequiredRole(userRole, requiredRole);
    }

    return true;
  }

  /**
   * Check if user role meets the required role level
   * @param userRole User's current role
   * @param requiredRole Required role level
   * @returns Boolean indicating if role is sufficient
   */
  private hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = {
      'viewer': 1,
      'member': 2,
      'editor': 3,
      'admin': 4,
      'owner': 5
    };

    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Apply schema migrations for an organization
   * @param orgId Organization ID
   * @param targetVersion Target schema version (optional)
   */
  async applyMigrations(orgId: string, targetVersion?: string): Promise<void> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    // Get current schema version for organization
    const currentVersion = await this.getCurrentSchemaVersion(orgId);
    
    // Get all pending migrations
    const pendingMigrations = await this.getPendingMigrations(currentVersion, targetVersion);
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(orgId, migration);
    }
  }

  /**
   * Get the current schema version for an organization
   * @param orgId Organization ID
   * @returns Current schema version
   */
  private async getCurrentSchemaVersion(orgId: string): Promise<string> {
    const query = `
      MATCH (s:SchemaVersion {org_id: $orgId})
      RETURN s.version as version
      ORDER BY s.applied_at DESC
      LIMIT 1
    `;
    
    const result = await this.neo4jService.executeQuery(query, { orgId });
    return result.records.length > 0 ? result.records[0].get('version') : '0.0.0';
  }

  /**
   * Get pending migrations that need to be applied
   * @param currentVersion Current schema version
   * @param targetVersion Target schema version (optional)
   * @returns Array of pending migrations
   */
  private async getPendingMigrations(currentVersion: string, targetVersion?: string): Promise<Migration[]> {
    const migrations = await this.loadMigrationFiles();
    const currentVersionIndex = migrations.findIndex(m => m.version === currentVersion);
    
    let endIndex = migrations.length;
    if (targetVersion) {
      endIndex = migrations.findIndex(m => m.version === targetVersion) + 1;
    }
    
    return migrations.slice(currentVersionIndex + 1, endIndex);
  }

  /**
   * Apply a single migration to an organization
   * @param orgId Organization ID
   * @param migration Migration to apply
   */
  private async applyMigration(orgId: string, migration: Migration): Promise<void> {
    const queries = [];
    
    // Apply migration steps
    for (const step of migration.steps) {
      queries.push({
        query: this.addTenantContextToMigration(step.query, orgId),
        params: { orgId }
      });
    }
    
    // Record migration in history
    queries.push({
      query: `
        CREATE (s:SchemaVersion {
          org_id: $orgId,
          version: $version,
          description: $description,
          applied_at: datetime()
        })
      `,
      params: {
        orgId,
        version: migration.version,
        description: migration.description
      }
    });
    
    // Execute all queries in a transaction
    await this.neo4jService.executeTransaction(queries, orgId);
  }

  /**
   * Add tenant context to migration queries
   * @param query Migration query
   * @param orgId Organization ID
   * @returns Query with tenant context
   */
  private addTenantContextToMigration(query: string, orgId: string): string {
    // Replace placeholder with actual org_id for constraints and indexes
    return query.replace(/\$orgId/g, `'${orgId}'`);
  }

  /**
   * Load migration files from the filesystem
   * @returns Array of migrations sorted by version
   */
  private async loadMigrationFiles(): Promise<Migration[]> {
    try {
      const migrationDir = path.join(__dirname, '..', 'migrations');
      
      // Check if migration directory exists
      if (!fs.existsSync(migrationDir)) {
        console.warn('Migration directory not found, creating empty migrations array');
        return [];
      }
      
      const files = await fs.promises.readdir(migrationDir);
      
      const migrations: Migration[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.promises.readFile(path.join(migrationDir, file), 'utf8');
          migrations.push(JSON.parse(content));
        }
      }
      
      // Sort migrations by version
      return migrations.sort((a, b) => this.compareVersions(a.version, b.version));
    } catch (error) {
      console.error('Error loading migration files:', error);
      return [];
    }
  }

  /**
   * Compare semantic versions
   * @param a Version A
   * @param b Version B
   * @returns Comparison result
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  }

  /**
   * Generate a UUID (simple implementation)
   * @returns UUID string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Validate data integrity across tenant boundaries
   * @param orgId Organization ID
   * @returns Validation report
   */
  async validateDataIntegrity(orgId: string): Promise<{valid: boolean, errors: string[]}> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const errors: string[] = [];

    // Check for orphaned nodes (nodes without org_id)
    const orphanQuery = `
      MATCH (n)
      WHERE NOT EXISTS(n.org_id) AND NOT n:SchemaVersion AND NOT n:Migration
      RETURN labels(n) as labels, count(n) as count
    `;

    const orphanResult = await this.neo4jService.executeQuery(orphanQuery);
    
    for (const record of orphanResult.records) {
      const labels = record.get('labels');
      const count = record.get('count');
      if (count > 0) {
        errors.push(`Found ${count} orphaned nodes with labels: ${labels.join(', ')}`);
      }
    }

    // Check for cross-tenant relationships
    const crossTenantQuery = `
      MATCH (a)-[r]->(b)
      WHERE a.org_id <> b.org_id AND EXISTS(a.org_id) AND EXISTS(b.org_id)
      RETURN type(r) as relType, a.org_id as orgA, b.org_id as orgB, count(*) as count
      LIMIT 10
    `;

    const crossTenantResult = await this.neo4jService.executeQuery(crossTenantQuery);
    
    for (const record of crossTenantResult.records) {
      const relType = record.get('relType');
      const orgA = record.get('orgA');
      const orgB = record.get('orgB');
      const count = record.get('count');
      errors.push(`Found ${count} cross-tenant ${relType} relationships between ${orgA} and ${orgB}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get migration history for an organization
   * @param orgId Organization ID
   * @returns Array of migration history records
   */
  async getMigrationHistory(orgId: string): Promise<MigrationHistory[]> {
    if (!this.validateOrgId(orgId)) {
      throw new Error('Invalid organization ID');
    }

    const query = `
      MATCH (s:SchemaVersion {org_id: $orgId})
      RETURN s.version as version, s.description as description, s.applied_at as applied_at, s.org_id as org_id
      ORDER BY s.applied_at DESC
    `;

    const result = await this.neo4jService.executeQuery(query, { orgId });
    
    return result.records.map((record) => ({
      version: record.get('version'),
      description: record.get('description'),
      applied_at: new Date(record.get('applied_at')),
      org_id: record.get('org_id')
    }));
  }

  /**
   * Close the Neo4j service connection
   */
  async close(): Promise<void> {
    await this.neo4jService.close();
  }
}

import { Neo4jService } from './Neo4jService';

export class TenantService {
  // TODO: Implementation Plan - 03-Knowledge-Graph-Implementation.md - Tenant service implementation for multi-tenant isolation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend tenant service tests
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
  addOrgIdToParams(params: Record<string, any>, orgId: string): Record<string, any> {
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
  async executeTenantQuery(query: string, params: Record<string, any> = {}, orgId: string): Promise<any> {
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
  async validateAccess(user: any, orgId: string): Promise<void> {
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
  async getOrganization(orgId: string): Promise<any> {
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
    
    return result.records[0].get('org').properties;
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
   * Close the Neo4j service connection
   */
  async close(): Promise<void> {
    await this.neo4jService.close();
  }
}

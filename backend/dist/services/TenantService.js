"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const Neo4jService_1 = require("./Neo4jService");
class TenantService {
    constructor() {
        this.neo4jService = new Neo4jService_1.Neo4jService();
    }
    validateOrgId(orgId) {
        if (!orgId || orgId.trim() === '') {
            console.error('Organization ID is required');
            return false;
        }
        return true;
    }
    addOrgIdToParams(params, orgId) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        return {
            ...params,
            orgId: orgId
        };
    }
    createTenantQueryTemplate(query) {
        const tenantFilteredQuery = query.replace(/MATCH\s*\((\w+):(\w+)\)/gi, 'MATCH ($1:$2 {orgId: $orgId})').replace(/CREATE\s*\((\w+):(\w+)\)/gi, 'CREATE ($1:$2 {orgId: $orgId})');
        return tenantFilteredQuery;
    }
    async executeTenantQuery(query, params = {}, orgId) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const tenantParams = this.addOrgIdToParams(params, orgId);
        return await this.neo4jService.executeQuery(query, tenantParams);
    }
    async validateAccess(user, orgId) {
        if (!user || !user.orgId) {
            throw new Error('User organization information is required');
        }
        if (user.orgId !== orgId) {
            throw new Error('Access denied: User does not have access to this organization');
        }
    }
    async getOrganization(orgId) {
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
    async getUserPermissions(userId, orgId) {
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
    async validateCrossOrgAccess(userId, targetOrgId) {
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
    async validateProjectAccess(userId, orgId, projectId) {
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
    async close() {
        await this.neo4jService.close();
    }
}
exports.TenantService = TenantService;
//# sourceMappingURL=TenantService.js.map
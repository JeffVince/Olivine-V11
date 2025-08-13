"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const Neo4jService_1 = require("./Neo4jService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TenantService {
    constructor(neo4jService) {
        this.neo4jService = neo4jService ?? new Neo4jService_1.Neo4jService();
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
        const result = await this.neo4jService.executeQuery(query, tenantParams);
        return result;
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
        if (!result || !('records' in result) || result.records.length === 0) {
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
    async getUserPermissions(userId, orgId) {
        const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization {id: $orgId})
      MATCH (u)-[:HAS_ROLE]->(role:Role)
      MATCH (role)-[:HAS_PERMISSION]->(perm:Permission)
      RETURN collect(perm.name) as permissions
    `;
        const result = await this.neo4jService.executeQuery(query, { userId, orgId });
        if (!result || !('records' in result)) {
            return [];
        }
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
        if (!result || !('records' in result)) {
            return false;
        }
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
        if (!result || !('records' in result)) {
            return false;
        }
        if (result.records.length === 0) {
            return false;
        }
        const record = result.records[0];
        return record.get('hasOrgAccess') && record.get('projectExists');
    }
    async createOrganization(orgData) {
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
        if (!result || !('records' in result)) {
            throw new Error('Failed to create organization');
        }
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
    async updateOrganization(orgId, updateData) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const setClause = [];
        const params = { orgId };
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
        if (!result || !('records' in result)) {
            throw new Error('Organization not found');
        }
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
    async getUserOrganizations(userId) {
        const query = `
      MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization)
      RETURN org
      ORDER BY org.name
    `;
        const result = await this.neo4jService.executeQuery(query, { userId });
        if (!result || !('records' in result)) {
            return [];
        }
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
    async addUserToOrganization(userId, orgId, role = 'member') {
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
        if (!result || !('records' in result) || result.records.length === 0) {
            throw new Error('Failed to add user to organization');
        }
    }
    async removeUserFromOrganization(userId, orgId) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      DELETE r
      RETURN count(r) as deleted
    `;
        const result = await this.neo4jService.executeQuery(query, { userId, orgId });
        if (!result || !('records' in result)) {
            throw new Error('User not found in organization or removal failed');
        }
        if (result.records.length === 0 || result.records[0].get('deleted') === 0) {
            throw new Error('User not found in organization or removal failed');
        }
    }
    async getUserRole(userId, orgId) {
        const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      RETURN r.role as role
    `;
        const result = await this.neo4jService.executeQuery(query, { userId, orgId });
        if (!result || !('records' in result)) {
            return null;
        }
        if (result.records.length === 0) {
            return null;
        }
        return result.records[0].get('role');
    }
    async validateTenantContext(userId, orgId, requiredRole) {
        if (!this.validateOrgId(orgId)) {
            return false;
        }
        const query = `
      MATCH (u:User {id: $userId})-[r:MEMBER_OF]->(org:Organization {id: $orgId})
      WHERE org.status = 'active'
      RETURN r.role as role, org.status as orgStatus
    `;
        const result = await this.neo4jService.executeQuery(query, { userId, orgId });
        if (!result || !('records' in result)) {
            return false;
        }
        if (result.records.length === 0) {
            return false;
        }
        const userRole = result.records[0].get('role');
        if (requiredRole) {
            return this.hasRequiredRole(userRole, requiredRole);
        }
        return true;
    }
    hasRequiredRole(userRole, requiredRole) {
        const roleHierarchy = {
            'viewer': 1,
            'member': 2,
            'editor': 3,
            'admin': 4,
            'owner': 5
        };
        const userLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        return userLevel >= requiredLevel;
    }
    async applyMigrations(orgId, targetVersion) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const currentVersion = await this.getCurrentSchemaVersion(orgId);
        const pendingMigrations = await this.getPendingMigrations(currentVersion, targetVersion);
        for (const migration of pendingMigrations) {
            await this.applyMigration(orgId, migration);
        }
    }
    async getCurrentSchemaVersion(orgId) {
        const query = `
      MATCH (s:SchemaVersion {org_id: $orgId})
      RETURN s.version as version
      ORDER BY s.applied_at DESC
      LIMIT 1
    `;
        const result = await this.neo4jService.executeQuery(query, { orgId });
        return result.records.length > 0 ? result.records[0].get('version') : '0.0.0';
    }
    async getPendingMigrations(currentVersion, targetVersion) {
        const migrations = await this.loadMigrationFiles();
        const currentVersionIndex = migrations.findIndex(m => m.version === currentVersion);
        let endIndex = migrations.length;
        if (targetVersion) {
            endIndex = migrations.findIndex(m => m.version === targetVersion) + 1;
        }
        return migrations.slice(currentVersionIndex + 1, endIndex);
    }
    async applyMigration(orgId, migration) {
        const queries = [];
        for (const step of migration.steps) {
            queries.push({
                query: this.addTenantContextToMigration(step.query, orgId),
                params: { orgId }
            });
        }
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
        await this.neo4jService.executeTransaction(queries, orgId);
    }
    addTenantContextToMigration(query, orgId) {
        return query.replace(/\$orgId/g, `'${orgId}'`);
    }
    async loadMigrationFiles() {
        try {
            const migrationDir = path.join(__dirname, '..', 'migrations');
            if (!fs.existsSync(migrationDir)) {
                console.warn('Migration directory not found, creating empty migrations array');
                return [];
            }
            const files = await fs.promises.readdir(migrationDir);
            const migrations = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.promises.readFile(path.join(migrationDir, file), 'utf8');
                    migrations.push(JSON.parse(content));
                }
            }
            return migrations.sort((a, b) => this.compareVersions(a.version, b.version));
        }
        catch (error) {
            console.error('Error loading migration files:', error);
            return [];
        }
    }
    compareVersions(a, b) {
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
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    async validateDataIntegrity(orgId) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const errors = [];
        const orphanQuery = `
      MATCH (n)
      WHERE NOT EXISTS(n.org_id) AND NOT n:SchemaVersion AND NOT n:Migration
      RETURN labels(n) as labels, count(n) as count
    `;
        const orphanResult = await this.neo4jService.executeQuery(orphanQuery);
        if (!orphanResult || !('records' in orphanResult)) {
            return { valid: true, errors: [] };
        }
        for (const record of orphanResult.records) {
            const labels = record.get('labels');
            const count = record.get('count');
            if (count > 0) {
                errors.push(`Found ${count} orphaned nodes with labels: ${labels.join(', ')}`);
            }
        }
        const crossTenantQuery = `
      MATCH (a)-[r]->(b)
      WHERE a.org_id <> b.org_id AND EXISTS(a.org_id) AND EXISTS(b.org_id)
      RETURN type(r) as relType, a.org_id as orgA, b.org_id as orgB, count(*) as count
      LIMIT 10
    `;
        const crossTenantResult = await this.neo4jService.executeQuery(crossTenantQuery);
        if (!crossTenantResult || !('records' in crossTenantResult)) {
            return { valid: errors.length === 0, errors };
        }
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
    async getMigrationHistory(orgId) {
        if (!this.validateOrgId(orgId)) {
            throw new Error('Invalid organization ID');
        }
        const query = `
      MATCH (s:SchemaVersion {org_id: $orgId})
      RETURN s.version as version, s.description as description, s.applied_at as applied_at, s.org_id as org_id
      ORDER BY s.applied_at DESC
    `;
        const result = await this.neo4jService.executeQuery(query, { orgId });
        if (!result || !('records' in result)) {
            return [];
        }
        return result.records.map((record) => ({
            version: record.get('version'),
            description: record.get('description'),
            applied_at: new Date(record.get('applied_at')),
            org_id: record.get('org_id')
        }));
    }
    async close() {
        await this.neo4jService.close();
    }
}
exports.TenantService = TenantService;
//# sourceMappingURL=TenantService.js.map
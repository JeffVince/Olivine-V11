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
const TenantService_1 = require("../../services/TenantService");
const Neo4jService_1 = require("../../services/Neo4jService");
const fs = __importStar(require("fs"));
jest.mock('../../services/Neo4jService');
jest.mock('fs');
const mockNeo4jService = {
    executeQuery: jest.fn(),
    executeTransaction: jest.fn(),
    close: jest.fn()
};
const MockedNeo4jService = Neo4jService_1.Neo4jService;
MockedNeo4jService.mockImplementation(() => mockNeo4jService);
describe('TenantService', () => {
    let tenantService;
    let mockFs;
    beforeEach(() => {
        jest.clearAllMocks();
        tenantService = new TenantService_1.TenantService();
        mockFs = fs;
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe('validateOrgId', () => {
        test('should return true for valid organization ID', () => {
            const result = tenantService.validateOrgId('valid-org-id');
            expect(result).toBe(true);
        });
        test('should return false for empty organization ID', () => {
            const result = tenantService.validateOrgId('');
            expect(result).toBe(false);
        });
        test('should return false for null organization ID', () => {
            const result = tenantService.validateOrgId(null);
            expect(result).toBe(false);
        });
        test('should return false for whitespace-only organization ID', () => {
            const result = tenantService.validateOrgId('   ');
            expect(result).toBe(false);
        });
    });
    describe('addOrgIdToParams', () => {
        test('should add orgId to parameters', () => {
            const params = { key: 'value' };
            const orgId = 'test-org';
            const result = tenantService.addOrgIdToParams(params, orgId);
            expect(result).toEqual({
                key: 'value',
                orgId: 'test-org'
            });
        });
        test('should throw error for invalid orgId', () => {
            const params = { key: 'value' };
            expect(() => {
                tenantService.addOrgIdToParams(params, '');
            }).toThrow('Invalid organization ID');
        });
    });
    describe('createTenantQueryTemplate', () => {
        test('should add org_id filtering to MATCH clauses', () => {
            const query = 'MATCH (f:File) RETURN f';
            const result = tenantService.createTenantQueryTemplate(query);
            expect(result).toBe('MATCH (f:File {orgId: $orgId}) RETURN f');
        });
        test('should add org_id filtering to CREATE clauses', () => {
            const query = 'CREATE (f:File)';
            const result = tenantService.createTenantQueryTemplate(query);
            expect(result).toBe('CREATE (f:File {orgId: $orgId})');
        });
        test('should handle multiple MATCH clauses', () => {
            const query = 'MATCH (f:File) MATCH (c:Content) RETURN f, c';
            const result = tenantService.createTenantQueryTemplate(query);
            expect(result).toBe('MATCH (f:File {orgId: $orgId}) MATCH (c:Content {orgId: $orgId}) RETURN f, c');
        });
    });
    describe('executeTenantQuery', () => {
        test('should execute query with tenant parameters', async () => {
            const query = 'MATCH (f:File) RETURN f';
            const params = { key: 'value' };
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            await tenantService.executeTenantQuery(query, params, orgId);
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(query, {
                key: 'value',
                orgId: 'test-org'
            });
        });
        test('should throw error for invalid orgId', async () => {
            const query = 'MATCH (f:File) RETURN f';
            await expect(tenantService.executeTenantQuery(query, {}, '')).rejects.toThrow('Invalid organization ID');
        });
    });
    describe('validateAccess', () => {
        test('should pass for user with matching orgId', async () => {
            const user = { orgId: 'test-org' };
            const orgId = 'test-org';
            await expect(tenantService.validateAccess(user, orgId)).resolves.not.toThrow();
        });
        test('should throw error for user without orgId', async () => {
            const user = { orgId: undefined };
            const orgId = 'test-org';
            await expect(tenantService.validateAccess(user, orgId)).rejects.toThrow('User organization information is required');
        });
        test('should throw error for user with different orgId', async () => {
            const user = { orgId: 'different-org' };
            const orgId = 'test-org';
            await expect(tenantService.validateAccess(user, orgId)).rejects.toThrow('Access denied: User does not have access to this organization');
        });
    });
    describe('getOrganization', () => {
        test('should return organization details', async () => {
            const orgId = 'test-org';
            const mockOrgData = {
                id: 'test-org',
                name: 'Test Organization',
                description: 'Test Description',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {}
            };
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue({ properties: mockOrgData })
                    }]
            });
            const result = await tenantService.getOrganization(orgId);
            expect(result.id).toBe('test-org');
            expect(result.name).toBe('Test Organization');
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('MATCH (org:Organization {id: $orgId})'), { orgId });
        });
        test('should throw error when organization not found', async () => {
            const orgId = 'non-existent-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            await expect(tenantService.getOrganization(orgId)).rejects.toThrow('Organization not found');
        });
        test('should throw error for invalid orgId', async () => {
            await expect(tenantService.getOrganization('')).rejects.toThrow('Invalid organization ID');
        });
    });
    describe('getUserPermissions', () => {
        test('should return user permissions for organization', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const mockPermissions = ['read', 'write', 'admin'];
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue(mockPermissions)
                    }]
            });
            const result = await tenantService.getUserPermissions(userId, orgId);
            expect(result).toEqual(mockPermissions);
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('MATCH (u:User {id: $userId})-[:MEMBER_OF]->(org:Organization {id: $orgId})'), { userId, orgId });
        });
        test('should return empty array when user has no permissions', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            const result = await tenantService.getUserPermissions(userId, orgId);
            expect(result).toEqual([]);
        });
    });
    describe('validateCrossOrgAccess', () => {
        test('should return true for member of target organization', async () => {
            const userId = 'test-user';
            const targetOrgId = 'target-org';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce(true)
                            .mockReturnValueOnce(false)
                    }]
            });
            const result = await tenantService.validateCrossOrgAccess(userId, targetOrgId);
            expect(result).toBe(true);
        });
        test('should return true for user with cross-org access', async () => {
            const userId = 'test-user';
            const targetOrgId = 'target-org';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce(false)
                            .mockReturnValueOnce(true)
                    }]
            });
            const result = await tenantService.validateCrossOrgAccess(userId, targetOrgId);
            expect(result).toBe(true);
        });
        test('should return false for user without access', async () => {
            const userId = 'test-user';
            const targetOrgId = 'target-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            const result = await tenantService.validateCrossOrgAccess(userId, targetOrgId);
            expect(result).toBe(false);
        });
    });
    describe('validateProjectAccess', () => {
        test('should return true for user with organization and project access', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const projectId = 'test-project';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce(true)
                            .mockReturnValueOnce(true)
                    }]
            });
            const result = await tenantService.validateProjectAccess(userId, orgId, projectId);
            expect(result).toBe(true);
        });
        test('should return false for user without organization access', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const projectId = 'test-project';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce(false)
                            .mockReturnValueOnce(true)
                    }]
            });
            const result = await tenantService.validateProjectAccess(userId, orgId, projectId);
            expect(result).toBe(false);
        });
    });
    describe('createOrganization', () => {
        test('should create new organization with generated ID', async () => {
            const orgData = {
                name: 'Test Organization',
                description: 'Test Description',
                status: 'active',
                metadata: { key: 'value' }
            };
            const mockCreatedOrg = {
                id: 'generated-uuid',
                name: 'Test Organization',
                description: 'Test Description',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: { key: 'value' }
            };
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue({ properties: mockCreatedOrg })
                    }]
            });
            const result = await tenantService.createOrganization(orgData);
            expect(result.name).toBe('Test Organization');
            expect(result.description).toBe('Test Description');
            expect(result.status).toBe('active');
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('CREATE (org:Organization'), expect.objectContaining({
                name: 'Test Organization',
                description: 'Test Description',
                status: 'active',
                metadata: { key: 'value' }
            }));
        });
        test('should throw error when creation fails', async () => {
            const orgData = {
                name: 'Test Organization',
                status: 'active'
            };
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            await expect(tenantService.createOrganization(orgData)).rejects.toThrow('Failed to create organization');
        });
    });
    describe('updateOrganization', () => {
        test('should update organization with provided data', async () => {
            const orgId = 'test-org';
            const updateData = {
                name: 'Updated Name',
                description: 'Updated Description'
            };
            const mockUpdatedOrg = {
                id: 'test-org',
                name: 'Updated Name',
                description: 'Updated Description',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: {}
            };
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue({ properties: mockUpdatedOrg })
                    }]
            });
            const result = await tenantService.updateOrganization(orgId, updateData);
            expect(result.name).toBe('Updated Name');
            expect(result.description).toBe('Updated Description');
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SET org.name = $name, org.description = $description, org.updated_at = datetime($updated_at)'), expect.objectContaining({
                orgId: 'test-org',
                name: 'Updated Name',
                description: 'Updated Description'
            }));
        });
        test('should throw error for invalid orgId', async () => {
            await expect(tenantService.updateOrganization('', {})).rejects.toThrow('Invalid organization ID');
        });
        test('should throw error when organization not found', async () => {
            const orgId = 'non-existent-org';
            const updateData = { name: 'Updated Name' };
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            await expect(tenantService.updateOrganization(orgId, updateData)).rejects.toThrow('Organization not found');
        });
    });
    describe('getUserOrganizations', () => {
        test('should return organizations for user', async () => {
            const userId = 'test-user';
            const mockOrgs = [
                {
                    id: 'org-1',
                    name: 'Organization 1',
                    description: 'Description 1',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: {}
                },
                {
                    id: 'org-2',
                    name: 'Organization 2',
                    description: 'Description 2',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: {}
                }
            ];
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: mockOrgs.map(org => ({
                    get: jest.fn().mockReturnValue({ properties: org })
                }))
            });
            const result = await tenantService.getUserOrganizations(userId);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Organization 1');
            expect(result[1].name).toBe('Organization 2');
        });
    });
    describe('addUserToOrganization', () => {
        test('should add user to organization with role', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const role = 'admin';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{}]
            });
            await tenantService.addUserToOrganization(userId, orgId, role);
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('MERGE (u)-[r:MEMBER_OF]->(org)'), { userId, orgId, role });
        });
        test('should throw error for invalid orgId', async () => {
            await expect(tenantService.addUserToOrganization('user', '', 'member')).rejects.toThrow('Invalid organization ID');
        });
        test('should throw error when addition fails', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            await expect(tenantService.addUserToOrganization(userId, orgId)).rejects.toThrow('Failed to add user to organization');
        });
    });
    describe('removeUserFromOrganization', () => {
        test('should remove user from organization', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue(1)
                    }]
            });
            await tenantService.removeUserFromOrganization(userId, orgId);
            expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE r'), { userId, orgId });
        });
        test('should throw error when user not found', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue(0)
                    }]
            });
            await expect(tenantService.removeUserFromOrganization(userId, orgId)).rejects.toThrow('User not found in organization or removal failed');
        });
    });
    describe('getUserRole', () => {
        test('should return user role in organization', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const role = 'admin';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue(role)
                    }]
            });
            const result = await tenantService.getUserRole(userId, orgId);
            expect(result).toBe('admin');
        });
        test('should return null when user not in organization', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({ records: [] });
            const result = await tenantService.getUserRole(userId, orgId);
            expect(result).toBeNull();
        });
    });
    describe('validateTenantContext', () => {
        test('should return true for valid tenant context', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue('member')
                    }]
            });
            const result = await tenantService.validateTenantContext(userId, orgId);
            expect(result).toBe(true);
        });
        test('should return true for user with sufficient role', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const requiredRole = 'member';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue('admin')
                    }]
            });
            const result = await tenantService.validateTenantContext(userId, orgId, requiredRole);
            expect(result).toBe(true);
        });
        test('should return false for user with insufficient role', async () => {
            const userId = 'test-user';
            const orgId = 'test-org';
            const requiredRole = 'admin';
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: [{
                        get: jest.fn().mockReturnValue('member')
                    }]
            });
            const result = await tenantService.validateTenantContext(userId, orgId, requiredRole);
            expect(result).toBe(false);
        });
        test('should return false for invalid orgId', async () => {
            const result = await tenantService.validateTenantContext('user', '', 'member');
            expect(result).toBe(false);
        });
    });
    describe('validateDataIntegrity', () => {
        test('should return valid result when no integrity issues', async () => {
            const orgId = 'test-org';
            mockNeo4jService.executeQuery
                .mockResolvedValueOnce({ records: [] })
                .mockResolvedValueOnce({ records: [] });
            const result = await tenantService.validateDataIntegrity(orgId);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        test('should return errors for orphaned nodes', async () => {
            const orgId = 'test-org';
            mockNeo4jService.executeQuery
                .mockResolvedValueOnce({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce(['File', 'Content'])
                            .mockReturnValueOnce(5)
                    }]
            })
                .mockResolvedValueOnce({ records: [] });
            const result = await tenantService.validateDataIntegrity(orgId);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Found 5 orphaned nodes with labels: File, Content');
        });
        test('should return errors for cross-tenant relationships', async () => {
            const orgId = 'test-org';
            mockNeo4jService.executeQuery
                .mockResolvedValueOnce({ records: [] })
                .mockResolvedValueOnce({
                records: [{
                        get: jest.fn()
                            .mockReturnValueOnce('REFERENCES')
                            .mockReturnValueOnce('org-1')
                            .mockReturnValueOnce('org-2')
                            .mockReturnValueOnce(3)
                    }]
            });
            const result = await tenantService.validateDataIntegrity(orgId);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Found 3 cross-tenant REFERENCES relationships between org-1 and org-2');
        });
    });
    describe('getMigrationHistory', () => {
        test('should return migration history for organization', async () => {
            const orgId = 'test-org';
            const mockHistory = [
                {
                    version: '1.1.0',
                    description: 'Add new indexes',
                    applied_at: new Date().toISOString(),
                    org_id: 'test-org'
                },
                {
                    version: '1.0.0',
                    description: 'Initial schema',
                    applied_at: new Date().toISOString(),
                    org_id: 'test-org'
                }
            ];
            mockNeo4jService.executeQuery.mockResolvedValue({
                records: mockHistory.map(history => ({
                    get: jest.fn()
                        .mockReturnValueOnce(history.version)
                        .mockReturnValueOnce(history.description)
                        .mockReturnValueOnce(history.applied_at)
                        .mockReturnValueOnce(history.org_id)
                }))
            });
            const result = await tenantService.getMigrationHistory(orgId);
            expect(result).toHaveLength(2);
            expect(result[0].version).toBe('1.1.0');
            expect(result[1].version).toBe('1.0.0');
        });
        test('should throw error for invalid orgId', async () => {
            await expect(tenantService.getMigrationHistory('')).rejects.toThrow('Invalid organization ID');
        });
    });
    describe('applyMigrations', () => {
        beforeEach(() => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.promises = {
                readdir: jest.fn().mockResolvedValue(['001_initial.json', '002_update.json']),
                readFile: jest.fn()
            };
        });
        test('should apply pending migrations', async () => {
            const orgId = 'test-org';
            const mockMigrations = [
                {
                    version: '1.0.0',
                    description: 'Initial schema',
                    steps: [
                        { type: 'constraint', query: 'CREATE CONSTRAINT unique_file_id FOR (f:File) REQUIRE f.id IS UNIQUE' }
                    ]
                },
                {
                    version: '1.1.0',
                    description: 'Add indexes',
                    steps: [
                        { type: 'index', query: 'CREATE INDEX file_org_index FOR (f:File) ON f.org_id' }
                    ]
                }
            ];
            mockFs.promises.readFile
                .mockResolvedValueOnce(JSON.stringify(mockMigrations[0]))
                .mockResolvedValueOnce(JSON.stringify(mockMigrations[1]));
            mockNeo4jService.executeQuery
                .mockResolvedValueOnce({ records: [] })
                .mockResolvedValue({ records: [] });
            mockNeo4jService.executeTransaction.mockResolvedValue([]);
            await tenantService.applyMigrations(orgId);
            expect(mockNeo4jService.executeTransaction).toHaveBeenCalledTimes(2);
        });
        test('should throw error for invalid orgId', async () => {
            await expect(tenantService.applyMigrations('')).rejects.toThrow('Invalid organization ID');
        });
    });
    describe('close', () => {
        test('should close Neo4j service connection', async () => {
            await tenantService.close();
            expect(mockNeo4jService.close).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=TenantService.test.js.map
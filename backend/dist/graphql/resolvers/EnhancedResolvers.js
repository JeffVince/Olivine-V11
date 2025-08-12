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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedResolvers = void 0;
const graphql_1 = require("graphql");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const EnhancedFileResolvers_1 = require("./EnhancedFileResolvers");
const Neo4jService_1 = require("../../services/Neo4jService");
const PostgresService_1 = require("../../services/PostgresService");
const QueueService_1 = require("../../services/queues/QueueService");
const TenantService_1 = require("../../services/TenantService");
const AuthService_1 = require("../../services/AuthService");
const winston_1 = __importDefault(require("winston"));
class EnhancedResolvers {
    constructor() {
        this.pubSub = new graphql_subscriptions_1.PubSub();
        this.fileResolvers = new EnhancedFileResolvers_1.EnhancedFileResolvers();
        this.neo4jService = new Neo4jService_1.Neo4jService();
        this.postgresService = new PostgresService_1.PostgresService();
        this.queueService = new QueueService_1.QueueService();
        this.tenantService = new TenantService_1.TenantService();
        this.authService = new AuthService_1.AuthService();
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.label({ label: 'enhanced-resolvers' })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    getResolvers() {
        return {
            DateTime: new graphql_1.GraphQLScalarType({
                name: 'DateTime',
                description: 'Date custom scalar type',
                serialize: (value) => {
                    if (value instanceof Date) {
                        return value.toISOString();
                    }
                    return value;
                },
                parseValue: (value) => {
                    return new Date(value);
                },
                parseLiteral: (ast) => {
                    if (ast.kind === graphql_1.Kind.STRING) {
                        return new Date(ast.value);
                    }
                    return null;
                },
            }),
            JSON: new graphql_1.GraphQLScalarType({
                name: 'JSON',
                description: 'Arbitrary JSON value',
                serialize: (value) => value,
                parseValue: (value) => value,
                parseLiteral: (ast) => {
                    switch (ast.kind) {
                        case graphql_1.Kind.STRING:
                        case graphql_1.Kind.BOOLEAN:
                            return ast.value;
                        case graphql_1.Kind.INT:
                        case graphql_1.Kind.FLOAT:
                            return Number(ast.value);
                        case graphql_1.Kind.OBJECT:
                            const value = Object.create(null);
                            ast.fields.forEach((field) => {
                                value[field.name.value] = field.value.value;
                            });
                            return value;
                        case graphql_1.Kind.LIST:
                            return ast.values.map((n) => n.value);
                        case graphql_1.Kind.NULL:
                            return null;
                        default:
                            return null;
                    }
                },
            }),
            Query: {
                organization: async (_, { id }, context) => {
                    return this.getOrganization(id, context);
                },
                organizations: async (_, __, context) => {
                    return this.getOrganizations(context);
                },
                project: async (_, { id, orgId }, context) => {
                    return this.getProject(id, orgId, context);
                },
                projects: async (_, { orgId }, context) => {
                    return this.getProjects(orgId, context);
                },
                source: async (_, { id, orgId }, context) => {
                    return this.getSource(id, orgId, context);
                },
                sources: async (_, { orgId }, context) => {
                    return this.getSources(orgId, context);
                },
                file: async (_, { id, orgId }, context) => {
                    return this.fileResolvers.getFile(id, orgId, context);
                },
                files: async (_, { filter, limit, offset }, context) => {
                    return this.fileResolvers.getFiles(filter, limit, offset, context);
                },
                content: async (_, { id, orgId }, context) => {
                    const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
                    return contentService.getContent(id, orgId);
                },
                contents: async (_, { filter, limit, offset }, context) => {
                    const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
                    const orgId = filter?.orgId;
                    const type = filter?.contentType;
                    if (!orgId)
                        throw new Error('orgId is required in filter');
                    return contentService.listContent(orgId, type, limit ?? 50, offset ?? 0);
                },
                searchContent: async (_, { orgId, searchText, type, limit }, context) => {
                    const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
                    const results = await contentService.searchContent(orgId, searchText, type, limit || 20);
                    return {
                        results: results.map(r => ({ content: r.content, score: r.score })),
                        totalCount: results.length
                    };
                },
                searchFiles: async (_, { orgId, query, filters, limit }, context) => {
                    return this.fileResolvers.searchFiles(orgId, query, filters, limit, context);
                },
                commit: async (_, { id, orgId }, context) => {
                    return this.getCommit(id, orgId, context);
                },
                commits: async (_, { filter, limit, offset }, context) => {
                    return this.getCommits(filter, limit ?? 50, offset ?? 0, context);
                },
                commitHistory: async (_, { orgId, branchName, limit }, context) => {
                    return this.getCommitHistory(orgId, branchName, limit ?? 50, context);
                },
                entityVersions: async (_, { orgId, entityId, entityType }, context) => {
                    return this.getEntityVersions(orgId, entityId, entityType, context);
                },
                fileStats: async (_, { orgId }, context) => {
                    return this.fileResolvers.getFileStats(orgId, context);
                },
                classificationStats: async (_, { orgId }, context) => {
                    return this.getClassificationStats(orgId, context);
                },
                provenanceStats: async (_, { orgId }, context) => {
                    return this.getProvenanceStats(orgId, context);
                },
                systemHealth: async (_, __, context) => {
                    return this.getSystemHealth(context);
                },
            },
            Mutation: {
                createProject: async (_, { input }, context) => {
                    return this.createProject(input, context);
                },
                updateProject: async (_, { input }, context) => {
                    return this.updateProject(input, context);
                },
                deleteProject: async (_, { id, orgId }, context) => {
                    return this.deleteProject(id, orgId, context);
                },
                createSource: async (_, { input }, context) => {
                    return this.createSource(input, context);
                },
                updateSource: async (_, { input }, context) => {
                    return this.updateSource(input, context);
                },
                deleteSource: async (_, { id, orgId }, context) => {
                    return this.deleteSource(id, orgId, context);
                },
                triggerSourceSync: async (_, { sourceId, orgId }, context) => {
                    return this.triggerSourceSync(sourceId, orgId, context);
                },
                createContent: async (_, { input }, context) => {
                    return this.createContent(input, context);
                },
                updateContent: async (_, { input }, context) => {
                    return this.updateContent(input, context);
                },
                deleteContent: async (_, { id, orgId }, context) => {
                    return this.deleteContent(id, orgId, context);
                },
                classifyFile: async (_, { input }, context) => {
                    return this.fileResolvers.classifyFile(input, context);
                },
                triggerFileReprocessing: async (_, { fileId, orgId }, context) => {
                    return this.fileResolvers.triggerFileReprocessing(fileId, orgId, context);
                },
                bulkClassifyFiles: async (_, { fileIds, orgId }, context) => {
                    return this.fileResolvers.bulkClassifyFiles(fileIds, orgId, context);
                },
                createCommit: async (_, { input }, context) => {
                    return this.createCommit(input, context);
                },
                triggerFullSync: async (_, { orgId }, context) => {
                    return this.triggerFullSync(orgId, context);
                },
                rebuildIndex: async (_, { orgId }, context) => {
                    return this.rebuildIndex(orgId, context);
                },
            },
            Subscription: {
                fileUpdated: {
                    subscribe: (_, { orgId, projectId }) => {
                        const topic = projectId ? `FILE_UPDATED_${orgId}_${projectId}` : `FILE_UPDATED_${orgId}`;
                        return this.pubSub.asyncIterator([topic]);
                    },
                },
                fileClassified: {
                    subscribe: (_, { orgId }) => {
                        return this.pubSub.asyncIterator([`FILE_CLASSIFIED_${orgId}`]);
                    },
                },
                syncProgress: {
                    subscribe: (_, { orgId, sourceId }) => {
                        return this.pubSub.asyncIterator([`SYNC_PROGRESS_${orgId}_${sourceId}`]);
                    },
                },
                classificationProgress: {
                    subscribe: (_, { orgId }) => {
                        return this.pubSub.asyncIterator([`CLASSIFICATION_PROGRESS_${orgId}`]);
                    },
                },
                commitCreated: {
                    subscribe: (_, { orgId, projectId }) => {
                        const topic = projectId ? `COMMIT_CREATED_${orgId}_${projectId}` : `COMMIT_CREATED_${orgId}`;
                        return this.pubSub.asyncIterator([topic]);
                    },
                },
                systemEvents: {
                    subscribe: (_, { orgId }) => {
                        return this.pubSub.asyncIterator([`SYSTEM_EVENTS_${orgId}`]);
                    },
                },
            },
            File: {
                source: async (parent, _, context) => {
                    if (parent.source)
                        return parent.source;
                    return this.getSource(parent.sourceId, parent.orgId, context);
                },
                project: async (parent, _, context) => {
                    if (!parent.projectId)
                        return null;
                    if (parent.project)
                        return parent.project;
                    return this.getProject(parent.projectId, parent.orgId, context);
                },
                parent: async (parent, _, context) => {
                    if (!parent.parentId)
                        return null;
                    if (parent.parent)
                        return parent.parent;
                    return this.fileResolvers.getFile(parent.parentId, parent.orgId, context);
                },
                children: async (parent, _, context) => {
                    return this.getFileChildren(parent.id, parent.orgId, context);
                },
                versions: async (parent, _, context) => {
                    return this.fileResolvers.getFileVersions(parent.id, parent.orgId, context);
                },
            },
            Organization: {
                projects: async (parent, _, context) => {
                    return this.getProjects(parent.id, context);
                },
                sources: async (parent, _, context) => {
                    return this.getSources(parent.id, context);
                },
                users: async (parent, _, context) => {
                    return this.getOrganizationUsers(parent.id, context);
                },
            },
            Project: {
                organization: async (parent, _, context) => {
                    if (parent.organization)
                        return parent.organization;
                    return this.getOrganization(parent.orgId, context);
                },
                files: async (parent, _, context) => {
                    return this.fileResolvers.getFiles({ orgId: parent.orgId, projectId: parent.id }, 100, 0, context);
                },
                content: async (parent, _, context) => {
                    const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
                    return contentService.listContent(parent.orgId, undefined, 100, 0);
                },
                commits: async (parent, _, context) => {
                    return this.getCommits({ orgId: parent.orgId, projectId: parent.id }, 50, 0, context);
                },
            },
            Source: {
                organization: async (parent, _, context) => {
                    if (parent.organization)
                        return parent.organization;
                    return this.getOrganization(parent.orgId, context);
                },
                files: async (parent, _, context) => {
                    return this.fileResolvers.getFiles({ orgId: parent.orgId, sourceId: parent.id }, 100, 0, context);
                },
            },
            Commit: {
                organization: async (parent, _, context) => {
                    if (parent.organization)
                        return parent.organization;
                    return this.getOrganization(parent.orgId, context);
                },
                project: async (parent, _, context) => {
                    if (!parent.projectId)
                        return null;
                    if (parent.project)
                        return parent.project;
                    return this.getProject(parent.projectId, parent.orgId, context);
                },
                parent: async (parent, _, context) => {
                    if (!parent.parentCommitId)
                        return null;
                    return this.getCommit(parent.parentCommitId, parent.orgId, context);
                },
                actions: async (parent, _, context) => {
                    return this.getCommitActions(parent.id, parent.orgId, context);
                },
            },
        };
    }
    async getOrganization(id, context) {
        await this.tenantService.validateAccess(context.user, id);
        const query = 'SELECT * FROM organizations WHERE id = $1';
        const result = await this.postgresService.executeQuery(query, [id]);
        return result.rows[0] || null;
    }
    async getOrganizations(context) {
        if (!context.user) {
            throw new Error('Authentication required');
        }
        const query = `
      SELECT o.* FROM organizations o
      JOIN users u ON u.org_id = o.id
      WHERE u.id = $1
    `;
        const result = await this.postgresService.executeQuery(query, [context.user.id]);
        return result.rows;
    }
    async getProject(id, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        const query = 'SELECT * FROM projects WHERE id = $1 AND org_id = $2';
        const result = await this.postgresService.executeQuery(query, [id, orgId]);
        return result.rows[0] || null;
    }
    async getProjects(orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        const query = 'SELECT * FROM projects WHERE org_id = $1 ORDER BY created_at DESC';
        const result = await this.postgresService.executeQuery(query, [orgId]);
        return result.rows;
    }
    async getSource(id, orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        const query = 'SELECT * FROM sources WHERE id = $1 AND org_id = $2';
        const result = await this.postgresService.executeQuery(query, [id, orgId]);
        return result.rows[0] || null;
    }
    async getSources(orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        const query = 'SELECT * FROM sources WHERE org_id = $1 ORDER BY created_at DESC';
        const result = await this.postgresService.executeQuery(query, [orgId]);
        return result.rows;
    }
    async createProject(input, context) {
        await this.tenantService.validateAccess(context.user, input.orgId);
        const query = `
      INSERT INTO projects (org_id, name, description, settings, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
      RETURNING *
    `;
        const result = await this.postgresService.executeQuery(query, [
            input.orgId,
            input.name,
            input.description,
            JSON.stringify(input.settings || {})
        ]);
        const project = result.rows[0];
        await this.createProjectInGraph(project);
        return project;
    }
    async createProjectInGraph(project) {
        const query = `
      CREATE (p:Project {
        id: $id,
        org_id: $orgId,
        name: $name,
        description: $description,
        status: $status,
        settings: $settings,
        created_at: datetime($createdAt),
        updated_at: datetime($updatedAt)
      })
    `;
        await this.neo4jService.run(query, {
            id: project.id,
            orgId: project.org_id,
            name: project.name,
            description: project.description || '',
            status: project.status,
            settings: JSON.stringify(project.settings || {}),
            createdAt: project.created_at.toISOString(),
            updatedAt: project.updated_at.toISOString()
        });
    }
    async triggerFullSync(orgId, context) {
        await this.tenantService.validateAccess(context.user, orgId);
        try {
            const sources = await this.getSources(orgId, context);
            for (const source of sources) {
                await this.queueService.addJob('source-sync', 'full-sync', {
                    orgId,
                    sourceId: source.id,
                    triggeredBy: context.user.id
                });
            }
            this.logger.info(`Triggered full sync for org ${orgId} with ${sources.length} sources`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to trigger full sync for org ${orgId}:`, error);
            return false;
        }
    }
    async getSystemHealth(context) {
        if (!context.user || context.user.role !== 'admin') {
            throw new Error('Admin access required');
        }
        return {
            status: 'healthy',
            services: {
                neo4j: 'healthy',
                postgres: 'healthy',
                redis: 'healthy'
            },
            metrics: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date()
            },
            timestamp: new Date()
        };
    }
    async searchContent(orgId, query, filters, limit, context) { return { results: [], totalCount: 0, facets: {} }; }
    async getCommit(id, orgId, context) { return null; }
    async getCommits(filter, limit, offset, context) { return []; }
    async getCommitHistory(orgId, branchName, limit, context) { return []; }
    async getEntityVersions(orgId, entityId, entityType, context) { return []; }
    async getClassificationStats(orgId, context) { return { total: 0, bySlot: {}, byConfidence: {}, pending: 0, failed: 0 }; }
    async getProvenanceStats(orgId, context) { return { commits: 0, actions: 0, versions: 0, branches: [] }; }
    async updateProject(input, context) { return null; }
    async deleteProject(id, orgId, context) { return false; }
    async createSource(input, context) { return null; }
    async updateSource(input, context) { return null; }
    async deleteSource(id, orgId, context) { return false; }
    async triggerSourceSync(sourceId, orgId, context) { return false; }
    async createContent(input, context) {
        const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
        return contentService.createContent(input, context.user?.id || 'system');
    }
    async updateContent(input, context) {
        const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
        return contentService.updateContent(input.id, input, context.user?.id || 'system');
    }
    async deleteContent(id, orgId, context) {
        const contentService = new (await Promise.resolve().then(() => __importStar(require('../../services/ContentService')))).ContentService();
        return contentService.deleteContent(id, orgId, context.user?.id || 'system');
    }
    async createCommit(input, context) { return null; }
    async rebuildIndex(orgId, context) { return false; }
    async getFileChildren(fileId, orgId, context) { return []; }
    async getOrganizationUsers(orgId, context) { return []; }
    async getCommitActions(commitId, orgId, context) { return []; }
    getPubSub() {
        return this.pubSub;
    }
}
exports.EnhancedResolvers = EnhancedResolvers;
//# sourceMappingURL=EnhancedResolvers.js.map
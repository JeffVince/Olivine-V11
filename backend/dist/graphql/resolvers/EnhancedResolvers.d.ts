import { GraphQLScalarType } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
export declare class EnhancedResolvers {
    private pubSub;
    private fileResolvers;
    private neo4jService;
    private postgresService;
    private queueService;
    private tenantService;
    private authService;
    private logger;
    constructor();
    getResolvers(): {
        DateTime: GraphQLScalarType<Date | null, any>;
        JSON: GraphQLScalarType<any, any>;
        Query: {
            organization: (_: any, { id }: {
                id: string;
            }, context: any) => Promise<any>;
            organizations: (_: any, __: any, context: any) => Promise<any[]>;
            project: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<any>;
            projects: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<any[]>;
            source: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<any>;
            sources: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<any[]>;
            file: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<any>;
            files: (_: any, { filter, limit, offset }: {
                filter?: any;
                limit?: number;
                offset?: number;
            }, context: any) => Promise<any[]>;
            content: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<import("../../services/ContentService").Content | null>;
            contents: (_: any, { filter, limit, offset }: {
                filter?: any;
                limit?: number;
                offset?: number;
            }, context: any) => Promise<import("../../services/ContentService").Content[]>;
            searchContent: (_: any, { orgId, searchText, type, limit }: {
                orgId: string;
                searchText: string;
                type?: string;
                limit?: number;
            }, context: any) => Promise<{
                results: {
                    content: import("../../services/ContentService").Content;
                    score: number;
                }[];
                totalCount: number;
            }>;
            searchFiles: (_: any, { orgId, query, filters, limit }: {
                orgId: string;
                query: string;
                filters?: any;
                limit?: number;
            }, context: any) => Promise<import("./EnhancedFileResolvers").FileSearchResults>;
            commit: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<any>;
            commits: (_: any, { filter, limit, offset }: {
                filter?: any;
                limit?: number;
                offset?: number;
            }, context: any) => Promise<any[]>;
            commitHistory: (_: any, { orgId, branchName, limit }: {
                orgId: string;
                branchName: string;
                limit?: number;
            }, context: any) => Promise<any[]>;
            entityVersions: (_: any, { orgId, entityId, entityType }: {
                orgId: string;
                entityId: string;
                entityType: string;
            }, context: any) => Promise<any[]>;
            fileStats: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<any>;
            classificationStats: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<any>;
            provenanceStats: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<any>;
            systemHealth: (_: any, __: any, context: any) => Promise<any>;
        };
        Mutation: {
            createProject: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            updateProject: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            deleteProject: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<boolean>;
            createSource: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            updateSource: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            deleteSource: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<boolean>;
            triggerSourceSync: (_: any, { sourceId, orgId }: {
                sourceId: string;
                orgId: string;
            }, context: any) => Promise<boolean>;
            createContent: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            updateContent: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            deleteContent: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }, context: any) => Promise<boolean>;
            classifyFile: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            triggerFileReprocessing: (_: any, { fileId, orgId }: {
                fileId: string;
                orgId: string;
            }, context: any) => Promise<boolean>;
            bulkClassifyFiles: (_: any, { fileIds, orgId }: {
                fileIds: string[];
                orgId: string;
            }, context: any) => Promise<any[]>;
            createCommit: (_: any, { input }: {
                input: any;
            }, context: any) => Promise<any>;
            triggerFullSync: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<boolean>;
            rebuildIndex: (_: any, { orgId }: {
                orgId: string;
            }, context: any) => Promise<boolean>;
        };
        Subscription: {
            fileUpdated: {
                subscribe: (_: any, { orgId, projectId }: {
                    orgId: string;
                    projectId?: string;
                }) => AsyncIterator<unknown, any, any>;
            };
            fileClassified: {
                subscribe: (_: any, { orgId }: {
                    orgId: string;
                }) => AsyncIterator<unknown, any, any>;
            };
            syncProgress: {
                subscribe: (_: any, { orgId, sourceId }: {
                    orgId: string;
                    sourceId: string;
                }) => AsyncIterator<unknown, any, any>;
            };
            classificationProgress: {
                subscribe: (_: any, { orgId }: {
                    orgId: string;
                }) => AsyncIterator<unknown, any, any>;
            };
            commitCreated: {
                subscribe: (_: any, { orgId, projectId }: {
                    orgId: string;
                    projectId?: string;
                }) => AsyncIterator<unknown, any, any>;
            };
            systemEvents: {
                subscribe: (_: any, { orgId }: {
                    orgId: string;
                }) => AsyncIterator<unknown, any, any>;
            };
        };
        File: {
            source: (parent: any, _: any, context: any) => Promise<any>;
            project: (parent: any, _: any, context: any) => Promise<any>;
            parent: (parent: any, _: any, context: any) => Promise<any>;
            children: (parent: any, _: any, context: any) => Promise<any[]>;
            versions: (parent: any, _: any, context: any) => Promise<any[]>;
        };
        Organization: {
            projects: (parent: any, _: any, context: any) => Promise<any[]>;
            sources: (parent: any, _: any, context: any) => Promise<any[]>;
            users: (parent: any, _: any, context: any) => Promise<any[]>;
        };
        Project: {
            organization: (parent: any, _: any, context: any) => Promise<any>;
            files: (parent: any, _: any, context: any) => Promise<any[]>;
            content: (parent: any, _: any, context: any) => Promise<import("../../services/ContentService").Content[]>;
            commits: (parent: any, _: any, context: any) => Promise<any[]>;
        };
        Source: {
            organization: (parent: any, _: any, context: any) => Promise<any>;
            files: (parent: any, _: any, context: any) => Promise<any[]>;
        };
        Commit: {
            organization: (parent: any, _: any, context: any) => Promise<any>;
            project: (parent: any, _: any, context: any) => Promise<any>;
            parent: (parent: any, _: any, context: any) => Promise<any>;
            actions: (parent: any, _: any, context: any) => Promise<any[]>;
        };
    };
    private getOrganization;
    private getOrganizations;
    private getProject;
    private getProjects;
    private getSource;
    private getSources;
    private createProject;
    private createProjectInGraph;
    private triggerFullSync;
    private getSystemHealth;
    private searchContent;
    private getCommit;
    private getCommits;
    private getCommitHistory;
    private getEntityVersions;
    private getClassificationStats;
    private getProvenanceStats;
    private updateProject;
    private deleteProject;
    private createSource;
    private updateSource;
    private deleteSource;
    private triggerSourceSync;
    private createContent;
    private updateContent;
    private deleteContent;
    private createCommit;
    private rebuildIndex;
    private getFileChildren;
    private getOrganizationUsers;
    private getCommitActions;
    getPubSub(): PubSub;
}
//# sourceMappingURL=EnhancedResolvers.d.ts.map
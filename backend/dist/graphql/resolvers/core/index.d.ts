import { GraphQLScalarType } from 'graphql';
export declare function buildCoreResolvers(): {
    JSON: GraphQLScalarType<any, any>;
    Source: {
        createdAt: (src: any) => any;
        updatedAt: (src: any) => any;
    };
    FileMeta: {
        createdAt: (f: any) => any;
        updatedAt: (f: any) => any;
        modifiedAt: (f: any) => any;
        deletedAt: (f: any) => any;
    };
    Query: {
        getSources: (_: any, args: {
            orgId: string;
        }) => Promise<import("../../../models/Source").SourceMetadata[]>;
        getSource: (_: any, args: {
            sourceId: string;
            orgId: string;
        }) => Promise<import("../../../models/Source").SourceMetadata | null>;
        getFiles: (_: any, args: {
            orgId: string;
            sourceId?: string;
            limit?: number;
        }) => Promise<import("../../../models/File").FileMetadata[]>;
        getFile: (_: any, args: {
            fileId: string;
            orgId: string;
        }) => Promise<import("../../../models/File").FileMetadata | null>;
        getFileStats: (_: any, args: {
            orgId: string;
        }) => Promise<{
            total: number;
            byStatus: {
                [status: string]: number;
            };
            byMimeType: {
                [mimeType: string]: number;
            };
        }>;
        getSourceStats: (_: any, args: {
            sourceId: string;
            orgId: string;
        }) => Promise<{
            fileCount: number;
            totalSize: number;
            lastSync: Date | null;
            classificationStats: {
                [status: string]: number;
            };
        }>;
    };
    Mutation: {
        createSource: (_: any, args: {
            orgId: string;
            name: string;
            type: "dropbox" | "google_drive" | "onedrive" | "local";
            config?: any;
        }) => Promise<import("../../../models/Source").SourceMetadata>;
        updateSourceConfig: (_: any, args: {
            sourceId: string;
            orgId: string;
            config: any;
        }) => Promise<boolean>;
        updateSourceStatus: (_: any, args: {
            sourceId: string;
            orgId: string;
            active: boolean;
        }) => Promise<boolean>;
        deleteSource: (_: any, args: {
            sourceId: string;
            orgId: string;
        }) => Promise<boolean>;
        triggerSourceResync: (_: any, args: {
            sourceId: string;
            orgId: string;
        }) => Promise<boolean>;
        reprocessFile: (_: any, args: {
            fileId: string;
            orgId: string;
        }) => Promise<boolean>;
    };
};
//# sourceMappingURL=index.d.ts.map
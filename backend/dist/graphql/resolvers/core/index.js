"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoreResolvers = buildCoreResolvers;
const SourceResolvers_1 = require("../../resolvers/SourceResolvers");
const FileResolvers_1 = require("../../resolvers/FileResolvers");
const graphql_1 = require("graphql");
function buildCoreResolvers() {
    const sourceLogic = new SourceResolvers_1.SourceResolvers();
    const fileLogic = new FileResolvers_1.FileResolvers();
    return {
        JSON: new graphql_1.GraphQLScalarType({
            name: 'JSON',
            description: 'Arbitrary JSON value',
            serialize: (value) => value,
            parseValue: (value) => value,
            parseLiteral(ast) {
                switch (ast.kind) {
                    case graphql_1.Kind.STRING:
                    case graphql_1.Kind.BOOLEAN:
                        return ast.value;
                    case graphql_1.Kind.INT:
                    case graphql_1.Kind.FLOAT:
                        return Number(ast.value);
                    case graphql_1.Kind.OBJECT: {
                        const value = Object.create(null);
                        ast.fields.forEach((field) => {
                            value[field.name.value] = field.value.value;
                        });
                        return value;
                    }
                    case graphql_1.Kind.LIST:
                        return ast.values.map((n) => n.value);
                    case graphql_1.Kind.NULL:
                        return null;
                    default:
                        return null;
                }
            },
        }),
        Source: {
            createdAt: (src) => (src.createdAt instanceof Date ? src.createdAt.toISOString() : src.createdAt),
            updatedAt: (src) => (src.updatedAt instanceof Date ? src.updatedAt.toISOString() : src.updatedAt),
        },
        FileMeta: {
            createdAt: (f) => (f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt),
            updatedAt: (f) => (f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt),
            modifiedAt: (f) => (f.modifiedAt instanceof Date ? f.modifiedAt.toISOString() : f.modifiedAt),
            deletedAt: (f) => (f.deletedAt instanceof Date ? f.deletedAt.toISOString() : f.deletedAt),
        },
        Query: {
            getSources: async (_, args) => {
                return sourceLogic.getSources(args.organizationId);
            },
            getSource: async (_, args) => {
                return sourceLogic.getSource(args.sourceId, args.organizationId);
            },
            getFiles: async (_, args) => {
                return fileLogic.getFiles(args.organizationId, args.sourceId, args.limit);
            },
            getFile: async (_, args) => {
                return fileLogic.getFile(args.fileId, args.organizationId);
            },
            getFileStats: async (_, args) => {
                return fileLogic.getFileStats(args.organizationId);
            },
            getSourceStats: async (_, args) => {
                return sourceLogic.getSourceStats(args.sourceId, args.organizationId);
            },
        },
        Mutation: {
            createSource: async (_, args) => {
                return sourceLogic.createSource(args.organizationId, args.name, args.type, args.config || {});
            },
            updateSourceConfig: async (_, args) => {
                return sourceLogic.updateSourceConfig(args.sourceId, args.organizationId, args.config);
            },
            updateSourceStatus: async (_, args) => {
                return sourceLogic.updateSourceStatus(args.sourceId, args.organizationId, args.active);
            },
            deleteSource: async (_, args) => {
                return sourceLogic.deleteSource(args.sourceId, args.organizationId);
            },
            triggerSourceResync: async (_, args) => {
                return sourceLogic.triggerSourceResync(args.sourceId, args.organizationId);
            },
            reprocessFile: async (_, args) => {
                return fileLogic.reprocessFile(args.fileId, args.organizationId);
            },
        },
    };
}
//# sourceMappingURL=index.js.map
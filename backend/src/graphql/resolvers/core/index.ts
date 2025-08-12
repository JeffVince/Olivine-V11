import { SourceResolvers as SourceLogic } from '../../resolvers/SourceResolvers'
import { FileResolvers as FileLogic } from '../../resolvers/FileResolvers'
import { GraphQLScalarType, Kind } from 'graphql'

export function buildCoreResolvers() {
  const sourceLogic = new SourceLogic()
  const fileLogic = new FileLogic()

  return {
    JSON: new GraphQLScalarType({
      name: 'JSON',
      description: 'Arbitrary JSON value',
      serialize: (value: any) => value,
      parseValue: (value: any) => value,
      parseLiteral(ast) {
        switch (ast.kind) {
          case Kind.STRING:
          case Kind.BOOLEAN:
            return ast.value
          case Kind.INT:
          case Kind.FLOAT:
            return Number(ast.value)
          case Kind.OBJECT: {
            const value: any = Object.create(null)
            ast.fields.forEach((field: any) => {
              value[field.name.value] = (field.value as any).value
            })
            return value
          }
          case Kind.LIST:
            return ast.values.map((n) => (n as any).value)
          case Kind.NULL:
            return null
          default:
            return null
        }
      },
    }),
    Source: {
      createdAt: (src: any) => (src.createdAt instanceof Date ? src.createdAt.toISOString() : src.createdAt),
      updatedAt: (src: any) => (src.updatedAt instanceof Date ? src.updatedAt.toISOString() : src.updatedAt),
    },
    FileMeta: {
      createdAt: (f: any) => (f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt),
      updatedAt: (f: any) => (f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt),
      modifiedAt: (f: any) => (f.modifiedAt instanceof Date ? f.modifiedAt.toISOString() : f.modifiedAt),
      deletedAt: (f: any) => (f.deletedAt instanceof Date ? f.deletedAt.toISOString() : f.deletedAt),
    },
    Query: {
      getSources: async (_: any, args: { organizationId: string }) => {
        return sourceLogic.getSources(args.organizationId)
      },
      getSource: async (_: any, args: { sourceId: string, organizationId: string }) => {
        return sourceLogic.getSource(args.sourceId, args.organizationId)
      },
      getFiles: async (_: any, args: { organizationId: string, sourceId?: string, limit?: number }) => {
        return fileLogic.getFiles(args.organizationId, args.sourceId, args.limit)
      },
      getFile: async (_: any, args: { fileId: string, organizationId: string }) => {
        return fileLogic.getFile(args.fileId, args.organizationId)
      },
      getFileStats: async (_: any, args: { organizationId: string }) => {
        return fileLogic.getFileStats(args.organizationId)
      },
      getSourceStats: async (_: any, args: { sourceId: string, organizationId: string }) => {
        return sourceLogic.getSourceStats(args.sourceId, args.organizationId)
      },
    },
    Mutation: {
      createSource: async (
        _: any,
        args: { organizationId: string, name: string, type: 'dropbox' | 'google_drive' | 'onedrive' | 'local', config?: any }
      ) => {
        return sourceLogic.createSource(args.organizationId, args.name, args.type, args.config || {})
      },
      updateSourceConfig: async (_: any, args: { sourceId: string, organizationId: string, config: any }) => {
        return sourceLogic.updateSourceConfig(args.sourceId, args.organizationId, args.config)
      },
      updateSourceStatus: async (_: any, args: { sourceId: string, organizationId: string, active: boolean }) => {
        return sourceLogic.updateSourceStatus(args.sourceId, args.organizationId, args.active)
      },
      deleteSource: async (_: any, args: { sourceId: string, organizationId: string }) => {
        return sourceLogic.deleteSource(args.sourceId, args.organizationId)
      },
      triggerSourceResync: async (_: any, args: { sourceId: string, organizationId: string }) => {
        return sourceLogic.triggerSourceResync(args.sourceId, args.organizationId)
      },
      reprocessFile: async (_: any, args: { fileId: string, organizationId: string }) => {
        return fileLogic.reprocessFile(args.fileId, args.organizationId)
      },
    },
  }
}



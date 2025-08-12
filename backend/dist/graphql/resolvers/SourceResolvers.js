"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceResolvers = void 0;
const Source_1 = require("../../models/Source");
const File_1 = require("../../models/File");
const EventProcessingService_1 = require("../../services/EventProcessingService");
const FileProcessingService_1 = require("../../services/FileProcessingService");
const QueueService_1 = require("../../services/queues/QueueService");
const DropboxService_1 = require("../../services/DropboxService");
const GoogleDriveService_1 = require("../../services/GoogleDriveService");
class SourceResolvers {
    constructor() {
        this.sourceModel = new Source_1.SourceModel();
        this.fileModel = new File_1.FileModel();
        const eventProcessingService = new EventProcessingService_1.EventProcessingService(null, new QueueService_1.QueueService());
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService(eventProcessingService);
        eventProcessingService.fileProcessingService = this.fileProcessingService;
        this.eventProcessingService = eventProcessingService;
        this.dropboxService = new DropboxService_1.DropboxService();
        this.googleDriveService = new GoogleDriveService_1.GoogleDriveService();
    }
    async getSources(organizationId) {
        return await this.sourceModel.getSourcesByOrganization(organizationId);
    }
    async getSource(sourceId, organizationId) {
        return await this.sourceModel.getSource(sourceId, organizationId);
    }
    async createSource(organizationId, name, type, config) {
        const source = await this.sourceModel.createSource({
            organizationId,
            name,
            type,
            config,
            active: true
        });
        await this.sourceModel.syncToGraph(source);
        return source;
    }
    async updateSourceConfig(sourceId, organizationId, config) {
        const success = await this.sourceModel.updateSourceConfig(sourceId, organizationId, config);
        if (success) {
            const source = await this.sourceModel.getSource(sourceId, organizationId);
            if (source) {
                await this.sourceModel.syncToGraph(source);
            }
        }
        return success;
    }
    async updateSourceStatus(sourceId, organizationId, active) {
        const success = await this.sourceModel.updateSourceStatus(sourceId, organizationId, active);
        if (success) {
            const source = await this.sourceModel.getSource(sourceId, organizationId);
            if (source) {
                await this.sourceModel.syncToGraph(source);
            }
        }
        return success;
    }
    async deleteSource(sourceId, organizationId) {
        try {
            const files = await this.fileModel.getFilesBySource(sourceId, organizationId, 10000);
            for (const file of files) {
                await this.fileModel.deleteFile(file.id, organizationId);
                await this.fileModel.removeFromGraph(file.id, organizationId);
            }
            await this.sourceModel.removeFromGraph(sourceId, organizationId);
            const success = await this.sourceModel.deleteSource(sourceId, organizationId);
            return success;
        }
        catch (error) {
            console.error(`Error deleting source ${sourceId}:`, error);
            return false;
        }
    }
    async getSourceStats(sourceId, organizationId) {
        const files = await this.fileModel.getFilesBySource(sourceId, organizationId, 10000);
        const stats = {
            fileCount: files.length,
            totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
            lastSync: files.length > 0 ? files.reduce((latest, file) => file.updatedAt > latest ? file.updatedAt : latest, files[0].updatedAt) : null,
            classificationStats: {}
        };
        files.forEach(file => {
            const status = file.classificationStatus;
            stats.classificationStats[status] = (stats.classificationStats[status] || 0) + 1;
        });
        return stats;
    }
    async triggerSourceResync(sourceId, organizationId) {
        try {
            const source = await this.sourceModel.getSource(sourceId, organizationId);
            if (!source) {
                throw new Error(`Source not found: ${sourceId}`);
            }
            if (source.type === 'dropbox') {
                const queue = [{ path: '' }];
                while (queue.length > 0) {
                    const { path } = queue.shift();
                    const resp = await this.dropboxService.listFolder(organizationId, sourceId, path, 'home');
                    const entries = (resp?.result?.entries || []);
                    for (const entry of entries) {
                        if (entry['.tag'] === 'folder') {
                            queue.push({ path: entry.path_lower || entry.path_display || '' });
                        }
                        else if (entry['.tag'] === 'file') {
                            await this.fileModel.upsertFile({
                                organizationId,
                                sourceId,
                                path: entry.path_display,
                                name: entry.name,
                                size: entry.size,
                                mimeType: undefined,
                                createdAt: new Date(),
                                modifiedAt: entry.server_modified ? new Date(entry.server_modified) : undefined,
                                metadata: {
                                    dropbox: {
                                        id: entry.id,
                                        rev: entry.rev,
                                        content_hash: entry.content_hash,
                                    }
                                },
                            });
                        }
                    }
                }
                return true;
            }
            else if (source.type === 'google_drive') {
                let pageToken = undefined;
                do {
                    const data = await this.googleDriveService.listFiles(organizationId, sourceId, pageToken);
                    const files = data.files || [];
                    for (const f of files) {
                        if (f.mimeType === 'application/vnd.google-apps.folder')
                            continue;
                        await this.fileModel.upsertFile({
                            organizationId,
                            sourceId,
                            path: f.id,
                            name: f.name,
                            size: f.size ? parseInt(f.size) : undefined,
                            mimeType: f.mimeType,
                            createdAt: new Date(),
                            modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
                            metadata: { gdrive: { id: f.id, parents: f.parents || [] } },
                        });
                    }
                    pageToken = data.nextPageToken;
                } while (pageToken);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`Error triggering resync for source ${sourceId}:`, error);
            return false;
        }
    }
    async testSourceConnection(sourceId, organizationId) {
        try {
            const source = await this.sourceModel.getSource(sourceId, organizationId);
            if (!source) {
                return {
                    success: false,
                    message: 'Source not found'
                };
            }
            const config = source.config;
            switch (source.type) {
                case 'dropbox':
                    if (!config.accessToken) {
                        return {
                            success: false,
                            message: 'Missing Dropbox access token'
                        };
                    }
                    break;
                case 'google_drive':
                    if (!config.accessToken || !config.refreshToken) {
                        return {
                            success: false,
                            message: 'Missing Google Drive tokens'
                        };
                    }
                    break;
                default:
                    return {
                        success: false,
                        message: `Unsupported source type: ${source.type}`
                    };
            }
            return {
                success: true,
                message: 'Connection test passed',
                details: {
                    sourceType: source.type,
                    lastUpdated: source.updatedAt
                }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Connection test failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }
}
exports.SourceResolvers = SourceResolvers;
//# sourceMappingURL=SourceResolvers.js.map
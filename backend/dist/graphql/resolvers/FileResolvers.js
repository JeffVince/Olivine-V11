"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileResolvers = void 0;
const File_1 = require("../../models/File");
const Source_1 = require("../../models/Source");
const FileProcessingService_1 = require("../../services/FileProcessingService");
const QueueService_1 = require("../../services/queues/QueueService");
const EventProcessingService_1 = require("../../services/EventProcessingService");
class FileResolvers {
    constructor() {
        this.fileModel = new File_1.FileModel();
        this.sourceModel = new Source_1.SourceModel();
        const eventProcessingService = new EventProcessingService_1.EventProcessingService(null, new QueueService_1.QueueService());
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService(eventProcessingService);
        eventProcessingService.fileProcessingService = this.fileProcessingService;
        this.eventProcessingService = eventProcessingService;
    }
    async getFiles(orgId, sourceId, limit = 100) {
        if (!orgId || orgId.trim() === '') {
            throw new Error('Organization ID is required');
        }
        if (sourceId) {
            return await this.fileModel.getFilesBySource(sourceId, orgId, limit);
        }
        const sources = await this.sourceModel.getSourcesByOrganization(orgId);
        const allFiles = [];
        for (const source of sources) {
            const sourceFiles = await this.fileModel.getFilesBySource(source.id, orgId, limit);
            allFiles.push(...sourceFiles);
        }
        return allFiles
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, limit);
    }
    async getFile(fileId, orgId) {
        if (!fileId || fileId.trim() === '') {
            throw new Error('File ID is required');
        }
        if (!orgId || orgId.trim() === '') {
            throw new Error('Organization ID is required');
        }
        return await this.fileModel.getFile(fileId, orgId);
    }
    async reprocessFile(fileId, orgId) {
        if (!fileId || fileId.trim() === '') {
            throw new Error('File ID is required');
        }
        if (!orgId || orgId.trim() === '') {
            throw new Error('Organization ID is required');
        }
        try {
            const file = await this.fileModel.getFile(fileId, orgId);
            if (!file) {
                throw new Error('File not found');
            }
            await this.fileProcessingService.processFileChange({
                fileId: file.id,
                orgId: file.orgId,
                sourceId: file.sourceId,
                filePath: file.path,
                action: 'update',
                metadata: file.metadata
            });
            return true;
        }
        catch (error) {
            console.error(`Error reprocessing file ${fileId}:`, error);
            return false;
        }
    }
    async getFileClassificationStatus(fileId, orgId) {
        const file = await this.fileModel.getFile(fileId, orgId);
        return file?.classificationStatus || null;
    }
    async searchFiles(orgId, query, sourceId, mimeType, limit = 50) {
        const sources = sourceId
            ? [await this.sourceModel.getSource(sourceId, orgId)].filter(Boolean)
            : await this.sourceModel.getSourcesByOrganization(orgId);
        const searchResults = [];
        for (const source of sources) {
            if (!source)
                continue;
            const files = await this.fileModel.getFilesBySource(source.id, orgId, 1000);
            const filteredFiles = files.filter(file => {
                if (mimeType && file.mimeType !== mimeType) {
                    return false;
                }
                const searchText = query.toLowerCase();
                const fileName = file.name.toLowerCase();
                const extractedText = (file.extractedText || '').toLowerCase();
                return fileName.includes(searchText) || extractedText.includes(searchText);
            });
            searchResults.push(...filteredFiles);
        }
        return searchResults
            .sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a, query);
            const scoreB = this.calculateRelevanceScore(b, query);
            return scoreB - scoreA;
        })
            .slice(0, limit);
    }
    async getFileStats(orgId) {
        const sources = await this.sourceModel.getSourcesByOrganization(orgId);
        const stats = {
            total: 0,
            byStatus: {},
            byMimeType: {}
        };
        for (const source of sources) {
            const files = await this.fileModel.getFilesBySource(source.id, orgId, 10000);
            stats.total += files.length;
            files.forEach(file => {
                const status = file.classificationStatus;
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
                const mimeType = file.mimeType || 'unknown';
                stats.byMimeType[mimeType] = (stats.byMimeType[mimeType] || 0) + 1;
            });
        }
        return stats;
    }
    calculateRelevanceScore(file, query) {
        const searchText = query.toLowerCase();
        let score = 0;
        if (file.name.toLowerCase().includes(searchText)) {
            score += 10;
        }
        if (file.extractedText && file.extractedText.toLowerCase().includes(searchText)) {
            score += 5;
        }
        const daysSinceUpdate = (Date.now() - file.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) {
            score += 2;
        }
        return score;
    }
}
exports.FileResolvers = FileResolvers;
//# sourceMappingURL=FileResolvers.js.map
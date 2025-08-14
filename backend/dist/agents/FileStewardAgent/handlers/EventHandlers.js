"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandlers = void 0;
const mime_1 = require("../utils/mime");
class EventHandlers {
    constructor(deps) {
        this.files = deps.files;
        this.folders = deps.folders;
        this.classification = deps.classification;
        this.content = deps.content;
        this.queues = deps.queues;
        this.postgres = deps.postgres;
        this.classifier = deps.classifier;
        this.extractor = deps.extractor;
        this.clusterMode = deps.clusterMode;
        this.eventBus = deps.eventBus;
    }
    extractFileMetadata(eventData) {
        if (eventData.entry) {
            return {
                name: eventData.entry.name,
                size: eventData.entry.size || 0,
                mimeType: (0, mime_1.inferMimeType)(eventData.entry.name),
                checksum: eventData.entry.content_hash,
                modified: eventData.entry.server_modified,
                dbId: eventData.entry.id,
                provider: 'dropbox',
                extra: { rev: eventData.entry.rev, pathDisplay: eventData.entry.path_display }
            };
        }
        else if (eventData.file) {
            return {
                name: eventData.file.name,
                size: parseInt(eventData.file.size) || 0,
                mimeType: eventData.file.mimeType,
                checksum: eventData.file.md5Checksum,
                modified: eventData.file.modifiedTime,
                dbId: eventData.file.id,
                provider: 'gdrive',
                extra: { version: eventData.file.version, webViewLink: eventData.file.webViewLink }
            };
        }
        else {
            return {
                name: eventData.name,
                size: eventData.size || 0,
                mimeType: eventData.mime_type || (0, mime_1.inferMimeType)(eventData.name),
                checksum: eventData.checksum,
                modified: eventData.modified,
                dbId: eventData.id,
                provider: 'supabase',
                extra: { bucket: eventData.bucket_id }
            };
        }
    }
    async ensureFolderHierarchy(orgId, sourceId, filePath) {
        const pathParts = filePath.split('/').filter(part => part.length > 0);
        pathParts.pop();
        let currentPath = '';
        for (const folderName of pathParts) {
            currentPath += `/${folderName}`;
            await this.folders.upsertFolderNode(orgId, sourceId, currentPath, folderName);
        }
    }
    async handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId) {
        const metadata = this.extractFileMetadata(eventData);
        const fileId = await this.files.upsertFileNode({
            orgId,
            sourceId,
            resourcePath,
            dbId: metadata.dbId,
            name: metadata.name,
            size: metadata.size,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum || null,
            modified: metadata.modified,
            metadataJson: JSON.stringify(metadata.extra || {})
        });
        await this.ensureFolderHierarchy(orgId, sourceId, resourcePath);
        if (this.clusterMode) {
            this.eventBus.emit('file.processed', {
                type: 'file.processed',
                orgId,
                fileId,
                clusterId: '',
                slots: [],
                extractionTriggered: false,
                eventType: 'created',
                timestamp: new Date().toISOString(),
                agent: 'file-steward-agent'
            });
        }
        else {
            if (this.shouldClassifyFile(metadata.mimeType)) {
                await this.queues.addJob('file-classification', 'classify-file', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata });
            }
            if (this.shouldExtractContent(metadata.mimeType)) {
                await this.queues.addJob('content-extraction', 'extract-content', { orgId, fileId, filePath: resourcePath, sourceId, commitId, metadata });
            }
        }
    }
    async handleFileUpdated(orgId, sourceId, resourcePath, eventData, commitId) {
        const metadata = this.extractFileMetadata(eventData);
        const existing = await this.files.getFileNode(orgId, sourceId, resourcePath);
        if (!existing) {
            await this.handleFileCreated(orgId, sourceId, resourcePath, eventData, commitId);
            return;
        }
        await this.files.updateFileNode(existing.id, {
            name: metadata.name,
            size: metadata.size,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum || null,
            modified: metadata.modified,
            metadataJson: JSON.stringify(metadata.extra || {})
        });
        if (this.hasSignificantChanges(existing.properties, metadata)) {
            await this.queues.addJob('file-classification', 'classify-file', { orgId, fileId: existing.id, filePath: resourcePath, sourceId, commitId, metadata });
        }
    }
    async handleFileDeleted(orgId, sourceId, resourcePath, _eventData, _commitId) {
        const existing = await this.files.getFileNode(orgId, sourceId, resourcePath);
        if (!existing)
            return;
        await this.files.softDeleteFileNode(existing.id);
    }
    async classifyFile(jobData) {
        const { orgId, fileId, filePath, metadata, fileContent } = jobData;
        await this.classifier.classifyAndApply({
            orgId,
            fileId,
            filePath,
            metadata,
            fileContent,
            classificationRepo: this.classification
        });
    }
    async extractContent(jobData) {
        const { orgId, fileId, filePath, metadata } = jobData;
        const content = await this.extractor.extractContent({ orgId, sourceId: metadata.sourceId, path: filePath, mimeType: metadata.mimeType });
        await this.content.updateFileContent(fileId, content);
    }
    shouldClassifyFile(mimeType) {
        const classifiable = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'video/mp4',
            'audio/mpeg'
        ];
        return classifiable.includes(mimeType);
    }
    shouldExtractContent(mimeType) {
        const extractable = [
            'application/pdf',
            'text/plain',
            'text/html',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/tiff'
        ];
        return extractable.includes(mimeType);
    }
    hasSignificantChanges(oldMetadata, newMetadata) {
        if (oldMetadata.name !== newMetadata.name)
            return true;
        const sizeChange = Math.abs(oldMetadata.size - newMetadata.size) / oldMetadata.size;
        if (sizeChange > 0.1)
            return true;
        const modifiedTime = new Date(newMetadata.modified);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return modifiedTime > oneHourAgo;
    }
}
exports.EventHandlers = EventHandlers;
//# sourceMappingURL=EventHandlers.js.map
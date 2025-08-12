"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileProcessingService = void 0;
const File_1 = require("../models/File");
const Source_1 = require("../models/Source");
const DropboxService_1 = require("./DropboxService");
const GoogleDriveService_1 = require("./GoogleDriveService");
class FileProcessingService {
    constructor(eventProcessingService) {
        this.eventProcessingService = eventProcessingService;
        this.fileModel = new File_1.FileModel();
        this.sourceModel = new Source_1.SourceModel();
        this.dropboxService = new DropboxService_1.DropboxService();
        this.googleDriveService = new GoogleDriveService_1.GoogleDriveService();
    }
    async extractContent(params, path, mimeType) {
        let sourceId;
        let filePath;
        let fileMimeType;
        if (typeof params === 'object') {
            sourceId = params.sourceId;
            filePath = params.path;
            fileMimeType = params.mimeType;
        }
        else {
            sourceId = params;
            filePath = path;
            fileMimeType = mimeType;
        }
        try {
            if (fileMimeType.startsWith('text/')) {
                return `Extracted content from text file: ${filePath}`;
            }
            else if (fileMimeType.startsWith('image/')) {
                return `Image content from file: ${filePath}`;
            }
            else if (fileMimeType.startsWith('application/')) {
                return `Application content from file: ${filePath}`;
            }
            else {
                return `Content from file: ${filePath}`;
            }
        }
        catch (error) {
            console.error(`Error extracting content from file ${filePath}:`, error);
            throw error;
        }
    }
    async processFileChange(jobData) {
        const { fileId, organizationId, sourceId, filePath, action, metadata } = jobData;
        console.log(`Processing file change: ${action} for ${filePath} in source ${sourceId}`);
        try {
            const source = await this.sourceModel.getSource(sourceId, organizationId);
            if (!source) {
                throw new Error(`Source not found: ${sourceId}`);
            }
            switch (action) {
                case 'create':
                case 'update':
                    await this.handleFileCreateOrUpdate(fileId, organizationId, source, filePath, metadata);
                    break;
                case 'delete':
                    await this.handleFileDelete(fileId, organizationId, sourceId, filePath);
                    break;
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
            console.log(`Successfully processed file change: ${action} for ${filePath}`);
        }
        catch (error) {
            console.error(`Error processing file change for ${filePath}:`, error);
            throw error;
        }
    }
    async handleFileCreateOrUpdate(fileId, organizationId, source, filePath, metadata) {
        const fileName = this.extractFileName(filePath);
        const fileExtension = this.extractFileExtension(fileName);
        const mimeType = this.determineMimeType(fileExtension, metadata);
        const fileData = {
            id: fileId,
            organizationId,
            sourceId: source.id,
            path: filePath,
            name: fileName,
            extension: fileExtension,
            mimeType,
            size: metadata?.size,
            modifiedAt: metadata?.modified_at ? new Date(metadata.modified_at) : undefined,
            metadata: metadata,
            classificationStatus: 'pending'
        };
        const savedFile = await this.fileModel.upsertFile(fileData);
        await this.fileModel.syncToGraph(savedFile);
        if (this.shouldProcessForClassification(mimeType)) {
            await this.queueFileForClassification(savedFile, source);
        }
        if (this.shouldProcessForExtraction(mimeType)) {
            await this.queueFileForExtraction(savedFile, source);
        }
        await this.eventProcessingService.addSyncJob({
            fileId: savedFile.id,
            sourceId: source.id,
            orgId: organizationId,
            action: 'update',
            filePath,
            metadata
        });
    }
    async handleFileDelete(fileId, organizationId, sourceId, filePath) {
        await this.fileModel.deleteFile(fileId, organizationId);
        await this.fileModel.removeFromGraph(fileId, organizationId);
        await this.eventProcessingService.addSyncJob({
            fileId,
            sourceId,
            orgId: organizationId,
            action: 'delete',
            filePath,
            metadata: {}
        });
    }
    async queueFileForClassification(file, source) {
        try {
            const fileContent = await this.downloadFileContent(file, source);
            if (fileContent) {
                await this.eventProcessingService.addClassificationJob({
                    fileId: file.id,
                    orgId: file.organizationId,
                    fileContent,
                    mimeType: file.mimeType || 'application/octet-stream'
                });
                await this.fileModel.updateClassification(file.id, file.organizationId, { type: 'unknown', confidence: 0, categories: [], tags: [] }, 'processing');
            }
        }
        catch (error) {
            console.error(`Error queueing file for classification: ${file.path}`, error);
            await this.fileModel.updateClassification(file.id, file.organizationId, { type: 'unknown', confidence: 0, categories: [], tags: [] }, 'failed');
        }
    }
    async queueFileForExtraction(file, source) {
        try {
            const fileContent = await this.downloadFileContent(file, source);
            if (fileContent) {
                await this.eventProcessingService.addExtractionJob({
                    fileId: file.id,
                    orgId: file.organizationId,
                    fileContent,
                    mimeType: file.mimeType || 'application/octet-stream'
                });
            }
        }
        catch (error) {
            console.error(`Error queueing file for extraction: ${file.path}`, error);
        }
    }
    async downloadFileContent(file, source) {
        try {
            switch (source.type) {
                case 'dropbox':
                    return await this.downloadFromDropbox(file, source);
                case 'google_drive':
                    return await this.downloadFromGoogleDrive(file, source);
                default:
                    console.warn(`Unsupported source type for content download: ${source.type}`);
                    return null;
            }
        }
        catch (error) {
            console.error(`Error downloading file content for ${file.path}:`, error);
            return null;
        }
    }
    async downloadFromDropbox(file, source) {
        try {
            console.log(`Downloading from Dropbox: ${file.path}`);
            return null;
        }
        catch (error) {
            console.error(`Error downloading from Dropbox: ${file.path}`, error);
            return null;
        }
    }
    async downloadFromGoogleDrive(file, source) {
        try {
            console.log(`Downloading from Google Drive: ${file.path}`);
            return null;
        }
        catch (error) {
            console.error(`Error downloading from Google Drive: ${file.path}`, error);
            return null;
        }
    }
    extractFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }
    extractFileExtension(fileName) {
        const lastDotIndex = fileName.lastIndexOf('.');
        return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : undefined;
    }
    determineMimeType(extension, metadata) {
        if (metadata?.mime_type) {
            return metadata.mime_type;
        }
        if (!extension) {
            return undefined;
        }
        const mimeTypes = {
            'txt': 'text/plain',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'mp4': 'video/mp4',
            'mp3': 'audio/mpeg',
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'ts': 'application/typescript'
        };
        return mimeTypes[extension];
    }
    shouldProcessForClassification(mimeType) {
        if (!mimeType)
            return false;
        const classifiableMimeTypes = [
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        return classifiableMimeTypes.includes(mimeType);
    }
    shouldProcessForExtraction(mimeType) {
        if (!mimeType)
            return false;
        const extractableMimeTypes = [
            'text/plain',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/json',
            'text/html',
            'text/css',
            'application/javascript',
            'application/typescript'
        ];
        return extractableMimeTypes.includes(mimeType);
    }
}
exports.FileProcessingService = FileProcessingService;
//# sourceMappingURL=FileProcessingService.js.map
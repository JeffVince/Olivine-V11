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
    async extractContent(params, path, mimeType, orgIdParam) {
        let orgId;
        let sourceId;
        let filePath;
        let fileMimeType;
        if (typeof params === 'object') {
            orgId = params.orgId;
            sourceId = params.sourceId;
            filePath = params.path;
            fileMimeType = params.mimeType;
        }
        else {
            sourceId = params;
            filePath = path;
            fileMimeType = mimeType;
            orgId = orgIdParam;
        }
        try {
            const source = await this.sourceModel.getSource(sourceId, orgId);
            if (source) {
                const syntheticFile = {
                    id: 'temp',
                    organizationId: orgId,
                    sourceId: sourceId,
                    path: filePath,
                    name: this.extractFileName(filePath),
                    extension: this.extractFileExtension(this.extractFileName(filePath)),
                    mimeType: fileMimeType,
                    size: undefined,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    classificationStatus: 'pending'
                };
                const downloaded = await this.downloadFileContent(syntheticFile, source);
                if (downloaded)
                    return downloaded;
            }
            if (fileMimeType.startsWith('text/'))
                return `Extracted content from text file: ${filePath}`;
            if (fileMimeType.startsWith('image/'))
                return `Image content from file: ${filePath}`;
            if (fileMimeType.startsWith('application/'))
                return `Application content from file: ${filePath}`;
            return `Content from file: ${filePath}`;
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
        const modifiedRaw = metadata?.modified_at || metadata?.modified || metadata?.modifiedTime;
        const parsedModifiedAt = modifiedRaw ? new Date(modifiedRaw) : undefined;
        const fileData = {
            id: fileId,
            organizationId,
            sourceId: source.id,
            path: filePath,
            name: fileName,
            extension: fileExtension,
            mimeType,
            size: metadata?.size,
            modifiedAt: parsedModifiedAt,
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
            metadata: metadata
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
            const result = await this.dropboxService.downloadFile(file.organizationId, source.id, file.path);
            let buffer = null;
            if (result?.fileBinary) {
                const binary = result.fileBinary;
                if (binary instanceof ArrayBuffer) {
                    buffer = Buffer.from(binary);
                }
                else if (binary instanceof Uint8Array) {
                    buffer = Buffer.from(binary);
                }
                else if (typeof binary === 'string') {
                    buffer = Buffer.from(binary, 'binary');
                }
            }
            else if (result?.fileBlob && typeof result.fileBlob.arrayBuffer === 'function') {
                const arr = await result.fileBlob.arrayBuffer();
                buffer = Buffer.from(arr);
            }
            else if (result?.fileContent && (result.fileContent instanceof Uint8Array || result.fileContent instanceof ArrayBuffer)) {
                const fc = result.fileContent;
                buffer = Buffer.from(fc);
            }
            if (!buffer) {
                console.warn(`Dropbox download returned no binary for ${file.path}`);
                return null;
            }
            const mimeType = file.mimeType || 'application/octet-stream';
            const isText = this.isTextMimeType(mimeType);
            return isText ? buffer.toString('utf8') : buffer.toString('base64');
        }
        catch (error) {
            console.error(`Error downloading from Dropbox: ${file.path}`, error);
            return null;
        }
    }
    async downloadFromGoogleDrive(file, source) {
        try {
            const meta = (file.metadata || {});
            const candidateId = (meta['id'] || meta['file_id']);
            if (!candidateId) {
                console.warn(`Missing Google Drive file ID in metadata for ${file.path}`);
                return null;
            }
            const streamOrData = await this.googleDriveService.downloadFile(file.organizationId, source.id, candidateId);
            let buffer = null;
            if (streamOrData && typeof streamOrData.read === 'function') {
                buffer = await this.streamToBuffer(streamOrData);
            }
            else if (Buffer.isBuffer(streamOrData)) {
                buffer = streamOrData;
            }
            else if (streamOrData instanceof Uint8Array || streamOrData instanceof ArrayBuffer) {
                buffer = Buffer.from(streamOrData);
            }
            if (!buffer) {
                console.warn(`Google Drive download returned no binary for ${file.path}`);
                return null;
            }
            const mimeType = file.mimeType || 'application/octet-stream';
            const isText = this.isTextMimeType(mimeType);
            return isText ? buffer.toString('utf8') : buffer.toString('base64');
        }
        catch (error) {
            console.error(`Error downloading from Google Drive: ${file.path}`, error);
            return null;
        }
    }
    isTextMimeType(mimeType) {
        if (!mimeType)
            return false;
        return (mimeType.startsWith('text/') ||
            mimeType === 'application/json' ||
            mimeType === 'application/javascript' ||
            mimeType === 'application/typescript' ||
            mimeType === 'application/xml');
    }
    streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
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
    async getProcessingStatistics(orgId) {
        const postgresService = this.fileModel?.postgresService || new (require('../services/PostgresService').PostgresService)();
        const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM files
      WHERE (org_id = $1 OR organization_id = $1) AND deleted_at IS NULL
    `;
        const classifiedQuery = `
      SELECT COUNT(*)::int AS classified
      FROM files
      WHERE (org_id = $1 OR organization_id = $1) AND deleted_at IS NULL AND classification_status = 'completed'
    `;
        const [totalRes, classifiedRes] = await Promise.all([
            postgresService.executeQuery(totalQuery, [orgId]),
            postgresService.executeQuery(classifiedQuery, [orgId])
        ]);
        const total = totalRes.rows[0]?.total || 0;
        const classified = classifiedRes.rows[0]?.classified || 0;
        const rate = total > 0 ? classified / total : 0;
        return {
            total_files: total,
            classified_files: classified,
            classification_rate: rate
        };
    }
    async processFileWithAI(fileRequest) {
        return {
            fileId: fileRequest.fileId,
            classification: {
                type: 'document',
                confidence: 0.8,
                categories: ['general'],
                tags: ['processed']
            },
            extractedText: 'Extracted text from file'
        };
    }
}
exports.FileProcessingService = FileProcessingService;
//# sourceMappingURL=FileProcessingService.js.map
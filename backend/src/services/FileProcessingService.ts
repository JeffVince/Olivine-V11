import { EventProcessingService } from './EventProcessingService';
import { FileModel, FileMetadata, FileClassification } from '../models/File';
import { SourceModel, SourceMetadata } from '../models/Source';
import { DropboxService } from './DropboxService';
import { GoogleDriveService } from './GoogleDriveService';

export interface FileProcessingJobData {
  fileId: string;
  organizationId: string;
  sourceId: string;
  filePath: string;
  action: 'create' | 'update' | 'delete';
  metadata?: any;
}

export class FileProcessingService {
  // Implementation Plan - 02-Data-Ingestion-Implementation.md - File processing service implementation
  // Implementation Plan - 06-Agent-System-Implementation.md - Event processing service integration
  // Implementation Checklist - 07-Testing-QA-Checklist.md - Backend file processing tests
  private eventProcessingService: EventProcessingService;
  private fileModel: FileModel;
  private sourceModel: SourceModel;
  private dropboxService: DropboxService;
  private googleDriveService: GoogleDriveService;

  constructor() {
    this.eventProcessingService = new EventProcessingService();
    this.fileModel = new FileModel();
    this.sourceModel = new SourceModel();
    this.dropboxService = new DropboxService();
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * Extract content from a file
   * @param params Object containing file parameters or sourceId
   * @param path The file path (optional if using object param)
   * @param mimeType The MIME type of the file (optional if using object param)
   * @returns The extracted content
   */
  async extractContent(params: { sourceId: string; path: string; mimeType: string } | string, path?: string, mimeType?: string): Promise<string> {
    // Handle both object parameter and separate parameters for backward compatibility
    let sourceId: string;
    let filePath: string;
    let fileMimeType: string;
    
    if (typeof params === 'object') {
      sourceId = params.sourceId;
      filePath = params.path;
      fileMimeType = params.mimeType;
    } else {
      sourceId = params;
      filePath = path!;
      fileMimeType = mimeType!;
    }
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend file processing tests
    try {
      // Handle different mime types for content extraction
      if (fileMimeType.startsWith('text/')) {
        // For text files, return the content as is
        return `Extracted content from text file: ${filePath}`;
      } else if (fileMimeType.startsWith('image/')) {
        // For image files, return a placeholder description
        return `Image content from file: ${filePath}`;
      } else if (fileMimeType.startsWith('application/')) {
        // For application files (documents, etc.), return a placeholder
        return `Application content from file: ${filePath}`;
      } else {
        // For other file types, return a generic placeholder
        return `Content from file: ${filePath}`;
      }
    } catch (error) {
      console.error(`Error extracting content from file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process file changes from external sources (Dropbox, Google Drive, etc.)
   * This is the main entry point for file sync operations
   */
  async processFileChange(jobData: FileProcessingJobData): Promise<void> {
    const { fileId, organizationId, sourceId, filePath, action, metadata } = jobData;
    
    console.log(`Processing file change: ${action} for ${filePath} in source ${sourceId}`);
    
    try {
      // Get source information
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
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Handle file creation or update
   */
  private async handleFileCreateOrUpdate(
    fileId: string,
    organizationId: string,
    source: SourceMetadata,
    filePath: string,
    metadata: any
  ): Promise<void> {
    // Extract file information from path and metadata
    const fileName = this.extractFileName(filePath);
    const fileExtension = this.extractFileExtension(fileName);
    const mimeType = this.determineMimeType(fileExtension, metadata);
    
    // Create or update file record
    const fileData: Partial<FileMetadata> = {
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
    
    // Sync to Neo4j knowledge graph
    await this.fileModel.syncToGraph(savedFile);
    
    // Queue for classification and content extraction if it's a supported file type
    if (this.shouldProcessForClassification(mimeType)) {
      await this.queueFileForClassification(savedFile, source);
    }
    
    if (this.shouldProcessForExtraction(mimeType)) {
      await this.queueFileForExtraction(savedFile, source);
    }
    
    // Add to file sync queue for any additional processing
    await this.eventProcessingService.addSyncJob({
      fileId: savedFile.id,
      sourceId: source.id,
      orgId: organizationId,
      action: 'update',
      filePath,
      metadata
    });
  }

  /**
   * Handle file deletion
   */
  private async handleFileDelete(
    fileId: string,
    organizationId: string,
    sourceId: string,
    filePath: string
  ): Promise<void> {
    // Mark file as deleted in PostgreSQL
    await this.fileModel.deleteFile(fileId, organizationId);
    
    // Remove from Neo4j knowledge graph
    await this.fileModel.removeFromGraph(fileId, organizationId);
    
    // Add to file sync queue for cleanup
    await this.eventProcessingService.addSyncJob({
      fileId,
      sourceId,
      orgId: organizationId,
      action: 'delete',
      filePath,
      metadata: {}
    });
  }

  /**
   * Queue file for AI classification
   */
  private async queueFileForClassification(file: FileMetadata, source: SourceMetadata): Promise<void> {
    try {
      // Download file content for classification
      const fileContent = await this.downloadFileContent(file, source);
      
      if (fileContent) {
        await this.eventProcessingService.addClassificationJob({
          fileId: file.id,
          orgId: file.organizationId,
          fileContent,
          mimeType: file.mimeType || 'application/octet-stream'
        });
        
        // Update classification status to processing
        await this.fileModel.updateClassification(
          file.id,
          file.organizationId,
          { type: 'unknown', confidence: 0, categories: [], tags: [] },
          'processing'
        );
      }
    } catch (error) {
      console.error(`Error queueing file for classification: ${file.path}`, error);
      // Update classification status to failed
      await this.fileModel.updateClassification(
        file.id,
        file.organizationId,
        { type: 'unknown', confidence: 0, categories: [], tags: [] },
        'failed'
      );
    }
  }

  /**
   * Queue file for content extraction
   */
  private async queueFileForExtraction(file: FileMetadata, source: SourceMetadata): Promise<void> {
    try {
      // Download file content for extraction
      const fileContent = await this.downloadFileContent(file, source);
      
      if (fileContent) {
        await this.eventProcessingService.addExtractionJob({
          fileId: file.id,
          orgId: file.organizationId,
          fileContent,
          mimeType: file.mimeType || 'application/octet-stream'
        });
      }
    } catch (error) {
      console.error(`Error queueing file for extraction: ${file.path}`, error);
    }
  }

  /**
   * Download file content from the source
   */
  private async downloadFileContent(file: FileMetadata, source: SourceMetadata): Promise<string | null> {
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
    } catch (error) {
      console.error(`Error downloading file content for ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Download file content from Dropbox
   */
  private async downloadFromDropbox(file: FileMetadata, source: SourceMetadata): Promise<string | null> {
    try {
      // Use DropboxService to download file content
      // This would need to be implemented in DropboxService
      console.log(`Downloading from Dropbox: ${file.path}`);
      // Placeholder - would implement actual download logic
      return null;
    } catch (error) {
      console.error(`Error downloading from Dropbox: ${file.path}`, error);
      return null;
    }
  }

  /**
   * Download file content from Google Drive
   */
  private async downloadFromGoogleDrive(file: FileMetadata, source: SourceMetadata): Promise<string | null> {
    try {
      // Use GoogleDriveService to download file content
      // This would need to be implemented in GoogleDriveService
      console.log(`Downloading from Google Drive: ${file.path}`);
      // Placeholder - would implement actual download logic
      return null;
    } catch (error) {
      console.error(`Error downloading from Google Drive: ${file.path}`, error);
      return null;
    }
  }

  /**
   * Extract file name from path
   */
  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Extract file extension from filename
   */
  private extractFileExtension(fileName: string): string | undefined {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : undefined;
  }

  /**
   * Determine MIME type from extension and metadata
   */
  private determineMimeType(extension?: string, metadata?: any): string | undefined {
    if (metadata?.mime_type) {
      return metadata.mime_type;
    }
    
    if (!extension) {
      return undefined;
    }
    
    // Basic MIME type mapping
    const mimeTypes: { [key: string]: string } = {
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

  /**
   * Determine if file should be processed for classification
   */
  private shouldProcessForClassification(mimeType?: string): boolean {
    if (!mimeType) return false;
    
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

  /**
   * Determine if file should be processed for content extraction
   */
  private shouldProcessForExtraction(mimeType?: string): boolean {
    if (!mimeType) return false;
    
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

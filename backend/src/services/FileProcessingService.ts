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
  metadata?: Record<string, unknown>;
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

  constructor(eventProcessingService: EventProcessingService) {
    this.eventProcessingService = eventProcessingService;
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
  async extractContent(
    params: { orgId: string; sourceId: string; path: string; mimeType: string } | string,
    path?: string,
    mimeType?: string,
    orgIdParam?: string
  ): Promise<string> {
    // Handle both object parameter and separate parameters for backward compatibility
    let orgId: string;
    let sourceId: string;
    let filePath: string;
    let fileMimeType: string;
    
    if (typeof params === 'object') {
      orgId = params.orgId;
      sourceId = params.sourceId;
      filePath = params.path;
      fileMimeType = params.mimeType;
    } else {
      sourceId = params;
      filePath = path!;
      fileMimeType = mimeType!;
      orgId = orgIdParam!;
    }
    // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend file processing tests
    try {
      // Handle different mime types for content extraction
      // Try to download from provider first to extract real content
      const source = await this.sourceModel.getSource(sourceId, orgId);
      if (source) {
        const syntheticFile: FileMetadata = {
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
        if (downloaded) return downloaded;
      }

      // Fallback: synthesize content when provider download is not available
      if (fileMimeType.startsWith('text/')) return `Extracted content from text file: ${filePath}`;
      if (fileMimeType.startsWith('image/')) return `Image content from file: ${filePath}`;
      if (fileMimeType.startsWith('application/')) return `Application content from file: ${filePath}`;
      return `Content from file: ${filePath}`;
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
    metadata: unknown
  ): Promise<void> {
    // Extract file information from path and metadata
    const fileName = this.extractFileName(filePath);
    const fileExtension = this.extractFileExtension(fileName);
    const mimeType = this.determineMimeType(fileExtension, metadata as Record<string, unknown>);
    
    // Create or update file record
    const modifiedRaw = (metadata as any)?.modified_at || (metadata as any)?.modified || (metadata as any)?.modifiedTime;
    const parsedModifiedAt = modifiedRaw ? new Date(modifiedRaw as string) : undefined;

    const fileData: Partial<FileMetadata> = {
      id: fileId,
      organizationId,
      sourceId: source.id,
      path: filePath,
      name: fileName,
      extension: fileExtension,
      mimeType,
      size: (metadata as any)?.size as number | undefined,
      modifiedAt: parsedModifiedAt,
      metadata: metadata as Record<string, unknown>,
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
      metadata: metadata as Record<string, unknown>
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
      const result: any = await this.dropboxService.downloadFile(
        file.organizationId,
        source.id,
        file.path
      );

      // Dropbox SDK returns different shapes depending on environment
      // Prefer ArrayBuffer/Uint8Array if available; fallback to Blob
      let buffer: Buffer | null = null;

      if (result?.fileBinary) {
        const binary = result.fileBinary as ArrayBuffer | Uint8Array | string;
        if (binary instanceof ArrayBuffer) {
          buffer = Buffer.from(binary);
        } else if (binary instanceof Uint8Array) {
          buffer = Buffer.from(binary);
        } else if (typeof binary === 'string') {
          buffer = Buffer.from(binary, 'binary');
        }
      } else if (result?.fileBlob && typeof result.fileBlob.arrayBuffer === 'function') {
        const arr = await result.fileBlob.arrayBuffer();
        buffer = Buffer.from(arr);
      } else if (result?.fileContent && (result.fileContent instanceof Uint8Array || result.fileContent instanceof ArrayBuffer)) {
        const fc = result.fileContent as Uint8Array | ArrayBuffer;
        buffer = Buffer.from(fc as any);
      }

      if (!buffer) {
        console.warn(`Dropbox download returned no binary for ${file.path}`);
        return null;
      }

      const mimeType = file.mimeType || 'application/octet-stream';
      const isText = this.isTextMimeType(mimeType);
      return isText ? buffer.toString('utf8') : buffer.toString('base64');
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
      // We need a Google Drive file ID to download. Try to resolve from stored metadata
      const meta = (file.metadata || {}) as Record<string, unknown>;
      const candidateId = (meta['id'] || meta['file_id']) as string | undefined;

      if (!candidateId) {
        console.warn(`Missing Google Drive file ID in metadata for ${file.path}`);
        return null;
      }

      const streamOrData: any = await this.googleDriveService.downloadFile(
        file.organizationId,
        source.id,
        candidateId
      );

      // downloadFile returns a stream for media. Normalize to Buffer
      let buffer: Buffer | null = null;

      if (streamOrData && typeof streamOrData.read === 'function') {
        buffer = await this.streamToBuffer(streamOrData);
      } else if (Buffer.isBuffer(streamOrData)) {
        buffer = streamOrData as Buffer;
      } else if (streamOrData instanceof Uint8Array || streamOrData instanceof ArrayBuffer) {
        buffer = Buffer.from(streamOrData as any);
      }

      if (!buffer) {
        console.warn(`Google Drive download returned no binary for ${file.path}`);
        return null;
      }

      const mimeType = file.mimeType || 'application/octet-stream';
      const isText = this.isTextMimeType(mimeType);
      return isText ? buffer.toString('utf8') : buffer.toString('base64');
    } catch (error) {
      console.error(`Error downloading from Google Drive: ${file.path}`, error);
      return null;
    }
  }

  /**
   * Determine whether the mime type should be treated as text
   */
  private isTextMimeType(mimeType: string): boolean {
    if (!mimeType) return false;
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'application/xml'
    );
  }

  /**
   * Convert a readable stream into a Buffer
   */
  private streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
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
  private determineMimeType(extension?: string, metadata?: Record<string, unknown>): string | undefined {
    if (metadata?.mime_type) {
      return metadata.mime_type as string;
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
  
  /**
   * Get processing statistics
   */
  async getProcessingStatistics(orgId: string): Promise<{ total_files: number; classified_files: number; classification_rate: number }> {
    const postgresService = (this.fileModel as any)?.postgresService || new (require('../services/PostgresService').PostgresService)();
    const totalQuery = `
      SELECT COUNT(*)::int AS total
      FROM files
      WHERE COALESCE(org_id, organization_id) = $1 AND deleted_at IS NULL
    `;
    const classifiedQuery = `
      SELECT COUNT(*)::int AS classified
      FROM files
      WHERE COALESCE(org_id, organization_id) = $1 AND deleted_at IS NULL AND classification_status = 'completed'
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
  
  /**
   * Process file with AI
   */
  async processFileWithAI(fileRequest: { fileId: string; orgId: string; content: string; mimeType: string }): Promise<{ fileId: string; classification: FileClassification; extractedText: string }> {
    // For now, return placeholder results
    // In a full implementation, this would actually process the file with AI
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

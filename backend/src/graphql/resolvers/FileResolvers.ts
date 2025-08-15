import { FileModel, FileMetadata } from '../../models/File';
import { SourceModel } from '../../models/Source';
import { FileProcessingService } from '../../services/FileProcessingService';
import { QueueService } from '../../services/queues/QueueService';
import { EventProcessingService } from '../../services/EventProcessingService';

export class FileResolvers {
  private fileModel: FileModel;
  private sourceModel: SourceModel;
  private fileProcessingService: FileProcessingService;
  private eventProcessingService: EventProcessingService;

  constructor() {
    this.fileModel = new FileModel();
    this.sourceModel = new SourceModel();
    // Create services with proper dependencies to break circular dependency
    const eventProcessingService = new EventProcessingService(null as any, new QueueService());
    this.fileProcessingService = new FileProcessingService(eventProcessingService);
    // Set the fileProcessingService dependency in eventProcessingService
    (eventProcessingService as any).fileProcessingService = this.fileProcessingService;
    this.eventProcessingService = eventProcessingService;
  }

  /**
   * Get files for an organization
   */
  async getFiles(orgId: string, sourceId?: string, limit: number = 100): Promise<FileMetadata[]> {
    if (!orgId || orgId.trim() === '') {
      throw new Error('Organization ID is required');
    }
    
    if (sourceId) {
      return await this.fileModel.getFilesBySource(sourceId, orgId, limit);
    }
    
    // Get all sources for the organization and then get files from all sources
    const sources = await this.sourceModel.getSourcesByOrganization(orgId);
    const allFiles: FileMetadata[] = [];
    
    for (const source of sources) {
      const sourceFiles = await this.fileModel.getFilesBySource(source.id, orgId, limit);
      allFiles.push(...sourceFiles);
    }
    
    // Sort by updated date and limit results
    return allFiles
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get files with filtering (for frontend compatibility)
   */
  async files(filter?: {
    orgId?: string;
    sourceId?: string;
    classificationStatus?: string;
    mimeType?: string;
    path?: string;
    name?: string;
  }, limit: number = 100, offset: number = 0): Promise<FileMetadata[]> {
    if (!filter?.orgId || filter.orgId.trim() === '') {
      throw new Error('Organization ID is required in filter');
    }
    
    let files: FileMetadata[] = [];
    
    if (filter.sourceId) {
      files = await this.fileModel.getFilesBySource(filter.sourceId, filter.orgId, limit + offset);
    } else {
      // Get all sources for the organization and then get files from all sources
      const sources = await this.sourceModel.getSourcesByOrganization(filter.orgId);
      const allFiles: FileMetadata[] = [];
      
      for (const source of sources) {
        const sourceFiles = await this.fileModel.getFilesBySource(source.id, filter.orgId, limit + offset);
        allFiles.push(...sourceFiles);
      }
      
      // Sort by updated date
      files = allFiles.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    
    // Apply filters
    if (filter.classificationStatus) {
      files = files.filter(f => f.classificationStatus === filter.classificationStatus);
    }
    if (filter.mimeType) {
      files = files.filter(f => f.mimeType === filter.mimeType);
    }
    if (filter.path) {
      files = files.filter(f => f.path.includes(filter.path!));
    }
    if (filter.name) {
      files = files.filter(f => f.name.toLowerCase().includes(filter.name!.toLowerCase()));
    }
    
    // Apply pagination
    return files.slice(offset, offset + limit);
  }

  /**
   * Get a specific file by ID
   */
  async getFile(fileId: string, orgId: string): Promise<FileMetadata | null> {
    if (!fileId || fileId.trim() === '') {
      throw new Error('File ID is required');
    }
    if (!orgId || orgId.trim() === '') {
      throw new Error('Organization ID is required');
    }
    return await this.fileModel.getFile(fileId, orgId);
  }

  /**
   * Trigger file reprocessing (classification and extraction)
   */
  async reprocessFile(fileId: string, orgId: string): Promise<boolean> {
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

      // Trigger file reprocessing through the file processing service
      await this.fileProcessingService.processFileChange({
        fileId: file.id,
        orgId: file.orgId,
        sourceId: file.sourceId,
        filePath: file.path,
        action: 'update',
        metadata: file.metadata
      });
      

      return true;
    } catch (error) {
      console.error(`Error reprocessing file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * Get file classification status
   */
  async getFileClassificationStatus(fileId: string, orgId: string): Promise<string | null> {
    const file = await this.fileModel.getFile(fileId, orgId);
    return file?.classificationStatus || null;
  }

  /**
   * Search files by content or metadata
   */
  async searchFiles(
    orgId: string,
    query: string,
    sourceId?: string,
    mimeType?: string,
    limit: number = 50
  ): Promise<FileMetadata[]> {
    // This would implement full-text search across file content and metadata
    // For now, we'll do a basic search by name and extracted text
    
    const sources = sourceId 
      ? [await this.sourceModel.getSource(sourceId, orgId)].filter(Boolean)
      : await this.sourceModel.getSourcesByOrganization(orgId);
    
    const searchResults: FileMetadata[] = [];
    
    for (const source of sources) {
      if (!source) continue;
      
      const files = await this.fileModel.getFilesBySource(source.id, orgId, 1000);
      
      const filteredFiles = files.filter(file => {
        // Filter by MIME type if specified
        if (mimeType && file.mimeType !== mimeType) {
          return false;
        }
        
        // Search in file name and extracted text
        const searchText = query.toLowerCase();
        const fileName = file.name.toLowerCase();
        const extractedText = (file.extractedText || '').toLowerCase();
        
        return fileName.includes(searchText) || extractedText.includes(searchText);
      });
      
      searchResults.push(...filteredFiles);
    }
    
    // Sort by relevance (simple scoring based on query matches)
    return searchResults
      .sort((a, b) => {
        const scoreA = this.calculateRelevanceScore(a, query);
        const scoreB = this.calculateRelevanceScore(b, query);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Get file processing statistics for an organization
   */
  async getFileStats(orgId: string): Promise<{
    total: number;
    byStatus: { [status: string]: number };
    byMimeType: { [mimeType: string]: number };
  }> {
    const sources = await this.sourceModel.getSourcesByOrganization(orgId);
    const stats = {
      total: 0,
      byStatus: {} as { [status: string]: number },
      byMimeType: {} as { [mimeType: string]: number }
    };
    
    for (const source of sources) {
      const files = await this.fileModel.getFilesBySource(source.id, orgId, 10000);
      
      stats.total += files.length;
      
      files.forEach(file => {
        // Count by classification status
        const status = file.classificationStatus;
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        // Count by MIME type
        const mimeType = file.mimeType || 'unknown';
        stats.byMimeType[mimeType] = (stats.byMimeType[mimeType] || 0) + 1;
      });
    }
    
    return stats;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(file: FileMetadata, query: string): number {
    const searchText = query.toLowerCase();
    let score = 0;
    
    // Score based on file name matches
    if (file.name.toLowerCase().includes(searchText)) {
      score += 10;
    }
    
    // Score based on extracted text matches
    if (file.extractedText && file.extractedText.toLowerCase().includes(searchText)) {
      score += 5;
    }
    
    // Boost score for recently updated files
    const daysSinceUpdate = (Date.now() - file.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) {
      score += 2;
    }
    
    return score;
  }
}

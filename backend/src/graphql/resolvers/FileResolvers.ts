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
  async getFiles(organizationId: string, sourceId?: string, limit: number = 100): Promise<FileMetadata[]> {
    if (sourceId) {
      return await this.fileModel.getFilesBySource(sourceId, organizationId, limit);
    }
    
    // Get all sources for the organization and then get files from all sources
    const sources = await this.sourceModel.getSourcesByOrganization(organizationId);
    const allFiles: FileMetadata[] = [];
    
    for (const source of sources) {
      const sourceFiles = await this.fileModel.getFilesBySource(source.id, organizationId, limit);
      allFiles.push(...sourceFiles);
    }
    
    // Sort by updated date and limit results
    return allFiles
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get a specific file by ID
   */
  async getFile(fileId: string, organizationId: string): Promise<FileMetadata | null> {
    return await this.fileModel.getFile(fileId, organizationId);
  }

  /**
   * Trigger file reprocessing (classification and extraction)
   */
  async reprocessFile(fileId: string, organizationId: string): Promise<boolean> {
    try {
      const file = await this.fileModel.getFile(fileId, organizationId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      const source = await this.sourceModel.getSource(file.sourceId, organizationId);
      if (!source) {
        throw new Error(`Source not found: ${file.sourceId}`);
      }

      // Reset classification status to pending
      await this.fileModel.updateClassification(
        fileId,
        organizationId,
        { type: 'unknown', confidence: 0, categories: [], tags: [] },
        'pending'
      );

      // Queue for reprocessing
      await this.fileProcessingService.processFileChange({
        fileId,
        organizationId,
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
  async getFileClassificationStatus(fileId: string, organizationId: string): Promise<string | null> {
    const file = await this.fileModel.getFile(fileId, organizationId);
    return file?.classificationStatus || null;
  }

  /**
   * Search files by content or metadata
   */
  async searchFiles(
    organizationId: string,
    query: string,
    sourceId?: string,
    mimeType?: string,
    limit: number = 50
  ): Promise<FileMetadata[]> {
    // This would implement full-text search across file content and metadata
    // For now, we'll do a basic search by name and extracted text
    
    const sources = sourceId 
      ? [await this.sourceModel.getSource(sourceId, organizationId)].filter(Boolean)
      : await this.sourceModel.getSourcesByOrganization(organizationId);
    
    const searchResults: FileMetadata[] = [];
    
    for (const source of sources) {
      if (!source) continue;
      
      const files = await this.fileModel.getFilesBySource(source.id, organizationId, 1000);
      
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
  async getFileStats(organizationId: string): Promise<{
    total: number;
    byStatus: { [status: string]: number };
    byMimeType: { [mimeType: string]: number };
  }> {
    const sources = await this.sourceModel.getSourcesByOrganization(organizationId);
    const stats = {
      total: 0,
      byStatus: {} as { [status: string]: number },
      byMimeType: {} as { [mimeType: string]: number }
    };
    
    for (const source of sources) {
      const files = await this.fileModel.getFilesBySource(source.id, organizationId, 10000);
      
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

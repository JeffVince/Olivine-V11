import { SourceModel, SourceMetadata, SourceConfig } from '../../models/Source';
import { FileModel } from '../../models/File';
import { EventProcessingService } from '../../services/EventProcessingService';
import { DropboxService } from '../../services/DropboxService';
import { GoogleDriveService } from '../../services/GoogleDriveService';

export class SourceResolvers {
  private sourceModel: SourceModel;
  private fileModel: FileModel;
  private eventProcessingService: EventProcessingService;
  private dropboxService: DropboxService;
  private googleDriveService: GoogleDriveService;

  constructor() {
    this.sourceModel = new SourceModel();
    this.fileModel = new FileModel();
    this.eventProcessingService = new EventProcessingService();
    this.dropboxService = new DropboxService();
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * Get all sources for an organization
   */
  async getSources(organizationId: string): Promise<SourceMetadata[]> {
    return await this.sourceModel.getSourcesByOrganization(organizationId);
  }

  /**
   * Get a specific source by ID
   */
  async getSource(sourceId: string, organizationId: string): Promise<SourceMetadata | null> {
    return await this.sourceModel.getSource(sourceId, organizationId);
  }

  /**
   * Create a new source
   */
  async createSource(
    organizationId: string,
    name: string,
    type: 'dropbox' | 'google_drive' | 'onedrive' | 'local',
    config: SourceConfig
  ): Promise<SourceMetadata> {
    const source = await this.sourceModel.createSource({
      organizationId,
      name,
      type,
      config,
      active: true
    });

    // Sync to Neo4j knowledge graph
    await this.sourceModel.syncToGraph(source);

    return source;
  }

  /**
   * Update source configuration
   */
  async updateSourceConfig(
    sourceId: string,
    organizationId: string,
    config: SourceConfig
  ): Promise<boolean> {
    const success = await this.sourceModel.updateSourceConfig(sourceId, organizationId, config);
    
    if (success) {
      // Re-sync to Neo4j with updated config
      const source = await this.sourceModel.getSource(sourceId, organizationId);
      if (source) {
        await this.sourceModel.syncToGraph(source);
      }
    }
    
    return success;
  }

  /**
   * Update source active status
   */
  async updateSourceStatus(
    sourceId: string,
    organizationId: string,
    active: boolean
  ): Promise<boolean> {
    const success = await this.sourceModel.updateSourceStatus(sourceId, organizationId, active);
    
    if (success) {
      // Re-sync to Neo4j with updated status
      const source = await this.sourceModel.getSource(sourceId, organizationId);
      if (source) {
        await this.sourceModel.syncToGraph(source);
      }
    }
    
    return success;
  }

  /**
   * Delete a source and all its files
   */
  async deleteSource(sourceId: string, organizationId: string): Promise<boolean> {
    try {
      // First, get all files from this source and mark them as deleted
      const files = await this.fileModel.getFilesBySource(sourceId, organizationId, 10000);
      
      for (const file of files) {
        await this.fileModel.deleteFile(file.id, organizationId);
        await this.fileModel.removeFromGraph(file.id, organizationId);
      }
      
      // Remove source from Neo4j
      await this.sourceModel.removeFromGraph(sourceId, organizationId);
      
      // Delete source from PostgreSQL
      const success = await this.sourceModel.deleteSource(sourceId, organizationId);
      
      return success;
    } catch (error) {
      console.error(`Error deleting source ${sourceId}:`, error);
      return false;
    }
  }

  /**
   * Get source statistics
   */
  async getSourceStats(sourceId: string, organizationId: string): Promise<{
    fileCount: number;
    totalSize: number;
    lastSync: Date | null;
    classificationStats: { [status: string]: number };
  }> {
    const files = await this.fileModel.getFilesBySource(sourceId, organizationId, 10000);
    
    const stats = {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0),
      lastSync: files.length > 0 ? files.reduce((latest, file) => 
        file.updatedAt > latest ? file.updatedAt : latest, files[0].updatedAt
      ) : null,
      classificationStats: {} as { [status: string]: number }
    };
    
    // Count files by classification status
    files.forEach(file => {
      const status = file.classificationStatus;
      stats.classificationStats[status] = (stats.classificationStats[status] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Trigger full resync for a source
   */
  async triggerSourceResync(sourceId: string, organizationId: string): Promise<boolean> {
    try {
      const source = await this.sourceModel.getSource(sourceId, organizationId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }
      if (source.type === 'dropbox') {
        // BFS traversal starting at root
        const queue: { path: string }[] = [{ path: '' }];
        while (queue.length > 0) {
          const { path } = queue.shift() as { path: string };
          const resp = await this.dropboxService.listFolder(organizationId, sourceId, path, 'home');
          const entries = (resp?.result?.entries || []) as any[];
          for (const entry of entries) {
            if (entry['.tag'] === 'folder') {
              queue.push({ path: entry.path_lower || entry.path_display || '' });
            } else if (entry['.tag'] === 'file') {
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
              } as any)
            }
          }
        }
        return true;
      } else if (source.type === 'google_drive') {
        // Page through files
        let pageToken: string | undefined = undefined;
        do {
          const data = await this.googleDriveService.listFiles(organizationId, sourceId, pageToken);
          const files = data.files || [];
          for (const f of files) {
            if (f.mimeType === 'application/vnd.google-apps.folder') continue;
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
            } as any)
          }
          pageToken = data.nextPageToken;
        } while (pageToken)
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error triggering resync for source ${sourceId}:`, error);
      return false;
    }
  }

  /**
   * Test source connection
   */
  async testSourceConnection(sourceId: string, organizationId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const source = await this.sourceModel.getSource(sourceId, organizationId);
      if (!source) {
        return {
          success: false,
          message: 'Source not found'
        };
      }

      // This would implement actual connection testing based on source type
      // For now, we'll just check if the source has required config
      const config = source.config as SourceConfig;
      
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
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        details: { error: String(error) }
      };
    }
  }
}

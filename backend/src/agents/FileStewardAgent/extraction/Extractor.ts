import { FileProcessingService } from '../../../services/FileProcessingService'

export class Extractor {
  private fileProcessingService: FileProcessingService

  constructor(fileProcessingService: FileProcessingService) {
    this.fileProcessingService = fileProcessingService
  }

  async extractContent(params: { orgId: string; sourceId?: string; path: string; mimeType: string }): Promise<{ text: string; metadata: Record<string, unknown> }> {
    const extractedContent = await this.fileProcessingService.extractContent({
      orgId: params.orgId,
      sourceId: params.sourceId || '', // Provide default empty string if undefined
      path: params.path,
      mimeType: params.mimeType
    })
    const normalized = typeof extractedContent === 'string' ? { text: extractedContent, metadata: {} } : extractedContent
    return { text: normalized.text || '', metadata: normalized.metadata || {} }
  }
}



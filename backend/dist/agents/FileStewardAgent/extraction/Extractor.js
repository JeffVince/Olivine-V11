"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Extractor = void 0;
class Extractor {
    constructor(fileProcessingService) {
        this.fileProcessingService = fileProcessingService;
    }
    async extractContent(params) {
        const extractedContent = await this.fileProcessingService.extractContent({
            orgId: params.orgId,
            sourceId: params.sourceId || '',
            path: params.path,
            mimeType: params.mimeType
        });
        const normalized = typeof extractedContent === 'string' ? { text: extractedContent, metadata: {} } : extractedContent;
        return { text: normalized.text || '', metadata: normalized.metadata || {} };
    }
}
exports.Extractor = Extractor;
//# sourceMappingURL=Extractor.js.map
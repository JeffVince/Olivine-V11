export interface ContentInput {
    orgId: string;
    contentKey: string;
    contentType: 'note' | 'next_step' | 'summary' | 'insight' | 'action_item';
    title: string;
    description?: string;
    format: 'text' | 'markdown' | 'html';
    metadata?: Record<string, any>;
    references?: string[];
    derivedFrom?: string[];
}
export interface Content {
    id: string;
    orgId: string;
    contentKey: string;
    contentType: string;
    title: string;
    description?: string;
    format: string;
    status: string;
    current: boolean;
    deleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any>;
}
export declare class ContentService {
    private neo4jService;
    private provenanceService;
    constructor();
    createContent(input: ContentInput, userId: string): Promise<Content>;
    updateContent(contentId: string, updates: Partial<ContentInput>, userId: string): Promise<Content>;
    getContent(contentId: string, orgId: string): Promise<Content | null>;
    listContent(orgId: string, contentType?: string, limit?: number, offset?: number): Promise<Content[]>;
    deleteContent(contentId: string, orgId: string, userId: string): Promise<boolean>;
    searchContent(orgId: string, searchText: string, contentType?: string, limit?: number): Promise<{
        content: Content;
        score: number;
    }[]>;
    private createContentReferences;
    private createDerivationRelationships;
    private mapToContent;
}
//# sourceMappingURL=ContentService.d.ts.map
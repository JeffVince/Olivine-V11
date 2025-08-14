export interface TaxonomyRule {
    id: string;
    orgId: string;
    slotKey: string;
    matchPattern: string;
    fileType?: string;
    priority: number;
    enabled: boolean;
    conditions: ClassificationCondition[];
    metadata: any;
}
export interface ClassificationCondition {
    type: 'filename' | 'path' | 'size' | 'mime_type' | 'content';
    operator: 'matches' | 'contains' | 'equals' | 'greater_than' | 'less_than';
    value: string | number;
    caseSensitive?: boolean;
}
export interface ClassificationResult {
    slotKey: string;
    confidence: number;
    ruleId?: string;
    method: 'taxonomy' | 'ml' | 'default';
    metadata?: any;
}
//# sourceMappingURL=types.d.ts.map
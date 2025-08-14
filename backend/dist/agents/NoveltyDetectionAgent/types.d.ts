export interface NoveltyDetectionRequest {
    entityId: string;
    entityType: string;
    newProperties: Record<string, any>;
    orgId: string;
    userId: string;
    context?: {
        projectId?: string;
        sourceId?: string;
        metadata?: Record<string, any>;
    };
}
export interface NoveltyResult {
    isNovel: boolean;
    noveltyScore: number;
    noveltyType: 'new_entity' | 'property_change' | 'relationship_change' | 'pattern_deviation' | 'none';
    detectedChanges: Array<{
        property: string;
        oldValue?: any;
        newValue: any;
        changeType: 'added' | 'modified' | 'removed';
        significance: number;
    }>;
    reasoning: string;
    recommendations?: string[];
    alertLevel: 'none' | 'info' | 'warning' | 'critical';
}
export interface NoveltyPattern {
    pattern_id: string;
    entity_type: string;
    pattern_type: 'frequency' | 'sequence' | 'relationship' | 'property_range';
    baseline_stats: Record<string, any>;
    threshold: number;
    created_at: Date;
    last_updated: Date;
}
//# sourceMappingURL=types.d.ts.map
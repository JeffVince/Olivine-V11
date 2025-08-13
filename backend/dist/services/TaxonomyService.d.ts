export interface CanonicalSlot {
    key: string;
    org_id: string;
    description: string;
    category: string;
    required: boolean;
    multiple: boolean;
    validation_rules: {
        mime_types?: string[];
        max_size_mb?: number;
        naming_pattern?: string;
        min_size_bytes?: number;
        max_size_bytes?: number;
        required_keywords?: string[];
        excluded_keywords?: string[];
    };
}
export interface TaxonomyProfile {
    id: string;
    org_id: string;
    name: string;
    description: string;
    active: boolean;
    priority: number;
    created_at: Date;
    metadata: {
        auto_apply?: boolean;
        confidence_threshold?: number;
        fallback_slot?: string;
    };
}
export interface TaxonomyRule {
    id: string;
    org_id: string;
    match_pattern: string;
    slot_key: string;
    file_type?: string;
    path_pattern?: string;
    priority: number;
    enabled: boolean;
    confidence: number;
    conditions: {
        min_size_bytes?: number;
        max_size_bytes?: number;
        required_keywords?: string[];
        excluded_keywords?: string[];
    };
}
export interface Classification {
    slot: string;
    confidence: number;
    method: 'rule_based' | 'ml_based' | 'manual';
    rule_id?: string;
    metadata?: Record<string, unknown>;
}
export interface FileNode {
    id: string;
    org_id: string;
    name: string;
    path: string;
    size: number;
    mime_type: string;
    metadata?: Record<string, unknown>;
}
export declare class TaxonomyService {
    private neo4j;
    private provenance;
    constructor();
    createCanonicalSlot(slot: Omit<CanonicalSlot, 'key'> & {
        key?: string;
    }, orgId: string): Promise<CanonicalSlot>;
    createTaxonomyProfile(profile: Omit<TaxonomyProfile, 'id' | 'created_at'>, orgId: string): Promise<TaxonomyProfile>;
    createTaxonomyRule(rule: Omit<TaxonomyRule, 'id'>, profileId: string, orgId: string): Promise<TaxonomyRule>;
    classifyFile(fileId: string, orgId: string): Promise<Classification[]>;
    applyClassification(fileId: string, classification: Classification, orgId: string, userId: string): Promise<void>;
    getCanonicalSlots(orgId: string): Promise<CanonicalSlot[]>;
    getTaxonomyProfiles(orgId: string): Promise<TaxonomyProfile[]>;
    getTaxonomyRules(profileId: string, orgId: string): Promise<TaxonomyRule[]>;
    getFileClassification(fileId: string, orgId: string): Promise<Classification | null>;
    private generateId;
    private generateSlotKey;
}
//# sourceMappingURL=TaxonomyService.d.ts.map
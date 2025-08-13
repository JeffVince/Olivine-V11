import { Neo4jService } from './Neo4jService';
import { PostgresService } from './PostgresService';
export interface CrossLayerRule {
    id: string;
    name: string;
    description: string;
    fromLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    fromEntityType: string;
    toLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    toEntityType: string;
    relationshipType: string;
    required: boolean;
    cardinality: '1:1' | '1:N' | 'N:1' | 'N:N';
    validationQuery: string;
    repairQuery?: string;
    enabled: boolean;
}
export interface ValidationResult {
    ruleId: string;
    ruleName: string;
    violationsFound: number;
    violationsRepaired: number;
    violations: Array<{
        entityId: string;
        entityType: string;
        violationType: string;
        description: string;
        repaired: boolean;
        repairAction?: string;
    }>;
}
export interface LinkCreationRequest {
    fromEntityId: string;
    fromEntityType: string;
    fromLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    toEntityId: string;
    toEntityType: string;
    toLayer: 'IRL' | 'Idea' | 'Ops' | 'Provenance';
    relationshipType: string;
    properties?: Record<string, any>;
    temporal?: boolean;
    validFrom?: string;
    validTo?: string;
    confidence?: number;
    method: 'automatic' | 'manual' | 'inferred';
    createdBy: string;
}
export declare class CrossLayerEnforcementService {
    private neo4jService;
    private postgresService;
    private rules;
    constructor(neo4jService: Neo4jService, postgresService: PostgresService);
    private initializeDefaultRules;
    createCrossLayerLink(orgId: string, request: LinkCreationRequest, commitId?: string): Promise<string>;
    validateAllCrossLayerLinks(orgId: string): Promise<ValidationResult[]>;
    private validateRule;
    private createTemporalRelationship;
    private createDirectRelationship;
    private validateEntitiesExist;
    getCrossLayerStatistics(orgId: string): Promise<any>;
    addRule(rule: CrossLayerRule): void;
    removeRule(ruleId: string): boolean;
    getRules(): CrossLayerRule[];
    validateAllLinks(orgId?: string): Promise<ValidationResult[]>;
    setRuleEnabled(ruleId: string, enabled: boolean): boolean;
    repairViolations(orgId: string, entityIds: string[]): Promise<ValidationResult[]>;
}
//# sourceMappingURL=CrossLayerEnforcementService.d.ts.map
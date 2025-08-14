import { ClassificationCondition, ClassificationResult, TaxonomyRule } from '../types';
export declare class RuleEngine {
    performRuleBasedClassification(rules: TaxonomyRule[], fileData: any): Promise<ClassificationResult>;
    evaluateRule(rule: TaxonomyRule, fileData: any): Promise<boolean>;
    evaluateCondition(condition: ClassificationCondition, fileData: any): Promise<boolean>;
    applyOperator(operator: string, fieldValue: any, conditionValue: any, caseSensitive?: boolean): boolean;
    calculateConfidence(rule: TaxonomyRule, fileData: any): Promise<number>;
    getDefaultClassification(fileData: any): ClassificationResult;
}
//# sourceMappingURL=RuleEngine.d.ts.map
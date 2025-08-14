import { Neo4jService } from '../../../services/Neo4jService';
export declare class CrossLayerLinkService {
    private neo4j;
    constructor(neo4j: Neo4jService);
    createInitialCrossLayerLinks(orgId: string, fileId: string, slots: string[]): Promise<number>;
    private getProjectScenes;
    private getProjectPurchaseOrders;
    private createCrossLayerLink;
}
//# sourceMappingURL=CrossLayerLinkService.d.ts.map
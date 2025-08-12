export interface Runbook {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    spec: any;
    createdAt: string;
    updatedAt: string;
}
export declare class RunbookService {
    private readonly pg;
    list(orgId: string): Promise<Runbook[]>;
    save(input: Omit<Runbook, 'createdAt' | 'updatedAt'> & {
        id?: string;
    }): Promise<Runbook>;
}
//# sourceMappingURL=RunbookService.d.ts.map
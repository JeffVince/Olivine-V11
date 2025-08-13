import { Vendor, PurchaseOrder, Invoice, Budget, ComplianceRule } from '../../services/OperationsOntologyService';
export declare class OperationsResolvers {
    private operationsService;
    constructor();
    getResolvers(): {
        PurchaseOrder: {
            po_number: (src: any) => any;
            amount: (src: any) => any;
        };
        Query: {
            budgetVsActualAnalysis: (_: any, { projectId, orgId }: {
                projectId: string;
                orgId: string;
            }) => Promise<unknown>;
            vendorPerformanceAnalysis: (_: any, { orgId }: {
                orgId: string;
            }) => Promise<unknown[]>;
        };
        Mutation: {
            createVendor: (_: any, { input, userId }: {
                input: Omit<Vendor, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Vendor>;
            createPurchaseOrder: (_: any, { input, userId }: {
                input: Omit<PurchaseOrder, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<PurchaseOrder>;
            createInvoice: (_: any, { input, userId }: {
                input: Omit<Invoice, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Invoice>;
            createBudget: (_: any, { input, userId }: {
                input: Omit<Budget, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Budget>;
            createComplianceRule: (_: any, { input, userId }: {
                input: Omit<ComplianceRule, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<ComplianceRule>;
        };
    };
}
export declare const operationsResolvers: {
    PurchaseOrder: {
        po_number: (src: any) => any;
        amount: (src: any) => any;
    };
    Query: {
        budgetVsActualAnalysis: (_: any, { projectId, orgId }: {
            projectId: string;
            orgId: string;
        }) => Promise<unknown>;
        vendorPerformanceAnalysis: (_: any, { orgId }: {
            orgId: string;
        }) => Promise<unknown[]>;
    };
    Mutation: {
        createVendor: (_: any, { input, userId }: {
            input: Omit<Vendor, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Vendor>;
        createPurchaseOrder: (_: any, { input, userId }: {
            input: Omit<PurchaseOrder, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<PurchaseOrder>;
        createInvoice: (_: any, { input, userId }: {
            input: Omit<Invoice, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Invoice>;
        createBudget: (_: any, { input, userId }: {
            input: Omit<Budget, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Budget>;
        createComplianceRule: (_: any, { input, userId }: {
            input: Omit<ComplianceRule, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<ComplianceRule>;
    };
};
//# sourceMappingURL=OperationsResolvers.d.ts.map
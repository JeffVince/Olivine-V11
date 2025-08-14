import { 
  OperationsOntologyService,
  Vendor,
  PurchaseOrder,
  Invoice,
  Budget,
  ComplianceRule
} from '../../services/OperationsOntologyService';

export class OperationsResolvers {
  private operationsService: OperationsOntologyService;

  constructor() {
    this.operationsService = new OperationsOntologyService();
  }

  getResolvers() {
    return {
      PurchaseOrder: {
        po_number: (src: any) => src.po_number || src.poNumber || src.po_number,
        amount: (src: any) => src.amount || src.total_amount,
      },
      Query: {
        budgetVsActualAnalysis: async (_: any, { projectId, orgId }: { projectId: string; orgId: string }) => {
          return await this.operationsService.getBudgetVsActualAnalysis(projectId, orgId);
        },

        vendorPerformanceAnalysis: async (_: any, { orgId }: { orgId: string }) => {
          return await this.operationsService.getVendorPerformanceAnalysis(orgId);
        }
      },

      Mutation: {
        createVendor: async (
          _: any, 
          { input, userId }: { input: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.operationsService.createVendor(input, userId);
        },

        createPurchaseOrder: async (
          _: any, 
          { input, userId }: { input: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          const mapped: any = {
            ...input,
            order_number: (input as any).po_number ?? (input as any).order_number,
            total_amount: (input as any).amount ?? (input as any).total_amount,
          };
          return await this.operationsService.createPurchaseOrder(mapped, userId);
        },

        createInvoice: async (
          _: any, 
          { input, userId }: { input: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.operationsService.createInvoice(input, userId);
        },

        createBudget: async (
          _: any, 
          { input, userId }: { input: Omit<Budget, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.operationsService.createBudget(input, userId);
        },

        createComplianceRule: async (
          _: any, 
          { input, userId }: { input: Omit<ComplianceRule, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.operationsService.createComplianceRule(input, userId);
        }
      }
    };
  }
}

export const operationsResolvers = new OperationsResolvers().getResolvers();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsResolvers = exports.OperationsResolvers = void 0;
const OperationsOntologyService_1 = require("../../services/OperationsOntologyService");
class OperationsResolvers {
    constructor() {
        this.operationsService = new OperationsOntologyService_1.OperationsOntologyService();
    }
    getResolvers() {
        return {
            PurchaseOrder: {
                po_number: (src) => src.po_number || src.poNumber || src.po_number,
                amount: (src) => src.amount || src.total_amount,
            },
            Query: {
                budgetVsActualAnalysis: async (_, { projectId, organizationId }) => {
                    return await this.operationsService.getBudgetVsActualAnalysis(projectId, organizationId);
                },
                vendorPerformanceAnalysis: async (_, { organizationId }) => {
                    return await this.operationsService.getVendorPerformanceAnalysis(organizationId);
                }
            },
            Mutation: {
                createVendor: async (_, { input, userId }) => {
                    return await this.operationsService.createVendor(input, userId);
                },
                createPurchaseOrder: async (_, { input, userId }) => {
                    const mapped = {
                        ...input,
                        order_number: input.po_number ?? input.order_number,
                        total_amount: input.amount ?? input.total_amount,
                    };
                    return await this.operationsService.createPurchaseOrder(mapped, userId);
                },
                createInvoice: async (_, { input, userId }) => {
                    return await this.operationsService.createInvoice(input, userId);
                },
                createBudget: async (_, { input, userId }) => {
                    return await this.operationsService.createBudget(input, userId);
                },
                createComplianceRule: async (_, { input, userId }) => {
                    return await this.operationsService.createComplianceRule(input, userId);
                }
            }
        };
    }
}
exports.OperationsResolvers = OperationsResolvers;
exports.operationsResolvers = new OperationsResolvers().getResolvers();
//# sourceMappingURL=OperationsResolvers.js.map
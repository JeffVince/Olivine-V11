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
            Query: {
                budgetVsActualAnalysis: async (_, { projectId, orgId }) => {
                    return await this.operationsService.getBudgetVsActualAnalysis(projectId, orgId);
                },
                vendorPerformanceAnalysis: async (_, { orgId }) => {
                    return await this.operationsService.getVendorPerformanceAnalysis(orgId);
                }
            },
            Mutation: {
                createVendor: async (_, { input, userId }) => {
                    return await this.operationsService.createVendor(input, userId);
                },
                createPurchaseOrder: async (_, { input, userId }) => {
                    return await this.operationsService.createPurchaseOrder(input, userId);
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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxonomyResolvers = exports.TaxonomyResolvers = void 0;
const TaxonomyService_1 = require("../../services/TaxonomyService");
class TaxonomyResolvers {
    constructor() {
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
    }
    getResolvers() {
        return {
            Query: {
                canonicalSlots: async (_, { organizationId }) => {
                    return await this.taxonomyService.getCanonicalSlots(organizationId);
                },
                taxonomyProfiles: async (_, { organizationId }) => {
                    return await this.taxonomyService.getTaxonomyProfiles(organizationId);
                },
                taxonomyRules: async (_, { profileId, organizationId }) => {
                    return await this.taxonomyService.getTaxonomyRules(profileId, organizationId);
                },
                fileClassification: async (_, { fileId, organizationId }) => {
                    return await this.taxonomyService.getFileClassification(fileId, organizationId);
                }
            },
            Mutation: {
                createCanonicalSlot: async (_, { input, organizationId }) => {
                    return await this.taxonomyService.createCanonicalSlot(input, organizationId);
                },
                createTaxonomyProfile: async (_, { input, organizationId }) => {
                    return await this.taxonomyService.createTaxonomyProfile(input, organizationId);
                },
                createTaxonomyRule: async (_, { input, profileId, organizationId }) => {
                    return await this.taxonomyService.createTaxonomyRule(input, profileId, organizationId);
                },
                classifyTaxonomyFile: async (_, { fileId, organizationId, userId }) => {
                    const classifications = await this.taxonomyService.classifyFile(fileId, organizationId);
                    const bestClassification = classifications[0];
                    if (bestClassification) {
                        await this.taxonomyService.applyClassification(fileId, bestClassification, organizationId, userId);
                    }
                    return classifications;
                },
                applyManualClassification: async (_, { fileId, slot, confidence, organizationId, userId }) => {
                    const classification = {
                        slot,
                        confidence: confidence || 1.0,
                        method: 'manual',
                        source: 'manual',
                        timestamp: new Date().toISOString()
                    };
                    await this.taxonomyService.applyClassification(fileId, classification, organizationId, userId);
                    return true;
                }
            }
        };
    }
}
exports.TaxonomyResolvers = TaxonomyResolvers;
exports.taxonomyResolvers = new TaxonomyResolvers().getResolvers();
//# sourceMappingURL=TaxonomyResolvers.js.map
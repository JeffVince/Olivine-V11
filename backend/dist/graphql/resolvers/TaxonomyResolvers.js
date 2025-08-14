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
                canonicalSlots: async (_, { orgId }) => {
                    return await this.taxonomyService.getCanonicalSlots(orgId);
                },
                taxonomyProfiles: async (_, { orgId }) => {
                    return await this.taxonomyService.getTaxonomyProfiles(orgId);
                },
                taxonomyRules: async (_, { profileId, orgId }) => {
                    return await this.taxonomyService.getTaxonomyRules(profileId, orgId);
                },
                fileClassification: async (_, { fileId, orgId }) => {
                    return await this.taxonomyService.getFileClassification(fileId, orgId);
                }
            },
            Mutation: {
                createCanonicalSlot: async (_, { input, orgId }) => {
                    return await this.taxonomyService.createCanonicalSlot(input, orgId);
                },
                createTaxonomyProfile: async (_, { input, orgId }) => {
                    return await this.taxonomyService.createTaxonomyProfile(input, orgId);
                },
                createTaxonomyRule: async (_, { input, profileId, orgId }) => {
                    return await this.taxonomyService.createTaxonomyRule(input, profileId, orgId);
                },
                classifyTaxonomyFile: async (_, { fileId, orgId, userId }) => {
                    const classifications = await this.taxonomyService.classifyFile(fileId, orgId);
                    const bestClassification = classifications[0];
                    if (bestClassification) {
                        await this.taxonomyService.applyClassification(fileId, bestClassification, orgId, userId);
                    }
                    return classifications;
                },
                applyManualClassification: async (_, { fileId, slot, confidence, orgId, userId }) => {
                    const classification = {
                        slot,
                        confidence: confidence || 1.0,
                        method: 'manual',
                        source: 'manual',
                        timestamp: new Date().toISOString()
                    };
                    await this.taxonomyService.applyClassification(fileId, classification, orgId, userId);
                    return true;
                }
            }
        };
    }
}
exports.TaxonomyResolvers = TaxonomyResolvers;
exports.taxonomyResolvers = new TaxonomyResolvers().getResolvers();
//# sourceMappingURL=TaxonomyResolvers.js.map
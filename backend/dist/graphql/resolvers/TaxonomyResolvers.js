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
                    if (classifications.length > 0) {
                        const bestClassification = classifications[0];
                        await this.taxonomyService.applyClassification(fileId, bestClassification, orgId, userId);
                        return bestClassification;
                    }
                    return null;
                },
                applyManualClassification: async (_, { fileId, slot, confidence, orgId, userId }) => {
                    const classification = {
                        slot,
                        confidence: confidence || 1.0,
                        method: 'manual'
                    };
                    await this.taxonomyService.applyClassification(fileId, classification, orgId, userId);
                    return classification;
                }
            }
        };
    }
}
exports.TaxonomyResolvers = TaxonomyResolvers;
exports.taxonomyResolvers = new TaxonomyResolvers().getResolvers();
//# sourceMappingURL=TaxonomyResolvers.js.map
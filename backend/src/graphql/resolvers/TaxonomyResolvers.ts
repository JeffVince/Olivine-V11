import { TaxonomyService, CanonicalSlot, TaxonomyProfile, TaxonomyRule, Classification } from '../../services/TaxonomyService';

export class TaxonomyResolvers {
  private taxonomyService: TaxonomyService;

  constructor() {
    this.taxonomyService = new TaxonomyService();
  }

  getResolvers() {
    return {
      Query: {
        canonicalSlots: async (_: any, { organizationId }: { organizationId: string }) => {
          return await this.taxonomyService.getCanonicalSlots(organizationId);
        },

        taxonomyProfiles: async (_: any, { organizationId }: { organizationId: string }) => {
          return await this.taxonomyService.getTaxonomyProfiles(organizationId);
        },

        taxonomyRules: async (_: any, { profileId, organizationId }: { profileId: string; organizationId: string }) => {
          return await this.taxonomyService.getTaxonomyRules(profileId, organizationId);
        },

        fileClassification: async (_: any, { fileId, organizationId }: { fileId: string; organizationId: string }) => {
          return await this.taxonomyService.getFileClassification(fileId, organizationId);
        }
      },

      Mutation: {
        createCanonicalSlot: async (
          _: any, 
          { input, organizationId }: { input: Omit<CanonicalSlot, 'key'> & { key?: string }; organizationId: string }
        ) => {
          return await this.taxonomyService.createCanonicalSlot(input, organizationId);
        },

        createTaxonomyProfile: async (
          _: any, 
          { input, organizationId }: { input: Omit<TaxonomyProfile, 'id' | 'created_at'>; organizationId: string }
        ) => {
          return await this.taxonomyService.createTaxonomyProfile(input, organizationId);
        },

        createTaxonomyRule: async (
          _: any, 
          { input, profileId, organizationId }: { 
            input: Omit<TaxonomyRule, 'id'>; 
            profileId: string; 
            organizationId: string;
          }
        ) => {
          return await this.taxonomyService.createTaxonomyRule(input, profileId, organizationId);
        },

        classifyTaxonomyFile: async (
          _: any, 
          { fileId, organizationId, userId }: { fileId: string; organizationId: string; userId: string }
        ) => {
          const classifications = await this.taxonomyService.classifyFile(fileId, organizationId);
          const bestClassification = classifications[0];
          if (bestClassification) {
            await this.taxonomyService.applyClassification(fileId, bestClassification, organizationId, userId);
          }
          return classifications;
        },

        applyManualClassification: async (
          _: any,
          { fileId, slot, confidence, organizationId, userId }: {
            fileId: string;
            slot: string;
            confidence?: number;
            organizationId: string;
            userId: string;
          }
        ) => {
          const classification: Classification = {
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

export const taxonomyResolvers = new TaxonomyResolvers().getResolvers();

import { TaxonomyService, CanonicalSlot, TaxonomyProfile, TaxonomyRule, Classification } from '../../services/TaxonomyService';

export class TaxonomyResolvers {
  private taxonomyService: TaxonomyService;

  constructor() {
    this.taxonomyService = new TaxonomyService();
  }

  getResolvers() {
    return {
      Query: {
        canonicalSlots: async (_: any, { orgId }: { orgId: string }) => {
          return await this.taxonomyService.getCanonicalSlots(orgId);
        },

        taxonomyProfiles: async (_: any, { orgId }: { orgId: string }) => {
          return await this.taxonomyService.getTaxonomyProfiles(orgId);
        },

        taxonomyRules: async (_: any, { profileId, orgId }: { profileId: string; orgId: string }) => {
          return await this.taxonomyService.getTaxonomyRules(profileId, orgId);
        },

        fileClassification: async (_: any, { fileId, orgId }: { fileId: string; orgId: string }) => {
          return await this.taxonomyService.getFileClassification(fileId, orgId);
        }
      },

      Mutation: {
        createCanonicalSlot: async (
          _: any, 
          { input, orgId }: { input: Omit<CanonicalSlot, 'key'> & { key?: string }; orgId: string }
        ) => {
          return await this.taxonomyService.createCanonicalSlot(input, orgId);
        },

        createTaxonomyProfile: async (
          _: any, 
          { input, orgId }: { input: Omit<TaxonomyProfile, 'id' | 'created_at'>; orgId: string }
        ) => {
          return await this.taxonomyService.createTaxonomyProfile(input, orgId);
        },

        createTaxonomyRule: async (
          _: any, 
          { input, profileId, orgId }: { 
            input: Omit<TaxonomyRule, 'id'>; 
            profileId: string; 
            orgId: string;
          }
        ) => {
          return await this.taxonomyService.createTaxonomyRule(input, profileId, orgId);
        },

        classifyTaxonomyFile: async (
          _: any, 
          { fileId, orgId, userId }: { fileId: string; orgId: string; userId: string }
        ) => {
          const classifications = await this.taxonomyService.classifyFile(fileId, orgId);
          const bestClassification = classifications[0];
          if (bestClassification) {
            await this.taxonomyService.applyClassification(fileId, bestClassification, orgId, userId);
          }
          return classifications;
        },

        applyManualClassification: async (
          _: any,
          { fileId, slot, confidence, orgId, userId }: {
            fileId: string;
            slot: string;
            confidence?: number;
            orgId: string;
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
          await this.taxonomyService.applyClassification(fileId, classification, orgId, userId);
          return true;
        }
      }
    };
  }
}

export const taxonomyResolvers = new TaxonomyResolvers().getResolvers();

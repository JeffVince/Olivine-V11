import { CanonicalSlot, TaxonomyProfile, TaxonomyRule, Classification } from '../../services/TaxonomyService';
export declare class TaxonomyResolvers {
    private taxonomyService;
    constructor();
    getResolvers(): {
        Query: {
            canonicalSlots: (_: any, { organizationId }: {
                organizationId: string;
            }) => Promise<CanonicalSlot[]>;
            taxonomyProfiles: (_: any, { organizationId }: {
                organizationId: string;
            }) => Promise<TaxonomyProfile[]>;
            taxonomyRules: (_: any, { profileId, organizationId }: {
                profileId: string;
                organizationId: string;
            }) => Promise<TaxonomyRule[]>;
            fileClassification: (_: any, { fileId, organizationId }: {
                fileId: string;
                organizationId: string;
            }) => Promise<Classification | null>;
        };
        Mutation: {
            createCanonicalSlot: (_: any, { input, organizationId }: {
                input: Omit<CanonicalSlot, "key"> & {
                    key?: string;
                };
                organizationId: string;
            }) => Promise<CanonicalSlot>;
            createTaxonomyProfile: (_: any, { input, organizationId }: {
                input: Omit<TaxonomyProfile, "id" | "created_at">;
                organizationId: string;
            }) => Promise<TaxonomyProfile>;
            createTaxonomyRule: (_: any, { input, profileId, organizationId }: {
                input: Omit<TaxonomyRule, "id">;
                profileId: string;
                organizationId: string;
            }) => Promise<TaxonomyRule>;
            classifyTaxonomyFile: (_: any, { fileId, organizationId, userId }: {
                fileId: string;
                organizationId: string;
                userId: string;
            }) => Promise<Classification[]>;
            applyManualClassification: (_: any, { fileId, slot, confidence, organizationId, userId }: {
                fileId: string;
                slot: string;
                confidence?: number;
                organizationId: string;
                userId: string;
            }) => Promise<boolean>;
        };
    };
}
export declare const taxonomyResolvers: {
    Query: {
        canonicalSlots: (_: any, { organizationId }: {
            organizationId: string;
        }) => Promise<CanonicalSlot[]>;
        taxonomyProfiles: (_: any, { organizationId }: {
            organizationId: string;
        }) => Promise<TaxonomyProfile[]>;
        taxonomyRules: (_: any, { profileId, organizationId }: {
            profileId: string;
            organizationId: string;
        }) => Promise<TaxonomyRule[]>;
        fileClassification: (_: any, { fileId, organizationId }: {
            fileId: string;
            organizationId: string;
        }) => Promise<Classification | null>;
    };
    Mutation: {
        createCanonicalSlot: (_: any, { input, organizationId }: {
            input: Omit<CanonicalSlot, "key"> & {
                key?: string;
            };
            organizationId: string;
        }) => Promise<CanonicalSlot>;
        createTaxonomyProfile: (_: any, { input, organizationId }: {
            input: Omit<TaxonomyProfile, "id" | "created_at">;
            organizationId: string;
        }) => Promise<TaxonomyProfile>;
        createTaxonomyRule: (_: any, { input, profileId, organizationId }: {
            input: Omit<TaxonomyRule, "id">;
            profileId: string;
            organizationId: string;
        }) => Promise<TaxonomyRule>;
        classifyTaxonomyFile: (_: any, { fileId, organizationId, userId }: {
            fileId: string;
            organizationId: string;
            userId: string;
        }) => Promise<Classification[]>;
        applyManualClassification: (_: any, { fileId, slot, confidence, organizationId, userId }: {
            fileId: string;
            slot: string;
            confidence?: number;
            organizationId: string;
            userId: string;
        }) => Promise<boolean>;
    };
};
//# sourceMappingURL=TaxonomyResolvers.d.ts.map
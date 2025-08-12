import { CanonicalSlot, TaxonomyProfile, TaxonomyRule, Classification } from '../../services/TaxonomyService';
export declare class TaxonomyResolvers {
    private taxonomyService;
    constructor();
    getResolvers(): {
        Query: {
            canonicalSlots: (_: any, { orgId }: {
                orgId: string;
            }) => Promise<CanonicalSlot[]>;
            taxonomyProfiles: (_: any, { orgId }: {
                orgId: string;
            }) => Promise<TaxonomyProfile[]>;
            taxonomyRules: (_: any, { profileId, orgId }: {
                profileId: string;
                orgId: string;
            }) => Promise<TaxonomyRule[]>;
            fileClassification: (_: any, { fileId, orgId }: {
                fileId: string;
                orgId: string;
            }) => Promise<Classification | null>;
        };
        Mutation: {
            createCanonicalSlot: (_: any, { input, orgId }: {
                input: Omit<CanonicalSlot, "key"> & {
                    key?: string;
                };
                orgId: string;
            }) => Promise<CanonicalSlot>;
            createTaxonomyProfile: (_: any, { input, orgId }: {
                input: Omit<TaxonomyProfile, "id" | "created_at">;
                orgId: string;
            }) => Promise<TaxonomyProfile>;
            createTaxonomyRule: (_: any, { input, profileId, orgId }: {
                input: Omit<TaxonomyRule, "id">;
                profileId: string;
                orgId: string;
            }) => Promise<TaxonomyRule>;
            classifyFile: (_: any, { fileId, orgId, userId }: {
                fileId: string;
                orgId: string;
                userId: string;
            }) => Promise<Classification | null>;
            applyManualClassification: (_: any, { fileId, slot, confidence, orgId, userId }: {
                fileId: string;
                slot: string;
                confidence?: number;
                orgId: string;
                userId: string;
            }) => Promise<Classification>;
        };
    };
}
export declare const taxonomyResolvers: {
    Query: {
        canonicalSlots: (_: any, { orgId }: {
            orgId: string;
        }) => Promise<CanonicalSlot[]>;
        taxonomyProfiles: (_: any, { orgId }: {
            orgId: string;
        }) => Promise<TaxonomyProfile[]>;
        taxonomyRules: (_: any, { profileId, orgId }: {
            profileId: string;
            orgId: string;
        }) => Promise<TaxonomyRule[]>;
        fileClassification: (_: any, { fileId, orgId }: {
            fileId: string;
            orgId: string;
        }) => Promise<Classification | null>;
    };
    Mutation: {
        createCanonicalSlot: (_: any, { input, orgId }: {
            input: Omit<CanonicalSlot, "key"> & {
                key?: string;
            };
            orgId: string;
        }) => Promise<CanonicalSlot>;
        createTaxonomyProfile: (_: any, { input, orgId }: {
            input: Omit<TaxonomyProfile, "id" | "created_at">;
            orgId: string;
        }) => Promise<TaxonomyProfile>;
        createTaxonomyRule: (_: any, { input, profileId, orgId }: {
            input: Omit<TaxonomyRule, "id">;
            profileId: string;
            orgId: string;
        }) => Promise<TaxonomyRule>;
        classifyFile: (_: any, { fileId, orgId, userId }: {
            fileId: string;
            orgId: string;
            userId: string;
        }) => Promise<Classification | null>;
        applyManualClassification: (_: any, { fileId, slot, confidence, orgId, userId }: {
            fileId: string;
            slot: string;
            confidence?: number;
            orgId: string;
            userId: string;
        }) => Promise<Classification>;
    };
};
//# sourceMappingURL=TaxonomyResolvers.d.ts.map
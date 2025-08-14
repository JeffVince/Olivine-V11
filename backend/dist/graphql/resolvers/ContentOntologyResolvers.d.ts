import { Project, Scene, Character, Talent, Crew } from '../../services/ContentOntologyService';
export declare class ContentOntologyResolvers {
    private contentService;
    constructor();
    getResolvers(): {
        Query: {
            project: (_: any, { id, organizationId }: {
                id: string;
                organizationId: string;
            }) => Promise<Project | null>;
            projects: (_: any, { organizationId }: {
                organizationId: string;
            }) => Promise<Project[]>;
            sceneBreakdown: (_: any, { shootDayDate, organizationId }: {
                shootDayDate: Date;
                organizationId: string;
            }) => Promise<any>;
        };
        Mutation: {
            createProject: (_: any, { input, userId }: {
                input: Omit<Project, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Project>;
            createScene: (_: any, { input, userId }: {
                input: Omit<Scene, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Scene>;
            createCharacter: (_: any, { input, userId }: {
                input: Omit<Character, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Character>;
            createTalent: (_: any, { input, userId }: {
                input: Omit<Talent, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Talent>;
            createCrew: (_: any, { input, userId }: {
                input: Omit<Crew, "id" | "created_at" | "updated_at">;
                userId: string;
            }) => Promise<Crew>;
            linkSceneToCharacter: (_: any, { sceneId, characterId, organizationId, userId }: {
                sceneId: string;
                characterId: string;
                organizationId: string;
                userId: string;
            }) => Promise<{
                success: boolean;
            }>;
        };
    };
}
export declare const contentOntologyResolvers: {
    Query: {
        project: (_: any, { id, organizationId }: {
            id: string;
            organizationId: string;
        }) => Promise<Project | null>;
        projects: (_: any, { organizationId }: {
            organizationId: string;
        }) => Promise<Project[]>;
        sceneBreakdown: (_: any, { shootDayDate, organizationId }: {
            shootDayDate: Date;
            organizationId: string;
        }) => Promise<any>;
    };
    Mutation: {
        createProject: (_: any, { input, userId }: {
            input: Omit<Project, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Project>;
        createScene: (_: any, { input, userId }: {
            input: Omit<Scene, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Scene>;
        createCharacter: (_: any, { input, userId }: {
            input: Omit<Character, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Character>;
        createTalent: (_: any, { input, userId }: {
            input: Omit<Talent, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Talent>;
        createCrew: (_: any, { input, userId }: {
            input: Omit<Crew, "id" | "created_at" | "updated_at">;
            userId: string;
        }) => Promise<Crew>;
        linkSceneToCharacter: (_: any, { sceneId, characterId, organizationId, userId }: {
            sceneId: string;
            characterId: string;
            organizationId: string;
            userId: string;
        }) => Promise<{
            success: boolean;
        }>;
    };
};
//# sourceMappingURL=ContentOntologyResolvers.d.ts.map
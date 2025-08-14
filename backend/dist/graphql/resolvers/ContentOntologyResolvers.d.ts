import { Project, Scene, Character, Talent, Crew } from '../../services/ContentOntologyService';
export declare class ContentOntologyResolvers {
    private contentService;
    constructor();
    getResolvers(): {
        Query: {
            project: (_: any, { id, orgId }: {
                id: string;
                orgId: string;
            }) => Promise<Project | null>;
            projects: (_: any, { orgId }: {
                orgId: string;
            }) => Promise<Project[]>;
            sceneBreakdown: (_: any, { shootDayDate, orgId }: {
                shootDayDate: Date;
                orgId: string;
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
            linkSceneToCharacter: (_: any, { sceneId, characterId, orgId, userId }: {
                sceneId: string;
                characterId: string;
                orgId: string;
                userId: string;
            }) => Promise<{
                success: boolean;
            }>;
        };
    };
}
export declare const contentOntologyResolvers: {
    Query: {
        project: (_: any, { id, orgId }: {
            id: string;
            orgId: string;
        }) => Promise<Project | null>;
        projects: (_: any, { orgId }: {
            orgId: string;
        }) => Promise<Project[]>;
        sceneBreakdown: (_: any, { shootDayDate, orgId }: {
            shootDayDate: Date;
            orgId: string;
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
        linkSceneToCharacter: (_: any, { sceneId, characterId, orgId, userId }: {
            sceneId: string;
            characterId: string;
            orgId: string;
            userId: string;
        }) => Promise<{
            success: boolean;
        }>;
    };
};
//# sourceMappingURL=ContentOntologyResolvers.d.ts.map
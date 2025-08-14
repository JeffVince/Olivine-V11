import { 
  ContentOntologyService, 
  Project, 
  Scene, 
  Character, 
  Talent, 
  Crew 
} from '../../services/ContentOntologyService';

export class ContentOntologyResolvers {
  private contentService: ContentOntologyService;

  constructor() {
    this.contentService = new ContentOntologyService();
  }

  getResolvers() {
    return {
      Query: {
        project: async (_: any, { id, orgId }: { id: string; orgId: string }) => {
          return await this.contentService.getProject(id, orgId);
        },

        projects: async (_: any, { orgId }: { orgId: string }) => {
          return await this.contentService.getProjects(orgId);
        },

        sceneBreakdown: async (_: any, { shootDayDate, orgId }: { shootDayDate: Date; orgId: string }) => {
          return await this.contentService.getSceneBreakdown(shootDayDate, orgId);
        }
      },

      Mutation: {
        createProject: async (
          _: any, 
          { input, userId }: { input: Omit<Project, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.contentService.createProject(input, userId);
        },

        createScene: async (
          _: any, 
          { input, userId }: { input: Omit<Scene, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.contentService.createScene(input, userId);
        },

        createCharacter: async (
          _: any, 
          { input, userId }: { input: Omit<Character, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.contentService.createCharacter(input, userId);
        },

        createTalent: async (
          _: any, 
          { input, userId }: { input: Omit<Talent, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.contentService.createTalent(input, userId);
        },

        createCrew: async (
          _: any, 
          { input, userId }: { input: Omit<Crew, 'id' | 'created_at' | 'updated_at'>; userId: string }
        ) => {
          return await this.contentService.createCrew(input, userId);
        },

        linkSceneToCharacter: async (
          _: any,
          { sceneId, characterId, orgId, userId }: {
            sceneId: string;
            characterId: string;
            orgId: string;
            userId: string;
          }
        ) => {
          await this.contentService.linkSceneToCharacter(sceneId, characterId, orgId, userId);
          return { success: true };
        }
      }
    };
  }
}

export const contentOntologyResolvers = new ContentOntologyResolvers().getResolvers();

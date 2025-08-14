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
        project: async (_: any, { id, organizationId }: { id: string; organizationId: string }) => {
          return await this.contentService.getProject(id, organizationId);
        },

        projects: async (_: any, { organizationId }: { organizationId: string }) => {
          return await this.contentService.getProjects(organizationId);
        },

        sceneBreakdown: async (_: any, { shootDayDate, organizationId }: { shootDayDate: Date; organizationId: string }) => {
          return await this.contentService.getSceneBreakdown(shootDayDate, organizationId);
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
          { sceneId, characterId, organizationId, userId }: {
            sceneId: string;
            characterId: string;
            organizationId: string;
            userId: string;
          }
        ) => {
          await this.contentService.linkSceneToCharacter(sceneId, characterId, organizationId, userId);
          return { success: true };
        }
      }
    };
  }
}

export const contentOntologyResolvers = new ContentOntologyResolvers().getResolvers();

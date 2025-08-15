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
      Project: {
        orgId: (src: any) => src.orgId ?? src.org_id,
        // Prefer explicit camelCase if already present; otherwise read snake_case
        createdAt: (src: any) => {
          const value = src.createdAt ?? src.created_at;
          if (!value) return value;
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'object' && typeof (value as any).toString === 'function') return (value as any).toString();
          return value;
        },
        updatedAt: (src: any) => {
          const value = src.updatedAt ?? src.updated_at;
          if (!value) return value;
          if (value instanceof Date) return value.toISOString();
          if (typeof value === 'object' && typeof (value as any).toString === 'function') return (value as any).toString();
          return value;
        },
        // Map internal status strings to GraphQL enum values
        status: (src: any) => {
          const raw = (src.status ?? '').toString().toLowerCase();
          const map: Record<string, string> = {
            development: 'DEVELOPMENT',
            active: 'ACTIVE',
            production: 'ACTIVE',
            pre_production: 'ACTIVE',
            post_production: 'ACTIVE',
            completed: 'COMPLETED',
            archived: 'ARCHIVED',
            cancelled: 'CANCELLED',
          };
          return map[raw] ?? 'ACTIVE';
        },
        // Provide name from title if absent to satisfy non-null GraphQL field
        name: (src: any) => src.name ?? src.title ?? null,
        // Normalize metadata if persisted as JSON string
        metadata: (src: any) => {
          const value = src.metadata;
          if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return value; }
          }
          return value;
        }
      },
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

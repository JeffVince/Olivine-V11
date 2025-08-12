"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentOntologyResolvers = exports.ContentOntologyResolvers = void 0;
const ContentOntologyService_1 = require("../../services/ContentOntologyService");
class ContentOntologyResolvers {
    constructor() {
        this.contentService = new ContentOntologyService_1.ContentOntologyService();
    }
    getResolvers() {
        return {
            Query: {
                project: async (_, { id, orgId }) => {
                    return await this.contentService.getProject(id, orgId);
                },
                projects: async (_, { orgId }) => {
                    return await this.contentService.getProjects(orgId);
                },
                sceneBreakdown: async (_, { shootDayDate, orgId }) => {
                    return await this.contentService.getSceneBreakdown(shootDayDate, orgId);
                }
            },
            Mutation: {
                createProject: async (_, { input, userId }) => {
                    return await this.contentService.createProject(input, userId);
                },
                createScene: async (_, { input, userId }) => {
                    return await this.contentService.createScene(input, userId);
                },
                createCharacter: async (_, { input, userId }) => {
                    return await this.contentService.createCharacter(input, userId);
                },
                createTalent: async (_, { input, userId }) => {
                    return await this.contentService.createTalent(input, userId);
                },
                createCrew: async (_, { input, userId }) => {
                    return await this.contentService.createCrew(input, userId);
                },
                linkSceneToCharacter: async (_, { sceneId, characterId, orgId, userId }) => {
                    await this.contentService.linkSceneToCharacter(sceneId, characterId, orgId, userId);
                    return { success: true };
                }
            }
        };
    }
}
exports.ContentOntologyResolvers = ContentOntologyResolvers;
exports.contentOntologyResolvers = new ContentOntologyResolvers().getResolvers();
//# sourceMappingURL=ContentOntologyResolvers.js.map
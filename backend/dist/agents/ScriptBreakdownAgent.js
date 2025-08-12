"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptBreakdownAgent = void 0;
const BaseAgent_1 = require("./BaseAgent");
const ContentOntologyService_1 = require("../services/ContentOntologyService");
const TaxonomyService_1 = require("../services/TaxonomyService");
const MockLlmProvider_1 = require("../services/llm/MockLlmProvider");
const LlmService_1 = require("../services/llm/LlmService");
class ScriptBreakdownAgent extends BaseAgent_1.BaseAgent {
    constructor(queueService) {
        super('script_breakdown_agent', queueService, {
            maxRetries: 3,
            retryDelay: 1000,
            healthCheckInterval: 30000,
            enableMonitoring: true,
            logLevel: 'info'
        });
        this.contentService = new ContentOntologyService_1.ContentOntologyService();
        this.taxonomyService = new TaxonomyService_1.TaxonomyService();
        this.llmService = new LlmService_1.LlmService(new MockLlmProvider_1.MockLlmProvider());
    }
    async processScript(scriptText, projectId, orgId, userId) {
        try {
            const project = await this.contentService.getProject(projectId, orgId);
            if (!project) {
                throw new Error(`Project not found: ${projectId}`);
            }
            const extractedScenes = await this.extractScenesFromScript(scriptText);
            const extractedCharacters = await this.extractCharactersFromScript(scriptText, projectId, orgId);
            const extractedProps = await this.extractPropsFromScenes(extractedScenes, projectId, orgId);
            const createdScenes = [];
            for (const sceneData of extractedScenes) {
                const scene = await this.contentService.createScene({
                    org_id: orgId,
                    project_id: projectId,
                    number: sceneData.number,
                    title: sceneData.title,
                    location: sceneData.location,
                    time_of_day: sceneData.time_of_day,
                    page_count: sceneData.page_count,
                    status: 'draft',
                    description: sceneData.description
                }, userId);
                createdScenes.push(scene);
            }
            const createdCharacters = [];
            for (const characterData of extractedCharacters) {
                const character = await this.contentService.createCharacter({
                    org_id: orgId,
                    project_id: projectId,
                    name: characterData.name,
                    role_type: characterData.role_type,
                    description: characterData.description,
                    age_range: characterData.age_range
                }, userId);
                createdCharacters.push(character);
            }
            const createdProps = [];
            for (const propData of extractedProps) {
            }
            await this.linkScenesAndCharacters(createdScenes, createdCharacters, extractedScenes, orgId, userId);
            return {
                scenes: createdScenes,
                characters: createdCharacters,
                props: createdProps,
                locations: extractedScenes.map(s => s.location),
                success: true
            };
        }
        catch (error) {
            console.error('Error processing script:', error);
            return {
                scenes: [],
                characters: [],
                props: [],
                locations: [],
                success: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async extractScenesFromScript(scriptText) {
        const prompt = `
      Analyze the following script and extract all scenes. For each scene, provide:
      - Scene number (e.g., "1", "2A", "15")
      - Scene title/heading
      - Location (e.g., "Kitchen - Interior", "Park - Exterior")
      - Time of day (DAY, NIGHT, DAWN, or DUSK)
      - Brief description of what happens in the scene
      - List of characters that appear in the scene
      - List of significant props mentioned in the scene
      - Estimated page count (if discernible)

      Format your response as a JSON array of scene objects.

      Script:
      ${scriptText}
    `;
        try {
            const response = await this.llmService.complete([{ role: 'user', content: prompt }], {
                model: 'default',
                temperature: 0.1,
                maxTokens: 4000
            });
            const scenes = JSON.parse(response);
            return scenes.map((scene) => ({
                number: scene.number || scene.scene_number || 'Unknown',
                title: scene.title || scene.heading || 'Untitled Scene',
                location: scene.location || 'Unknown Location',
                time_of_day: this.normalizeTimeOfDay(scene.time_of_day || scene.time),
                description: scene.description || '',
                characters: Array.isArray(scene.characters) ? scene.characters : [],
                props: Array.isArray(scene.props) ? scene.props : [],
                page_count: scene.page_count || scene.pages || 1
            }));
        }
        catch (error) {
            console.error('Error extracting scenes from script:', error);
            return [];
        }
    }
    async extractCharactersFromScript(scriptText, projectId, orgId) {
        const prompt = `
      Analyze the following script and extract all characters. For each character, provide:
      - Character name
      - Role type (lead, supporting, background, or extra)
      - Brief description of the character
      - Age range if mentioned or can be inferred

      Format your response as a JSON array of character objects.

      Script:
      ${scriptText}
    `;
        try {
            const response = await this.llmService.complete([{ role: 'user', content: prompt }], {
                model: 'default',
                temperature: 0.1,
                maxTokens: 2000
            });
            const characters = JSON.parse(response);
            return characters.map((char) => ({
                name: char.name || char.character_name || 'Unknown Character',
                role_type: this.normalizeRoleType(char.role_type || char.role),
                description: char.description || '',
                age_range: char.age_range || char.age
            }));
        }
        catch (error) {
            console.error('Error extracting characters from script:', error);
            return [];
        }
    }
    async extractPropsFromScenes(scenes, projectId, orgId) {
        const allProps = scenes.flatMap(scene => scene.props);
        const uniqueProps = [...new Set(allProps)];
        return uniqueProps.map(prop => ({
            name: prop,
            category: this.categorizeProp(prop),
            description: `Prop mentioned in script: ${prop}`
        }));
    }
    async linkScenesAndCharacters(scenes, characters, extractedScenes, orgId, userId) {
        for (let i = 0; i < scenes.length && i < extractedScenes.length; i++) {
            const scene = scenes[i];
            const extractedScene = extractedScenes[i];
            for (const characterName of extractedScene.characters) {
                const matchingCharacter = characters.find(char => char.name.toLowerCase().includes(characterName.toLowerCase()) ||
                    characterName.toLowerCase().includes(char.name.toLowerCase()));
                if (matchingCharacter) {
                    try {
                        await this.contentService.linkSceneToCharacter(scene.id, matchingCharacter.id, orgId, userId);
                    }
                    catch (error) {
                        console.error(`Error linking scene ${scene.id} to character ${matchingCharacter.id}:`, error);
                    }
                }
            }
        }
    }
    normalizeTimeOfDay(timeOfDay) {
        const normalized = timeOfDay.toUpperCase();
        if (normalized.includes('NIGHT'))
            return 'NIGHT';
        if (normalized.includes('DAWN') || normalized.includes('MORNING'))
            return 'DAWN';
        if (normalized.includes('DUSK') || normalized.includes('EVENING'))
            return 'DUSK';
        return 'DAY';
    }
    normalizeRoleType(roleType) {
        const normalized = roleType.toLowerCase();
        if (normalized.includes('lead') || normalized.includes('main') || normalized.includes('protagonist'))
            return 'lead';
        if (normalized.includes('supporting') || normalized.includes('secondary'))
            return 'supporting';
        if (normalized.includes('background'))
            return 'background';
        return 'extra';
    }
    categorizeProp(propName) {
        const name = propName.toLowerCase();
        if (name.includes('weapon') || name.includes('gun') || name.includes('knife'))
            return 'weapons';
        if (name.includes('car') || name.includes('vehicle') || name.includes('truck'))
            return 'vehicles';
        if (name.includes('phone') || name.includes('computer') || name.includes('laptop'))
            return 'electronics';
        if (name.includes('document') || name.includes('paper') || name.includes('letter'))
            return 'documents';
        if (name.includes('furniture') || name.includes('chair') || name.includes('table'))
            return 'furniture';
        if (name.includes('clothing') || name.includes('costume') || name.includes('dress'))
            return 'wardrobe';
        return 'general';
    }
    getCapabilities() {
        return [
            'script_analysis',
            'scene_extraction',
            'character_identification',
            'prop_detection',
            'location_extraction',
            'content_ontology_creation'
        ];
    }
    getStatus() {
        return {
            name: this.name,
            running: this.running,
            paused: this.paused,
            error: this.lastError,
            startTime: this.startTime,
            lastActivity: this.lastActivity,
            processedJobs: this.processedJobs,
            failedJobs: this.failedJobs
        };
    }
    async onStart() {
        console.log(`${this.name} agent started`);
    }
    async onStop() {
        console.log(`${this.name} agent stopped`);
    }
    async onPause() {
        console.log(`${this.name} agent paused`);
    }
    async onResume() {
        console.log(`${this.name} agent resumed`);
    }
}
exports.ScriptBreakdownAgent = ScriptBreakdownAgent;
//# sourceMappingURL=ScriptBreakdownAgent.js.map
import { BaseAgent } from './BaseAgent';
import { ContentOntologyService, Project, Scene, Character, Prop } from '../services/ContentOntologyService';
import { TaxonomyService } from '../services/TaxonomyService';
import { LlmService } from '../services/llm/LlmService';

interface ScriptBreakdownResult {
  scenes: Scene[];
  characters: Character[];
  props: Prop[];
  locations: string[];
  success: boolean;
  errors?: string[];
}

interface ExtractedScene {
  number: string;
  title: string;
  location: string;
  time_of_day: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  description: string;
  characters: string[];
  props: string[];
  page_count?: number;
}

export class ScriptBreakdownAgent extends BaseAgent {
  private contentService: ContentOntologyService;
  private taxonomyService: TaxonomyService;
  private llmService: LlmService;

  constructor() {
    super('script_breakdown_agent', 'Analyzes scripts and breaks them down into scenes, characters, and props');
    this.contentService = new ContentOntologyService();
    this.taxonomyService = new TaxonomyService();
    this.llmService = new LlmService();
  }

  /**
   * Process a script file and break it down into structured data
   */
  async processScript(
    scriptText: string, 
    projectId: string, 
    orgId: string, 
    userId: string
  ): Promise<ScriptBreakdownResult> {
    try {
      // Get project information
      const project = await this.contentService.getProject(projectId, orgId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Extract scenes from script using LLM
      const extractedScenes = await this.extractScenesFromScript(scriptText);

      // Extract characters from script
      const extractedCharacters = await this.extractCharactersFromScript(scriptText, projectId, orgId);

      // Extract props from scenes
      const extractedProps = await this.extractPropsFromScenes(extractedScenes, projectId, orgId);

      // Create scenes in the knowledge graph
      const createdScenes: Scene[] = [];
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

      // Create characters in the knowledge graph
      const createdCharacters: Character[] = [];
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

      // Create props in the knowledge graph
      const createdProps: Prop[] = [];
      for (const propData of extractedProps) {
        // Note: We would need to implement createProp in ContentOntologyService
        // For now, we'll skip this step
      }

      // Link scenes to characters
      await this.linkScenesAndCharacters(createdScenes, createdCharacters, extractedScenes, orgId, userId);

      return {
        scenes: createdScenes,
        characters: createdCharacters,
        props: createdProps,
        locations: extractedScenes.map(s => s.location),
        success: true
      };

    } catch (error) {
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

  /**
   * Extract scenes from script text using LLM
   */
  private async extractScenesFromScript(scriptText: string): Promise<ExtractedScene[]> {
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
      const response = await this.llmService.generateResponse(prompt, {
        temperature: 0.1, // Low temperature for consistent extraction
        maxTokens: 4000
      });

      // Parse the LLM response as JSON
      const scenes = JSON.parse(response);
      
      // Validate and normalize the extracted scenes
      return scenes.map((scene: any) => ({
        number: scene.number || scene.scene_number || 'Unknown',
        title: scene.title || scene.heading || 'Untitled Scene',
        location: scene.location || 'Unknown Location',
        time_of_day: this.normalizeTimeOfDay(scene.time_of_day || scene.time),
        description: scene.description || '',
        characters: Array.isArray(scene.characters) ? scene.characters : [],
        props: Array.isArray(scene.props) ? scene.props : [],
        page_count: scene.page_count || scene.pages || 1
      }));

    } catch (error) {
      console.error('Error extracting scenes from script:', error);
      return [];
    }
  }

  /**
   * Extract characters from script text
   */
  private async extractCharactersFromScript(
    scriptText: string, 
    projectId: string, 
    orgId: string
  ): Promise<Array<{
    name: string;
    role_type: 'lead' | 'supporting' | 'background' | 'extra';
    description: string;
    age_range?: string;
  }>> {
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
      const response = await this.llmService.generateResponse(prompt, {
        temperature: 0.1,
        maxTokens: 2000
      });

      const characters = JSON.parse(response);
      
      return characters.map((char: any) => ({
        name: char.name || char.character_name || 'Unknown Character',
        role_type: this.normalizeRoleType(char.role_type || char.role),
        description: char.description || '',
        age_range: char.age_range || char.age
      }));

    } catch (error) {
      console.error('Error extracting characters from script:', error);
      return [];
    }
  }

  /**
   * Extract props from scenes
   */
  private async extractPropsFromScenes(
    scenes: ExtractedScene[], 
    projectId: string, 
    orgId: string
  ): Promise<Array<{
    name: string;
    category: string;
    description: string;
  }>> {
    const allProps = scenes.flatMap(scene => scene.props);
    const uniqueProps = [...new Set(allProps)];

    return uniqueProps.map(prop => ({
      name: prop,
      category: this.categorizeProp(prop),
      description: `Prop mentioned in script: ${prop}`
    }));
  }

  /**
   * Link scenes and characters based on extracted data
   */
  private async linkScenesAndCharacters(
    scenes: Scene[], 
    characters: Character[], 
    extractedScenes: ExtractedScene[],
    orgId: string,
    userId: string
  ): Promise<void> {
    for (let i = 0; i < scenes.length && i < extractedScenes.length; i++) {
      const scene = scenes[i];
      const extractedScene = extractedScenes[i];

      // Find matching characters for this scene
      for (const characterName of extractedScene.characters) {
        const matchingCharacter = characters.find(char => 
          char.name.toLowerCase().includes(characterName.toLowerCase()) ||
          characterName.toLowerCase().includes(char.name.toLowerCase())
        );

        if (matchingCharacter) {
          try {
            await this.contentService.linkSceneToCharacter(
              scene.id, 
              matchingCharacter.id, 
              orgId, 
              userId
            );
          } catch (error) {
            console.error(`Error linking scene ${scene.id} to character ${matchingCharacter.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Normalize time of day values
   */
  private normalizeTimeOfDay(timeOfDay: string): 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' {
    const normalized = timeOfDay.toUpperCase();
    if (normalized.includes('NIGHT')) return 'NIGHT';
    if (normalized.includes('DAWN') || normalized.includes('MORNING')) return 'DAWN';
    if (normalized.includes('DUSK') || normalized.includes('EVENING')) return 'DUSK';
    return 'DAY';
  }

  /**
   * Normalize role type values
   */
  private normalizeRoleType(roleType: string): 'lead' | 'supporting' | 'background' | 'extra' {
    const normalized = roleType.toLowerCase();
    if (normalized.includes('lead') || normalized.includes('main') || normalized.includes('protagonist')) return 'lead';
    if (normalized.includes('supporting') || normalized.includes('secondary')) return 'supporting';
    if (normalized.includes('background')) return 'background';
    return 'extra';
  }

  /**
   * Categorize props
   */
  private categorizeProp(propName: string): string {
    const name = propName.toLowerCase();
    
    if (name.includes('weapon') || name.includes('gun') || name.includes('knife')) return 'weapons';
    if (name.includes('car') || name.includes('vehicle') || name.includes('truck')) return 'vehicles';
    if (name.includes('phone') || name.includes('computer') || name.includes('laptop')) return 'electronics';
    if (name.includes('document') || name.includes('paper') || name.includes('letter')) return 'documents';
    if (name.includes('furniture') || name.includes('chair') || name.includes('table')) return 'furniture';
    if (name.includes('clothing') || name.includes('costume') || name.includes('dress')) return 'wardrobe';
    
    return 'general';
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): string[] {
    return [
      'script_analysis',
      'scene_extraction',
      'character_identification',
      'prop_detection',
      'location_extraction',
      'content_ontology_creation'
    ];
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<any> {
    return {
      name: this.name,
      description: this.description,
      status: 'active',
      capabilities: this.getCapabilities(),
      last_processed: new Date().toISOString()
    };
  }
}

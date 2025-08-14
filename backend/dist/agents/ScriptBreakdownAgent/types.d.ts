import type { Scene, Character, Prop } from '../../services/ContentOntologyService';
export interface ScriptBreakdownResult {
    scenes: Scene[];
    characters: Character[];
    props: Prop[];
    locations: string[];
    success: boolean;
    errors?: string[];
}
export interface ExtractedScene {
    number: string;
    title: string;
    location: string;
    time_of_day: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
    description: string;
    characters: string[];
    props: string[];
    page_count?: number;
}
export type { Scene, Character, Prop } from '../../services/ContentOntologyService';
//# sourceMappingURL=types.d.ts.map
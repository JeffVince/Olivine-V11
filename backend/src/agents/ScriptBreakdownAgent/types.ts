export interface ScriptBreakdownResult {
  scenes: Scene[]
  characters: Character[]
  props: Prop[]
  locations: string[]
  success: boolean
  errors?: string[]
}

export interface ExtractedScene {
  number: string
  title: string
  location: string
  time_of_day: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK'
  description: string
  characters: string[]
  props: string[]
  page_count?: number
}

// Re-export types from ContentOntologyService to avoid deep import coupling for consumers
export type { Scene, Character, Prop } from '../../services/ContentOntologyService'



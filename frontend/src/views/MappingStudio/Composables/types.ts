export interface MappingTemplate {
  id: string
  name: string
  description: string
  type: string
  icon: string
  color: string
}

export interface Mapping {
  id: string
  name: string
  description: string
  type: string
  status: 'active' | 'inactive'
  fieldCount: number
  transformCount: number
  lastRun?: string
  sourceType?: string
}

export interface NewMapping {
  name: string
  description: string
  type: string
  sourceType: string
}

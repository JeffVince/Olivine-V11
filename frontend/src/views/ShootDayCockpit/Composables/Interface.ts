export interface Scene {
  id: string
  name: string
  description: string
  status: 'scheduled' | 'in-progress' | 'completed'
  startTime: string
  endTime: string
}

export interface Action {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface ShootDayCockpitState {
  loading: boolean
  error: string | null
  scenes: Scene[]
  actions: Action[]
}

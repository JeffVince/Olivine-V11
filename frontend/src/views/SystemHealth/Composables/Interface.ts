export interface SystemHealthData {
  status: 'healthy' | 'warning' | 'error'
  services: ServiceStatus[]
  lastUpdated: string
}

export interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'degraded'
  responseTime: number
  lastCheck: string
}

export interface SystemHealthState {
  loading: boolean
  error: string | null
  healthData: SystemHealthData | null
}

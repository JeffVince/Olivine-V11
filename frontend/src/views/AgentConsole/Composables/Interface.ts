export interface Agent {
  id: string
  name: string
  description: string
  type: string
  status: 'active' | 'inactive' | 'error' | 'paused'
  tasksCompleted: number
  tasksRunning: number
  uptime: string
  lastActivity?: string
  created: string
}

export interface Log {
  jobId: string
  timestamp: string
  level: string
  message: string
}

export interface Job {
  id: string
  orgId: string
  type: string
  target: string
  status: string
  priority: number
  attemptsMade: number
  retries: number
  worker: string
  startedAt: string
  finishedAt: string
  durationMs: number
  params: Record<string, unknown>
}

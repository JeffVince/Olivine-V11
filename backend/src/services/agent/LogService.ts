import { pubsub, TOPICS } from '../graphql/PubSub'

export interface LogEntry {
  jobId: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export class LogService {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent log service implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend agent log service tests
  async appendLog(entry: LogEntry): Promise<void> {
    await pubsub.publish(TOPICS.JobLogAppended, { jobLogAppended: entry })
  }
}



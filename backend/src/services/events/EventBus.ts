import { EventEmitter } from 'events'

export interface EventEnvelope<T = any> {
  type: string
  orgId: string
  timestamp: string
  payload: T
}

export class EventBus {
  // TODO: Implementation Plan - 02-Data-Ingestion-Implementation.md - Event bus implementation for file system events
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend event bus tests
  private readonly emitter = new EventEmitter()

  publish<T>(event: EventEnvelope<T>): void {
    this.emitter.emit(event.type, event)
  }

  subscribe<T>(type: string, handler: (event: EventEnvelope<T>) => void): () => void {
    const bound = (e: EventEnvelope<T>) => handler(e)
    this.emitter.on(type, bound)
    return () => this.emitter.off(type, bound)
  }
}



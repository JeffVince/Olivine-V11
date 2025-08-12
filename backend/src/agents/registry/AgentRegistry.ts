import { BaseAgent } from '../BaseAgent'

export interface AgentDescriptor {
  name: string
  instance: BaseAgent
}

export class AgentRegistry {
  // TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent registry implementation
  // TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend agent registry tests
  private readonly agents = new Map<string, BaseAgent>()

  register(descriptor: AgentDescriptor): void {
    this.agents.set(descriptor.name, descriptor.instance)
  }

  async startAll(): Promise<void> {
    for (const [, agent] of this.agents) await agent.start()
  }

  async stopAll(): Promise<void> {
    for (const [, agent] of this.agents) await agent.stop()
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name)
  }

  list(): string[] {
    return Array.from(this.agents.keys())
  }
}



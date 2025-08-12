import { PubSub } from 'graphql-subscriptions'

// TODO: Implementation Plan - 01-Foundation-Setup.md - GraphQL PubSub implementation
// TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent job PubSub topics
// TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend GraphQL PubSub tests
export const pubsub = new PubSub()

export const TOPICS = {
  JobUpdated: 'JOB_UPDATED',
  JobLogAppended: 'JOB_LOG_APPENDED',
}



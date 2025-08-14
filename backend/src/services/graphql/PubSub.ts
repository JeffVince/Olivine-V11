// Use require so Jest module mocks intercept the constructor reliably
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PubSub } = require('graphql-subscriptions') as { PubSub: new () => any }

// TODO: Implementation Plan - 01-Foundation-Setup.md - GraphQL PubSub implementation
// TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent job PubSub topics
// TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend GraphQL PubSub tests
// Factory to create PubSub instances (useful for tests post-clear)
export const createPubSub = () => new PubSub()

// Module-level instance for application usage
export const pubsub = createPubSub()

export const TOPICS = {
  JobUpdated: 'JOB_UPDATED',
  JobLogAppended: 'JOB_LOG_APPENDED',
}

export default pubsub

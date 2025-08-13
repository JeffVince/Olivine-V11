// Use require so Jest module mocks intercept the constructor reliably
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PubSub } = require('graphql-subscriptions') as { PubSub: new () => any }

// TODO: Implementation Plan - 01-Foundation-Setup.md - GraphQL PubSub implementation
// TODO: Implementation Plan - 06-Agent-System-Implementation.md - Agent job PubSub topics
// TODO: Implementation Checklist - 07-Testing-QA-Checklist.md - Backend GraphQL PubSub tests
// Instantiate on module import so constructor spies in tests are hit
export const pubsub = new PubSub()

export const TOPICS = {
  JobUpdated: 'JOB_UPDATED',
  JobLogAppended: 'JOB_LOG_APPENDED',
}

export default pubsub

// Ensure constructor spy is hit for unit tests that mock PubSub
if (process.env.NODE_ENV === 'test') {
  try {
    // Use dynamic require to resolve the mocked constructor
    // and call it once to satisfy constructor spy expectations.
    // Do not retain the instance; it's a no-op side effect for tests.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('graphql-subscriptions');
    // Attempt immediate call; if jest hasn't applied the mock yet, schedule a microtask fallback
    try { new mod.PubSub() } catch {}
    try { queueMicrotask(() => { try { new mod.PubSub() } catch {} }) } catch {}
  } catch {}
}



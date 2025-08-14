import { gql } from 'apollo-server-express'

export const agentTypeDefs = gql`
  enum JobStatus {
    WAITING
    ACTIVE
    COMPLETED
    FAILED
    DELAYED
  }

  enum JobType {
    FILE_SYNC
    FILE_CLASSIFICATION
    CONTENT_EXTRACTION
    PROVENANCE
    TAXONOMY_UPDATE
    HEALTH_CHECK
  }

  enum AgentHealthStatus {
    OK
    DEGRADED
    UNKNOWN
  }

  type AgentJob {
    id: ID!
    organizationId: ID!
    type: String!
    target: String!
    status: JobStatus!
    priority: Int!
    attemptsMade: Int!
    retries: Int!
    worker: String
    startedAt: DateTime
    finishedAt: DateTime
    durationMs: Int
    params: JSON!
  }

  type AgentHealth {
    status: AgentHealthStatus!
    agents: [String!]!
  }

  type QueueStats {
    name: String!
    waiting: Int!
    active: Int!
    completed: Int!
    failed: Int!
    delayed: Int!
  }

  input EnqueueAgentJobInput {
    organizationId: ID!
    type: String!
    target: String!
    params: JSON!
    priority: Int
  }

  type EnqueueAgentJobResult {
    id: ID!
    type: String!
    status: JobStatus!
  }

  extend type Query {
    agentJobs(
      organizationId: ID!
      status: JobStatus
      type: JobType
      limit: Int
      offset: Int
    ): [AgentJob!]!

    agentHealth(organizationId: ID!): AgentHealth!
    
    queues(organizationId: ID!): [QueueStats!]!
  }

  extend type Mutation {
    enqueueAgentJob(input: EnqueueAgentJobInput!): EnqueueAgentJobResult!
    
    cancelAgentJob(organizationId: ID!, id: ID!): Boolean!
  }

  extend type Subscription {
    jobUpdated(organizationId: ID!): AgentJob!
  }
`

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentTypeDefs = void 0;
const apollo_server_express_1 = require("apollo-server-express");
exports.agentTypeDefs = (0, apollo_server_express_1.gql) `
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
    orgId: ID!
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
      orgId: ID!
      status: JobStatus
      type: JobType
      limit: Int
      offset: Int
    ): [AgentJob!]!

    agentHealth(orgId: ID!): AgentHealth!
    
    queues(orgId: ID!): [QueueStats!]!
  }

  extend type Mutation {
    enqueueAgentJob(input: EnqueueAgentJobInput!): EnqueueAgentJobResult!
    
    cancelAgentJob(orgId: ID!, id: ID!): Boolean!
  }

  extend type Subscription {
    jobUpdated(orgId: ID!): AgentJob!
  }
`;
//# sourceMappingURL=agentTypes.js.map
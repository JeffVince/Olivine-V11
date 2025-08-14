import { Neo4jService } from '../../../services/Neo4jService'
import { Record } from 'neo4j-driver'

export interface CommitRecord {
  id: string
  orgId: string
  message: string
  author: string
  authorType: string
  createdAt: any
  parentCommitId: string | null
  branchName: string
  signature: string
  metadata: any
}

export class CommitRepository {
  private neo4j: Neo4jService

  constructor(neo4jService: Neo4jService) {
    this.neo4j = neo4jService
  }

  async createCommit(params: {
    commitId: string
    orgId: string
    message: string
    author: string
    authorType: string
    createdAt: string
    parentCommitId: string | null
    branchName: string
    signature: string
    metadataJson: string
  }): Promise<string> {
    const query = `
      CREATE (c:Commit {
        id: $commitId,
        org_id: $orgId,
        message: $message,
        author: $author,
        author_type: $authorType,
        created_at: datetime($createdAt),
        parent_commit_id: $parentCommitId,
        branch_name: $branchName,
        signature: $signature,
        metadata: $metadataJson
      })
      RETURN c.id as commitId
    `
    await this.neo4j.run(query, params)
    return params.commitId
  }

  async addParentRelationship(parentCommitId: string, childCommitId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (parent:Commit {id: $parentCommitId, org_id: $orgId})
      MATCH (child:Commit {id: $childCommitId, org_id: $orgId})
      CREATE (parent)-[:PARENT_OF {org_id: $orgId, created_at: datetime()}]->(child)
    `
    await this.neo4j.run(query, { parentCommitId, childCommitId, orgId })
  }

  async addCommitActionRelationship(commitId: string, actionId: string, orgId: string): Promise<void> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      MATCH (a:Action {id: $actionId})
      CREATE (c)-[:CONTAINS {org_id: $orgId, created_at: datetime()}]->(a)
    `
    await this.neo4j.run(query, { commitId, actionId, orgId })
  }

  async getCommitById(commitId: string): Promise<CommitRecord | null> {
    const query = `
      MATCH (c:Commit {id: $commitId})
      RETURN c
    `
    const result = await this.neo4j.run(query, { commitId })
    if (result.records.length === 0) return null
    const commit = result.records[0].get('c').properties
    return {
      id: commit.id,
      orgId: commit.org_id,
      message: commit.message,
      author: commit.author,
      authorType: commit.author_type,
      createdAt: commit.created_at,
      parentCommitId: commit.parent_commit_id,
      branchName: commit.branch_name,
      signature: commit.signature,
      metadata: commit.metadata
    }
  }

  async getCommitHistory(orgId: string, branchName: string, limit = 50): Promise<any[]> {
    const query = `
      MATCH (c:Commit {org_id: $orgId, branch_name: $branchName})
      OPTIONAL MATCH (c)<-[:PART_OF]-(a:Action)
      RETURN c, collect(a) as actions
      ORDER BY c.created_at DESC
      LIMIT $limit
    `
    const result = await this.neo4j.run(query, { orgId, branchName, limit })
    return result.records.map((record: Record) => {
      const commit = record.get('c').properties
      const actions = record.get('actions').map((action: any) => action.properties)
      return {
        id: commit.id,
        orgId: commit.org_id,
        message: commit.message,
        author: commit.author,
        authorType: commit.author_type,
        createdAt: commit.created_at,
        parentCommitId: commit.parent_commit_id,
        branchName: commit.branch_name,
        signature: commit.signature,
        metadata: JSON.parse(commit.metadata || '{}'),
        actions
      }
    })
  }
}



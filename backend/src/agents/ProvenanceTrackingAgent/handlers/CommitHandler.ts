import { v4 as uuidv4 } from 'uuid'
import { CryptoService } from '../../../services/crypto/CryptoService'
import { CommitRepository } from '../graph/CommitRepository'
import { CommitInput } from '../types'

export class CommitHandler {
  private crypto: CryptoService
  private commits: CommitRepository

  constructor(cryptoService: CryptoService, commitRepository: CommitRepository) {
    this.crypto = cryptoService
    this.commits = commitRepository
  }

  async createCommit(commitData: CommitInput): Promise<string> {
    const { orgId, message, author, authorType, parentCommitId, branchName, metadata } = commitData
    const commitId = uuidv4()
    const createdAt = new Date().toISOString()
    const commitContent = { id: commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', metadata: metadata || {} }
    const signature = this.crypto.sign(JSON.stringify(commitContent))
    await this.commits.createCommit({ commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', signature, metadataJson: JSON.stringify(metadata || {}) })
    if (parentCommitId) { await this.commits.addParentRelationship(parentCommitId, commitId, orgId) }
    return commitId
  }

  async validateCommit(commitId: string): Promise<boolean> {
    const commit = await this.commits.getCommitById(commitId)
    if (!commit) { throw new Error(`Commit not found: ${commitId}`) }
    const commitContent = { id: commit.id, orgId: commit.orgId, message: commit.message, author: commit.author, authorType: commit.authorType, createdAt: commit.createdAt, parentCommitId: commit.parentCommitId, branchName: commit.branchName, metadata: JSON.parse(commit.metadata || '{}') }
    return this.crypto.verify(JSON.stringify(commitContent), commit.signature)
  }
}



import { v4 as uuidv4 } from 'uuid'
import { CryptoService } from '../../../services/crypto/CryptoService'
import { VersionRepository } from '../graph/VersionRepository'
import { VersionInput } from '../types'

export class VersionHandler {
  private crypto: CryptoService
  private versions: VersionRepository

  constructor(cryptoService: CryptoService, versionRepository: VersionRepository) {
    this.crypto = cryptoService
    this.versions = versionRepository
  }

  async createVersion(versionData: VersionInput): Promise<string> {
    const { orgId, entityId, entityType, properties, commitId } = versionData
    const versionId = uuidv4()
    const createdAt = new Date().toISOString()
    const contentHash = this.crypto.hash(JSON.stringify(properties))
    const existingVersionId = await this.versions.getExistingVersion(orgId, entityId, contentHash)
    if (existingVersionId) { return existingVersionId }
    await this.versions.createVersion({ versionId, orgId, entityId, entityType, properties: JSON.stringify(properties), commitId, createdAt, contentHash })
    await this.versions.createEntityVersionRelationship(entityId, versionId, orgId)
    return versionId
  }
}



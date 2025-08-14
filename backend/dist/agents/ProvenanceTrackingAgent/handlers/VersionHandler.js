"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionHandler = void 0;
const uuid_1 = require("uuid");
class VersionHandler {
    constructor(cryptoService, versionRepository) {
        this.crypto = cryptoService;
        this.versions = versionRepository;
    }
    async createVersion(versionData) {
        const { orgId, entityId, entityType, properties, commitId } = versionData;
        const versionId = (0, uuid_1.v4)();
        const createdAt = new Date().toISOString();
        const contentHash = this.crypto.hash(JSON.stringify(properties));
        const existingVersionId = await this.versions.getExistingVersion(orgId, entityId, contentHash);
        if (existingVersionId) {
            return existingVersionId;
        }
        await this.versions.createVersion({ versionId, orgId, entityId, entityType, properties: JSON.stringify(properties), commitId, createdAt, contentHash });
        await this.versions.createEntityVersionRelationship(entityId, versionId, orgId);
        return versionId;
    }
}
exports.VersionHandler = VersionHandler;
//# sourceMappingURL=VersionHandler.js.map
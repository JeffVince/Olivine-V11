"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommitHandler = void 0;
const uuid_1 = require("uuid");
class CommitHandler {
    constructor(cryptoService, commitRepository) {
        this.crypto = cryptoService;
        this.commits = commitRepository;
    }
    async createCommit(commitData) {
        const { orgId, message, author, authorType, parentCommitId, branchName, metadata } = commitData;
        const commitId = (0, uuid_1.v4)();
        const createdAt = new Date().toISOString();
        const commitContent = { id: commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', metadata: metadata || {} };
        const signature = this.crypto.sign(JSON.stringify(commitContent));
        await this.commits.createCommit({ commitId, orgId, message, author, authorType, createdAt, parentCommitId: parentCommitId || null, branchName: branchName || 'main', signature, metadataJson: JSON.stringify(metadata || {}) });
        if (parentCommitId) {
            await this.commits.addParentRelationship(parentCommitId, commitId, orgId);
        }
        return commitId;
    }
    async validateCommit(commitId) {
        const commit = await this.commits.getCommitById(commitId);
        if (!commit) {
            throw new Error(`Commit not found: ${commitId}`);
        }
        const commitContent = { id: commit.id, orgId: commit.orgId, message: commit.message, author: commit.author, authorType: commit.authorType, createdAt: commit.createdAt, parentCommitId: commit.parentCommitId, branchName: commit.branchName, metadata: JSON.parse(commit.metadata || '{}') };
        return this.crypto.verify(JSON.stringify(commitContent), commit.signature);
    }
}
exports.CommitHandler = CommitHandler;
//# sourceMappingURL=CommitHandler.js.map
export interface Commit {
  id: string;
  orgId: string;
  payload: unknown;
}

export class OlivineClient {
  public commits: Commit[] = [];

  async createProvenanceCommit(orgId: string, payload: unknown): Promise<Commit> {
    const commit: Commit = { id: `commit-${Math.random().toString(36).slice(2)}`, orgId, payload };
    this.commits.push(commit);
    return commit;
  }
}

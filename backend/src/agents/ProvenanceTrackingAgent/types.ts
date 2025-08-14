export interface CommitInput {
  orgId: string;
  message: string;
  author: string;
  authorType: 'user' | 'agent' | 'system';
  parentCommitId?: string;
  branchName?: string;
  metadata?: any;
}

export interface ActionInput {
  actionType: string;
  tool: string;
  entityType: string;
  entityId: string;
  inputs: any;
  outputs: any;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

export interface VersionInput {
  orgId: string;
  entityId: string;
  entityType: string;
  properties: any;
  commitId: string;
}



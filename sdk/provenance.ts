import { createHash } from 'crypto';

export interface ProvenanceCommit {
  agentId: string;
  version: string;
  trigger: string;
  inputHash: string;
  outputHash: string;
  artifacts: Record<string, any>;
  graphChanges: Record<string, any>;
  startTime: string;
  endTime: string;
  confidence: number;
}

/**
 * Generate a SHA-256 hash for the provided payload.
 * The payload is JSON stringified to ensure stable hashing.
 */
export function hashPayload(payload: unknown): string {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  return createHash('sha256').update(json).digest('hex');
}

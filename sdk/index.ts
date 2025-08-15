import { ProvenanceCommit, hashPayload } from './provenance';

export interface CommitOptions {
  agentId: string;
  version: string;
  trigger: string;
  input: unknown;
  output: unknown;
  artifacts?: Record<string, any>;
  graphChanges?: Record<string, any>;
  startTime: string;
  endTime: string;
  confidence: number;
}

export class OlivineClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Submit a provenance commit to the API.
   * Hashes the input and output payloads before sending.
   */
  async commit(options: CommitOptions): Promise<Response> {
    const payload: ProvenanceCommit = {
      agentId: options.agentId,
      version: options.version,
      trigger: options.trigger,
      inputHash: hashPayload(options.input),
      outputHash: hashPayload(options.output),
      artifacts: options.artifacts ?? {},
      graphChanges: options.graphChanges ?? {},
      startTime: options.startTime,
      endTime: options.endTime,
      confidence: options.confidence,
    };

    const res = await fetch(`${this.baseUrl}/provenance/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Provenance commit failed with status ${res.status}`);
    }

    return res;
  }
}

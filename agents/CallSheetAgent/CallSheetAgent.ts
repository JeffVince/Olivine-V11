import { RuntimeWorker } from '../../runtime/RuntimeWorker';
import { OlivineClient } from '../../client/OlivineClient';

export interface CallSheetEnvelope {
  orgId: string;
  callSheet: Record<string, unknown>;
}

export class CallSheetAgent extends RuntimeWorker<CallSheetEnvelope> {
  constructor(private readonly client: OlivineClient) {
    super();
  }

  protected async handle(envelope: CallSheetEnvelope): Promise<void> {
    await this.client.createProvenanceCommit(envelope.orgId, envelope.callSheet);
  }
}

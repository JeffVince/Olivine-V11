export abstract class RuntimeWorker<TEnvelope> {
  private queue: TEnvelope[] = [];

  enqueue(envelope: TEnvelope): void {
    this.queue.push(envelope);
  }

  async runOnce(): Promise<void> {
    const envelope = this.queue.shift();
    if (envelope) {
      await this.handle(envelope);
    }
  }

  protected abstract handle(envelope: TEnvelope): Promise<void>;
}

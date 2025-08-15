export interface JobEnvelope<T = unknown> {
  id: string;
  queue: string;
  payload: T;
}

export interface RuntimeClient {
  heartbeat(job: JobEnvelope): Promise<void>;
  commit(job: JobEnvelope, result: unknown): Promise<void>;
  fail(job: JobEnvelope, error: unknown): Promise<void>;
}

/**
 * RuntimeWorker executes a job handler while sending periodic heartbeats.
 * It ensures that either commit or fail is invoked exactly once.
 */
export class RuntimeWorker {
  static async run<TInput, TResult>(
    client: RuntimeClient,
    job: JobEnvelope<TInput>,
    handler: (payload: TInput) => Promise<TResult>,
    heartbeatIntervalMs = 10000
  ): Promise<void> {
    let settled = false;
    const interval = setInterval(() => {
      if (!settled) {
        void client.heartbeat(job);
      }
    }, heartbeatIntervalMs);

    try {
      const result = await handler(job.payload);
      if (!settled) {
        settled = true;
        clearInterval(interval);
        await client.commit(job, result);
      }
    } catch (error) {
      if (!settled) {
        settled = true;
        clearInterval(interval);
        await client.fail(job, error as Error);
      }
    } finally {
      clearInterval(interval);
    }
  }
}
